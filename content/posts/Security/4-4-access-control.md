+++
title = '数据库安全 4 访问控制'
date = '2025-02-05T16:57:00+08:00'
lastmod = '2026-08-14T18:59:29+08:00'
draft = false
categories = ['安全']
tags = ['访问控制']
weight = 404
ShowToc = true
TocOpen = true
+++
# 1 访问控制的背景

在使用数据库存取数据的大部分场景中，数据库具有以下特点：

1.  对象多：一个数据库集群中有多个database对象，1个database对象中有多个schema对象，1个schema对象中有多个table、index等对象
2.  用户多：一个数据库中，有多个用户，每个用户可访问的数据库对象不同

在该场景中，通过访问控制机制，可限制某个对象访问数据库对象的范围

# 2 访问控制的原理

访问控制的模型是：主体、客体、操作。本文不解释基本概念。

| 主体 |
| --- |
| USER |

角色：

-   SYSADMIN 系统管理员
-   CREATEROLE 安全管理员
-   AUDITADMIN 审计管理员
-   MONADMIN 监控管理员
-   OPRADMIN 运维管理员
-   POLADMIN 安全策略管理员

| 客体 |
| --- |
| DATABASE |
| SCHEMA |
| TABLESPACE |
| TABLE |
| COLUMN |
| FUNCTION |
| PROCEDURE |
| SEQUENCE |
| FOREIGN SERVER |
| LANGUAGE |

| 操作 | 客体 |
| --- | --- |
| CREATE | DATABASE, SCHEMA, TABLESPACE |
| ALTER | DATABASE, SCHEMA, TABLESPACE, TABLE, FUNCTION, PRODUCE, FOREIGN SERVER, DIRECOTRY, PACKAGE |
| DROP | DATABASE, SCHEMA, TABLESPACE, TABLE, FUNCTION, PRODUCE, FOREIGN SERVER, DIRECOTRY, PACKAGE |
| TRUNCATE | TABLE |
| VACUUM | TABLE |
| INDEX | TABLE |
| TRIGGER | TABLE |
| SELECT | TABLE, COLUMN, SEQUENCE |
| INSERT | TABLE, COLUMN |
| UPDATE | TTABLE, COLUMN, SEQUENCE |
| DELETE | TABLE |
| TEMPORARY | DATABASE |
| EXECUTE | FUNCTION, PROCEDURE, PACKAGE |

语法：

```sql
GRANTE <operate>
ON <object>
TO <subject>
WITH <option>

<operate>
    ALL [PRIVILEGES] | ALTER | DROP | INSERT | UPDATE | SELECT | DELETE | ..

<object>
    <object_type> <object_name>
<object_type>
    DATABASE | SCHEMA | TABLESPACE | TABLE | FUNCTION | PROCEDURE | ..

<subject>
    rolname | PUBLIC

<option>
    GRANT OPTION | ADMIN OPTION

GRANT rolname TO rolname;
```

```sql
REVOKE <operate>
ON <object>
FROM <subject>
```

访问控制的分类如下：

| 类型 | 缩写 | 解释 |
| --- | --- | --- |
| 自主访问控制 | DAC | 客体属主定义访问控制。客体存储权限列表 |
| 角色访问控制 | Role-BAC | 将主体划分为不同角色，对角色权限进行定义。主体存储权限列表 |
| 规则访问控制 | Rule-BAC | 比如防火墙 |
| 强制访问控制 | MAC | 基于主体和客体的安全级别标签，机密性场景下读上写，完整性场景上读下写 |

在postgresql中，默认支持自主访问控制和角色访问控制，可主动开启规则访问控制（行级访问控制）。访问控制基本概念如下：

-   主体：指用户和角色，但不知为何，角色和用户几乎是同一概念，可能是为了方便实现与管理
-   客体：指数据库对象，包括数据库、tablespace、表、列、行、函数等，每种客体都有对应的系统表，系统表中存储了所有客体的基本信息，包括ACL
-   操作：主体对客体的操作，主要有2类。第1类是对具体客体的操作，比如SELECT、UPDATE、INSERT等。第2类指其他如连接数据库、创建数据库、创建用户等操作，由系统表pg_authid控制

在postgresql中，先使用角色访问控制校验权限，如果校验失败，再使用自主访问控制校验权限。自主访问控制实现得较完整，因此，本文先介绍自主访问控制。

# 3 自主访问控制

## 3.1 自主访问控制的场景

假设场景：

-   1个集群中，有2个用户，分别是u1，u2
-   u1创建了1个表，叫t1
-   默认情况下，u2应该无法访问t1
-   但是，u1可通过自主访问控制功能，主动给u2权限，让u2可以访问t1

