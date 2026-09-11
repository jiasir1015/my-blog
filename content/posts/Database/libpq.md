+++
title = 'libpq'
date = '2025-07-28T10:38:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['PostgreSQL']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 libpq编程

## 1.1 配置数据库

1.  安装数据库

    ```bash
    # 假设安装目录为
    $PG_HOME
    ```

2.  启动数据库

    ```bash
    # 假设数据目录为
    $PG_HOME/data
    ```

3.  配置数据库

    ```bash
    echo 'host all u1 0.0.0.0/0 md5' >> $PG_HOME/data/pg_hba.conf
    echo "listen_addresses='0.0.0.0'" >> $PG_HOME/data/postgresql.conf
    pg_ctl reload -D $PG_HOME/data
    ```

4.  创建用户

    ```bash
    psql -d postgres -c "create user u1 password 'u1.password';"

    # 验证一下
    psql -h 127.0.0.1 -p 5432 -d postgres -U u1 -W 'u1.password' -c '\d'
    ```

## 1.2 编写libpq demo

1.  生成源文件

    ```bash
    touch pq.c

    # 复制 1.3 章节的源码 到 pq.c中

    # 配置环境变量
    export LD_LIBRARY_PATH=$PG_HOME/lib:$LD_LIBRARH_PATH
    ```

2.  编译

    ```bash
    gcc pq.c -o pq -I$PG_HOME/include -L$PG_HOME/lib -lpq
    ```

3.  执行

    ```bash
    ./pq
    ```

## 1.3 libpq demo源码

```c
#include <stdio.h>
#include <stdlib.h>

#include "libpq-fe.h"

PGresult *exec_sql(PGconn *conn, const char *sql)
{
    PGresult *res = PQexec(conn, sql);
    if (PQresultStatus(res) == PGRES_COMMAND_OK || PQresultStatus(res) == PGRES_TUPLES_OK) {
        return res;
    }

    printf("sql  : %s \nerror: %s\n", sql, PQerrorMessage(conn));

    PQfinish(conn);
    exit(0);
}

int main()
{
    PGconn *conn;
    PGresult *res;

    conn = PQconnectdb("host=127.0.0.1 port=5432 dbname=postgres user=u1 password=u1.password");
    if (PQstatus(conn) != CONNECTION_OK) {
        printf("conn error, %s\n", PQerrorMessage(conn));
        exit(0);
    }

    res = exec_sql(conn, "DROP TABLE IF EXISTS t1;");
    res = exec_sql(conn, "CREATE TABLE t1(c1 INT);");
    res = exec_sql(conn, "INSERT INTO t1 VALUES (5);");
    res = exec_sql(conn, "SELECT * FROM t1;");

    int rows = PQntuples(res);
    int i;
    for (i = 0; i < rows; i++) {
        printf("[%d]: %s\n", i, PQgetvalue(res, i, 0));
    }

    PQfinish(conn);

    return 0;
}
```
