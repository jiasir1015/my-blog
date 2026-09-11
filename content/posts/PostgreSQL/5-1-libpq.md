+++
title = 'PostgreSQL 5-1 libpq'
date = '2026-06-30T14:43:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL']
weight = 501
ShowToc = true
TocOpen = true
+++
# 简介

-   postgresql 简单架构

    ```bash
    application                             driver(jdbc/libpq/..)                       server
    +-----------------------------------------------+-----------------------------------------+---------
    | PQconnect(host, port, user, name)
                                                    | do something ..
    | PQexec("create table t1(c1 int, c2 text)")    |
                                                    | PQexecStart()
                                                    | PQsendQuery()
                                                    |   pqPutMsgStart('Q')
                                                    |   pqPutnchar("$sql")
                                                    |   pqPutMsgEnd()
                                                    | pqFlush()
                                                    |                                       | SocketBackend()
                                                                                            | pq_parse_input()
                                                                                            |   'Q': exec_simple_query()
    | PQexec("insert into t1 values(1,'a'),(2,'b')")|
    | PQexec("select * from t1")
                                                    | ..
                                                                                            | ..
                                                                                            | exec_simple_query()
                                                                                            |
    ```

-   libpq的功能

    -   连接管理
    -   协议编码
    -   数据收发

## 连接管理

```
application                             driver(jdbc/libpq/..)                       server
+-------------------------------------------+-----------------------------------------+---------
| connect(host, port, user, name)
```

## 协议编码

-   消息通用格式

    ```bash
    +------+--------+-------------+
    | type | length | palyload    |
    +------+--------+-------------+
      char    int32
    ```

type有以下类型：

-   执行SQL场景

    | 场景 | type | length | payload | 触发条件 | payload示例 |
    | --- | --- | --- | --- | --- | --- |
    | c->s | ‘Q’ | int32 | char \*query | PQexec / PQsendQuery | SELECT \* FROM t1\\0 |
    | c->s | ‘P’ | int32 | char \*stmt_name / char \*query / .. | PQprepare / Parse阶段 | \- |
    | c->s | ‘B’ | int32 | char \*portal_name / char \*stmt_name / .. | \- | $1=1, $2=’a’ |
    | c->s | ‘E’ | int32 | char \*portal_name / | 执行portal | portal0 + 0 |
    | c->s | ‘T’ | int32 | int16 nfileds / Field fields[] | SELECT 返回结果 | c1:int4, c2:text |
    | c->s | ‘D’ | int32 | int16 nrows / Column colsp[] | SELECT 返回结果 | 1,’a’ |
    | c->s | ‘C’ | int32 | char tag | SQL 执行结束 | 2 |
    | c->s | ‘Z’ | int32 | char status | Server空闲 | 1 |
    | c->s | ‘n’ | int32 | (nodata) | DDL等返回结果 | .. |

-   身份认证场景

## 数据收发

```sql
create table t1(c1 int, c2 text)
insert into t1 values(1,'a'),(2,'b')
select * from t1
```

```bash
Client (Libpq)                                                Server (Backend)
│                                                                     │
│ send msg ['Q'][len]["SELECT * from t1\0"] -->                       |
│                                                                     │
│                  <-- send msg ['T'][len][nfields:2 c1/23/4 c2/25/-1 │
│                         <-- send msg ['D'][len][nfields:2 4/1/1/'a' │
│                         <-- send msg ['D'][len][nfields:2 4/2/1/'b' │
│                                 <-- send msg ['C'][len]["SELECT 2"] │
│                                        <-- send msg ['Z'][len]['I'] │
```

其中：

```c
/* --------- msg 'T' -------------- */
/* server */
void printtup_startup(TupleDesc typeinfo)
{
    pq_beginmessage('T')
    pq_sendint16(typeinfo->natts)
    for (i = 0; i < typeinfo->natts; i++) {
        Form_pg_attribute attr = TupleDescAttr(typeinfo, i);
        pq_sendstring(NameStr(attr->attname))
        pq_sendint32(attr->attrelid)
        pq_sendint16(attr->attnum)
        pq_sendint32(attr->atttypid)
        pq_sendint16(attr->attlen)
        pq_sendint32(attr->atttypmod)
        pq_sendint16(format); /* text还是二进制格式，bytea是二进制，其他大部分是text */
    }
    pq_endmessage()
}
/* client */
typedef struct pgresAttDesc
{
	char	   *name;			/* column name */
	Oid			tableid;		/* source table, if known */
	int			columnid;		/* source column, if known */
	int			format;			/* format code for value (text/binary) */
	Oid			typid;			/* type id */
	int			typlen;			/* type size */
	int			atttypmod;		/* type-specific modifier info */
} PGresAttDesc;

/* --------- msg 'D' -------------- */
/* server */
bool printtup(TupleTableSlot *slot)
{
    TupleDesc typeinfo = slot->tts_tupleDescriptor;
    pq_beginmessage('D')
    pq_sendint16(typeinfo->natts); /* 列数 */
    for (int i = 0; i < typeinfo->natts; i++) {
        Datum attr = slot->tts_values[i];
        bool isnull = slot->tts_isnull[i];
        if（isnull) {
            pq_sendint32(-1);
        } else {
            char *outputstr = OidOutputFunctionCall(typoutput, attr) /* 注意：如果是int类型，且是默认的text发送，此处会调用int4out函数，输出字符串，加入int=101，输出char*='101' */
            int len = strlen(outputstr)
            pq_sendint32(len);
            pq_sendbytes(outputstr);
        }
    }
    pq_endmessage()
}
/* client */
typedef struct pgresAttValue
{
	int			len;			/* length in bytes of the value */
	char	   *value;			/* actual value, plus terminating zero byte */
} PGresAttValue;
```