## 3.2 自主访问控制的使用

1.  创建主体  
    创建主体的语法示例如下：

    ```sql
    CREATE USER u1 PASSWORD 'u1@12345';
    CREATE USER u2 PASSWORD 'u2@12345';
    ```

2.  查看主体信息  
    主体信息存在2个系统表中，pg_authid中存储了所有主体的oid

    ```sql
    -- 查询系统表（PostgreSQL中，并未严格区分用户和角色的概念，因此，不用在意系统表和语法等取名差异）
    SELECT oid,rolname,rolpassword FROM pg_authid;
    oid   | rolename | rolpassword
    ------+----------+--------------
    16384 | u1       | md5.........
    16384 | u2       | md5.........

    -- 查询视图与查询pg_authid结果一致
    SELECT * FROM pg_roles;
    SELECT * FROM pg_user;
    ```

3.  创建客体  
    客体有多种，此处先以最常见的表为例。创建主体的语法示例如下：

    ```sql
    -- 记得切换到用户 u1
    \c - u1
    CREATE TABLE t1 (c1 INT);
    INSERT INTO t1 VALUES (3);
    ```

4.  查看客体信息，包括权限信息  
    不同客体由不同的系统表，这些系统表中均有ACL、客体属主这2个关键字段。ACL字段默认为空，在鉴权时，如果ACL为空，会认为属主有全部权限。属主即创建客体的用户。  
    查看表、表权限（哪些主体可以访问指定客体）的语法如下：

    ```sql
    -- 表
    SELECT oid,relname,relowner,relacl FROM pg_class WHERE relname = 't1';
    oid  | relname | relowner | relacl
    -------+---------+----------+--------
    16386 | t1      |    16384 |
    ```

5.  查看其他客体的信息，包括权限信息

    ```sql
    -- 数据库
    SELECT oid,datname,datdba,datacl FROM pg_database;
    oid  |  datname  | datdba |            datacl
    -------+-----------+--------+-------------------------------
    12295 | postgres  |     10 |

    -- 表空间
    SELECT oid,spcname,spcowner,spcacl FROM pg_tablespace;
    oid  |  spcname   | spcowner | spcacl
    ------+------------+----------+--------
    1663 | pg_default |       10 |

    -- 列
    SELECT attrelid,attname,attacl FROM pg_attribute;
    attrelid | attname | attacl
    ----------+---------+--------
        16386 | c1      |

    -- 其他客体不一一介绍，通过以下语法，可查询哪些客体的系统表有ACL字段
    SELECT attrelid::regclass,attname FROM pg_attribute WHERE attname LIKE '%acl%';
    ```

6.  验证访问控制功能  
    默认情况下，用户u1创建表t1，用户u2无法访问t1

    ```sql
    -- 切换到用户u2
    \c - u2
    SELECT * FROM t1;
    ERROR:  permission denied for relation t1
    ```

7.  设置访问控制功能

    ```sql
    -- u1给u2赋权后，u2将可以访问t1
    \c - u1
    GRANT SELECT ON t1 TO u2;

    -- 赋权后，系统表中，relacl字段，将会发生变化，如下所示，{u1=arwdDxt/u1,u2=r/u1}表示，u2具有read权限，read权限来自u1
    SELECT oid,relname,relowner,relacl FROM pg_class WHERE relname = 't1';
    oid  | relname | relowner |         relacl
    -------+---------+----------+-------------------------
    16386 | t1      |    16384 | {u1=arwdDxt/u1,u2=r/u1}
    ```

8.  验证访问控制功能

    ```sql
    -- 现在，u2有权限了
    \c - u2
    SELECT * FROM t1;
    ```

9.  清理

    ```sql
    DROP TABLE t1;
    DROP USER u1;
    DROP USER u2;
    ```

## 3.3 自主访问控制的实现

不同语法需要不同的访问权限，postgresql会自动根据语法和客体ACL校验权限，校验主要分为2个阶段：

1.  语义分析阶段，根据不同的SQL语法，识别主体、客体和操作，根据操作设置所需权限。比如，在’INSERT INTO t1 ..’语法，主体是执行SQL的当前用户，客体是t1，操作是INSERT，所需权限是ACL_INSERT权限；默认情况下，所需设置ACL_SELECT权限。
2.  初始化计划阶段，会从客体系统表中，读取ACL，判断主体所需权限是否满足ACL。比如，在’INSERT INTO t1 ..’语法中，客体是t1，客体系统表是pg_class，客体ACL是pg_class中的relacl字段。判断逻辑在下节介绍。

权限使用32位的位图表示：typedef uint32 AclMode;  
权限的类型有如下多种：

| 位数 | 取值 |
| --- | --- |
| 0-3 | ACL_INSERT ACL_SELECT ACL_UPDATE ACL_DELETE (对应 读、写、追加) |
| 4-7 | ACL_TRUNCATE ACL_REFERENCES ACL_TRIGGER ACL_EXECUTE |
| 8-11 | ACL_USAGE ACL_CREATE ACL_CREATE_TEMP ACL_CONNECT |
| 12-15 | not used (低16位表示权限) |
| 16-31 | (高16位表示组) |

-   ACL的格式  
    ACL本质是1个AclItem数组：[AclItem, AclItem, AclItem, ..]  
    AclItem格式如下：

    ```c
    typedef struct AclItem {
        Oid     ai_grantee; // 被授权者
        Oid	    ai_grantor; // 授权者
        AclMode ai_privs; // 权限，即表示ACL_INSERT、ACL_SELECT等权限
    } AclItem;
    ```

-   调用栈

    ```c
    PostmasterMain
        ServerLoop
            BackendStartup
                BackendRun
                    PostgresMain
                        exec_simple_query
                            PortalRun
                                PortalRunMulti
                                    ProcessQuery
                                        InitPlan
                                            ExecCheckRTPerms(rtes)
                                                ExecCheckRTEPerms(rte)
                                                    GetUserId
                                                    pg_class_aclmask
                                                        1. 从pg_class中，获取客体acl数组，如果客体acl为空，默认为owner可读写
                                                        aclmask
                                                            2. 从pg_auth_members中，找到主体都属于哪些group
                                                            3. 判断group权限：如果主体是member of owner，则主体有权限
                                                            4. 判断role权限：遍历客体acl数组，如果主体是客体acl数组中的一员，则主体有权限
    ```

-   表的ACL

    -   ACL：在pg_class中，如果a创建1个表，则表默认的acl是：

        ```bash
         relname | relowner | relack
        ---------+----------+---------
         t1      | oid_a    |
        ```

    -   默认ACL：如果ACL为空，则默认ACL是：[{ownerid, ownerid, INSERT SELECT UPDATE DELETE RUNCATE REFERENCES TRIGGER}]

参考：

-   libpq通信协议：[https://zhuanlan.zhihu.com/p/379188039](https://zhuanlan.zhihu.com/p/379188039)

# 4 角色访问控制

## 4.1 角色访问控制的场景

假设场景：

-   1个公司，有1个部门，分别是p1
-   1个集群中，有2个用户，分别是u1，u2，同属于部门p1
-   u1创建了1个表，叫t1_p1，u1想让部门p1的所有用户，都有权限访问t1_p1

## 4.2 角色访问控制

本文第3章已介绍过自主访问控制，此处很多步骤就不解释了

1.  创建主体

    ```sql
    CREATE USER u1 PASSWORD 'u1@12345';
    CREATE USER u2 PASSWORD 'u2@12345';
    ```

2.  查看主体角色关系

    ```sql
    SELECT oid,rolname FROM pg_authid WHERE rolname in ('u1', 'u2');
      oid  | rolname
    -------+---------
     16398 | u1
     16399 | u2

    -- pg_auth_members中存储了主体之间的组关系（默认有3条记录，系统自带的，忽略）
    SELECT * FROM pg_auth_members;
     roleid | member | grantor | admin_option
    --------+--------+---------+--------------
       3374 |   3373 |      10 | f
       3375 |   3373 |      10 | f
       3377 |   3373 |      10 | f
    ```

3.  创建客体

    ```sql
    \c - u1
    CREATE TABLE t1 (c1 INT);
    INSERT INTO t1 VALUES (3);
    ```

4.  验证访问控制功能

    ```sql
    -- 默认情况下，u2无权访问t1
    \c - u2
    SELECT * FROM t1;
    ERROR:  permission denied for relation t1
    ```

5.  设置访问控制功能

    ```sql
    \c - u1
    GRANT u1 TO u2;

    -- 查询结果中，第4条记录，表示u2属于u1这个组
    SELECT * FROM pg_auth_members;
     roleid | member | grantor | admin_option
    --------+--------+---------+--------------
       3374 |   3373 |      10 | f
       3375 |   3373 |      10 | f
       3377 |   3373 |      10 | f
      16398 |  16399 |   16398 | f
    ```

6.  验证访问控制功能

    ```sql
    \c - u2
    SELECT * FROM t1;
    ```

7.  复杂的访问控制功能

    ```sql
    -- 初始用户
    CREATE USER u3 PASSWORD 'u3@12345';

    -- u2把角色传递给u3
    \c - u2
    GRANT u2 TO u3;

    /* 此时，角色的传递模型如下：
          [u1] --> [u2] --> [u3]

        u1创建表，u3可访问
        u3创建表，u1不可访问
     */

    -- 角色正向传递：u3也可以访问t1了
    -- 检查u3是否可访问时，检查权限的链表是： u3 <-- u2 <-- u1
    \c - u3
    SELECT * FROM t1;

    SELECT * FROM pg_auth_members;
     roleid | member | grantor | admin_option
    --------+--------+---------+--------------
       3374 |   3373 |      10 | f
       3375 |   3373 |      10 | f
       3377 |   3373 |      10 | f
      16398 |  16399 |   16398 | f
      16399 |  16403 |   16399 | f -- 16403 是 u3的oid

    -- 角色反向传递：u3创建表，u1不可访问
    \c - u3
    CREATE TABLE t3 (c1 INT);
    INSERT INTO t3 VALUES (3);

    \c - u1
    SELECT * FROM t1;
    ERROR:  permission denied for relation t3
    ```

# 5 规则访问控制（集群访问控制）

## 5.1 集群访问控制的场景

## 5.2 集群访问控制的使用

```sql
select * from pg_authid;
       rolname        | rolsuper | rolinherit | rolcreaterole | rolcreatedb | rolcanlogin | rolreplication | rolbypassrls | rolconnlimit |  rolpassword | rolvaliduntil
----------------------+----------+------------+---------------+-------------+-------------+----------------+--------------+--------------+--------------+---------------
 shenkun              | t        | t          | t             | t           | t           | t              | t            |           -1 |              |
 pg_monitor           | f        | t          | f             | f           | f           | f              | f            |           -1 |              |
 pg_read_all_settings | f        | t          | f             | f           | f           | f              | f            |           -1 |              |
 pg_read_all_stats    | f        | t          | f             | f           | f           | f              | f            |           -1 |              |
 pg_stat_scan_tables  | f        | t          | f             | f           | f           | f              | f            |           -1 |              |
 pg_signal_backend    | f        | t          | f             | f           | f           | f              | f            |           -1 |              |
 u1                   | f        | t          | f             | f           | t           | f              | f            |           -1 | md5..        |
```

# 6 规则访问控制（行级访问控制）

## 6.1 行级访问控制的场景

## 6.2 行级访问控制的使用

```sql
CREATE USER u1 PASSWORD 'pg@12345';
CREATE USER u2 PASSWORD 'pg@12345';

\c - u1
CREATE TABLE t1 (c1 INT);
-- 开启行级自主访问控制
ALTER TABLE t1 ENABLE ROW LEVEL SECURITY;
INSERT INTO t1 VALUES (1), (3), (5);
GRANT SELECT,INSERT ON t1 TO u2;

\c - u2
SELECT * FROM t1;
-- 结果：查询到 0 条数据

\c - u1
CREATE POLICY p1 ON t1 FOR SELECT TO u2 USING (c1 <= 3);

\c - u2
SELECT * FROM t1;
-- 结果：查询到数据{1, 3}，未查询到数据{5}

EXPLAIN SELECT * FROM t1;
                     QUERY PLAN
-----------------------------------------------------
 Seq Scan on t1  (cost=xx)
   Filter: (c1 <= 3)

-- 查询pg_policy系统表，可获取过滤规则
SELECT * FROM pg_policy;
 polname | polrelid | polcmd | polpermissive | polroles | polqual
---------+----------+--------+---------------+----------+-------------------------------------------------
 p1      |    16412 | r      | t             | {16408}  | {OPEXPR :opno 523 :opfuncid 149 :opresultt ...}

-- 查询pg_policy系统试图，可获取较直观的过滤规则
SELECT * FROM pg_policies;
 schemaname | tablename | policyname | permissive | roles |  cmd   |   qual    | with_check
------------+-----------+------------+------------+-------+--------+-----------+------------
 public     | t1        | p1         | PERMISSIVE | {u2}  | SELECT | (c1 <= 3) |

\c - u1
CREATE POLICY p2 ON t1 FOR INSERT TO u2 WITH CHECK (c1 <= 10);

INSERT INTO t1 VALUES (7);
```

# 参考

-   postgresql 10.0.0版本源代码
-   访问控制分类：[https://zhuanlan.zhihu.com/p/151618654](https://zhuanlan.zhihu.com/p/151618654)
-   pg ACL概念：[https://www.jianshu.com/p/15262ca1740c](https://www.jianshu.com/p/15262ca1740c)
-   pg 行级访问控制的使用方式：[https://zhuanlan.zhihu.com/p/649711345](https://zhuanlan.zhihu.com/p/649711345)
