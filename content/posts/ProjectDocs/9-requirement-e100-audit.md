+++
title = '海量 9 需求 E100审计'
date = '2025-07-18T10:50:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['审计', '需求文档']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 简介

## 1.1 目的

审计是重要的安全特性，功能是收集数据库内的事件，例如创建对象、查询数据等，根据事件生成与存储审计日志，并向用户提供查询审计日志的接口。

在303.7版本，E100首次引入审计特性，本文介绍E100审计特性的对外接口、功能约束、使用方式等信息。

## 1.2 适用范围

E100，303.7及之后的版本

## 1.3 术语定义、首字母缩写词和缩略语

无

## 1.3 参考资料

-   G100审计特性：[https://docs.vastdata.com.cn/zh_CN/VastbaseG100/V3.0.8/1/2f4fb0e4adcc49f8b19dd4710f2a6549](https://docs.vastdata.com.cn/zh_CN/VastbaseG100/V3.0.8/1/2f4fb0e4adcc49f8b19dd4710f2a6549)
-   Oracle审计特性：[https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/part_6.html](https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/part_6.html)
-   开源组件pgaudit：[https://www.modb.pro/db/105894](https://www.modb.pro/db/105894)
-   G100审计重构方案：[https://doc.weixin.qq.com/doc/w3_AdwAfAa7AFkCNFLkO0AXJSUK7CICd?scode=AHUAfwdSAA8DKRU1G1AdwAfAa7AFk&version=4.1.38.6011&platform=win](https://doc.weixin.qq.com/doc/w3_AdwAfAa7AFkCNFLkO0AXJSUK7CICd?scode=AHUAfwdSAA8DKRU1G1AdwAfAa7AFk&version=4.1.38.6011&platform=win)
-   pg 14完整语法：[https://www.postgresql.org/docs/14/sql-commands.html](https://www.postgresql.org/docs/14/sql-commands.html)

# 2 E100审计特性

## 2.1 功能简述

【审计特性】  
审计特性，主要功能是记录数据库内的各种事件，并向用户提供查询事件的接口。事件包括：

-   启动、恢复、切换、停止集群
-   登录、注销账号
-   创建、修改、删除数据库对象，包括：DATABASE、SCHEMA、TABLE等
-   插入、更新、删除、查询关系表
-   …

【审计事件】  
数据库内发生的事件，都可描述为<主体><操作><客体>

-   主体：一般是数据库用户
-   客体：集群、账号、数据对象等
-   操作：针对不同客体，操作类型不一样。比如，对于TABLE，操作类型有：CREATE, INSERT, SELECT等。

【审计日志】  
发生事件时，审计特性会收集事件中的信息，将事件封装审计日志，审计日志中的关键内容包括：

-   主体信息：用户名
-   操作信息：操作类型、操作时间、操作的SQL语句等
-   客体信息：客体类型、客体名称、客体属于哪个database、客体属于哪个schema

【审计流程】  
使用审计特性时，主要包括以下几个流程：

1.  配置审计功能：用户提前配置审计范围，即配置哪些事件需被审计。
2.  生成审计日志：用户操作数据库时，产生审计事件，例如创建表、删除表等。内核收集事件信息，生成审计日志。
3.  存储审计日志：内核存储审计日志至磁盘。
4.  查询审计日志：用户查询审计日志，内核从磁盘读取审计日志。
5.  删除审计日志

一个简单示例如下图所示：

```sql
-- 1. 配置审计功能：确定哪些事件需审计
-- 2. 生成审计日志：用户执行SQL，产生事件<用户><创建><表>，根据事件生成日志
CREATE TABLE t1 (c1 INT, c2 TEXT);
-- 3. 存储审计日志：内核自动存储日志
-- 4. 查询审计日志
SELECT * FROM pg_audit_log();
    -- 预期输出（横向输出）
    -[ RECORD 1 ]---------------------------------
    scope    |
    subject  | u1 -- 主体信息：用户名
    optype   | create -- 操作信息：create操作
    optime   | 2025-07-18 18:15:17.400009+08 -- 操作时间
    opresult |
    object   | table -- 客体信息：客体类型
    objdb    | postgres -- 客体信息：客体属于哪个database
    objnsp   | public -- 客体信息：客体属于哪个schema
    objname  | t1 -- 客体信息：客体名称
    opxid    |
    optid    |
    pid      |
    sql      | create table t1(c1 int); -- 触发操作的SQL
    extra    |
```

【友商对比】  
对比oracle、opengauss/g100、pgaudit

-   oracle
    1.  配置审计功能：通过SQL语法配置，可按照权限、操作、对象、角色进行配置

        ```sql
        CREATE AUDIT POLICY ap1
            PRIVILEGES privilege [ , privilege ..] -- privilege 子句，内置权限有200多种，示例：CREATE TABLE, ALTER USER
            ACTIONS action [ , action ..]          -- aciton 子句，示例：SELECT,ALTER,DROP 。操作+对象组合，共有1900+
            ON object [ , object ..]               -- object 子句
            ROLES role [ , role ..]                -- role 子句
        ```

    2.  查询审计日志：通过视图查询，视图共80+列。此处列举常用输出：

        ```sql
        SELECT * FROM UNIFIED_AUDIT_TRAIL;
            -- 时间戳
            -- 事件id
            -- 主体相关：用户名、客户端程序、操作系统用户、客户端主机、客户端IP、认证方式、认证数据等
            -- 操作相关：事务ID、操作类型、原始SQL、返回码等
            -- 客体相关：对象名、对象SCHEMA、对象类型、对象版本等
        ```

    3.  存储审计日志：存储于SYSAUX表空间，按表的格式存储。
    4.  删除审计日志：通过函数删除，先设置归档时间，再根据归档时间删除日志

        ```sql
        -- 主动删除
        DBMS_AUDIT_MGMT.SET_LAST_ARCHIVE_TIMESTAMP(
            ..
            last_archive_time => TO_TIMESTAMP('2024-06-01 00:00:00', 'YYYY-MM-DD HH24:MI:SS')
        )
        DBMS_AUDIT_MGMT.CLEAN_AUDIT_TRAIL(
            ..
            use_last_arch_timestamp => TRUE
        )
        -- 自动删除：创建自动清理任务，定时清理
        ```

-   opengauss/g100
    1.  配置审计功能：传统审计通过GUC配置，统一审计通过SQL配置  
        传统审计：

        ```sql
        -- 主体
        audit_user          对白名单内的用户进行审计
        full_audit_users    对白名单内的用户的所有操作进行审计
        no_audit_client     对黑名单内的IP的用户不审计
        -- 操作
        audit_copy_exec     是否审计 COPY
        audit_dml_state     是否审计 INSERT、UPDATE、DELETE
        audit_dml_state_select 是否审计 SELECT
        audit_set_parameter    是否审计 SET
        audit_user_violation   是否越权操作
        audit_operation_result 只记录操作：成功、失败、成功和失败 的日志
        audit_transcation    是否审计TANSCATITON：提交、回滚
        audit_login_logout    审计CLUSTER：{登录、注销} x {成功、失败}
        audit_user_locked    是否审计USER：锁定、解锁
        audit_grant_revoke    是否审计USER：赋权、收权
        audit_network_error    是否审计网络连接错误
        audit_query_cancel     是否审计用户取消SELECT操作
        audit_insufficient_space    是否记录SPACE：达到限额
        audit_tool_error       是否审计 vb_dump、vb_dumpall、vb_restore 的异常
        -- 客体
        audit_system_object    审计OBJECT的范围：DATABASE、SCHEMA、TABLE、…等DDL操作
        audit_database_process    是否审计CLUSTER：启动、停止、切换和恢复
        audit_function_exec    是否审计FUNCTION：执行
        audit_systerm_function_exec    是否审计FUNCTION：执行（内核写了一个白名单，共61个，例如pg_stat_activity，pg_switch_xlog等）
        audit_sequence_enabled    是否审计语句序列
        audit_crypt_func    是否审计FUNCION （密码运算函数）
        audit_security_policy    是否审计POLICY
        ```

        统一审计：首先，创建资源标签。然后，根据资源标签进行审计。可按照操作、对象、用户、IP等配置。

        ```sql
        -- 创建资源标签（对象组）：对象类型包括：TABLE,COLUMN,SCHEMA,VIEW,FUNCTION
        CREATE RESOURCE LABEL label_name ADD label_item_list [, ...];
        -- 设置审计策略：
        CREATE AUDIT POLICY policy_name
            PRIVILEGES { DDL | ALL } -- DDL操作类型
                ON LABEL resource_label_name [, ... ] -- 对象
            ACCESS { DML | ALL }  -- DML操作类型
                ON LABEL resource_label_name [, ... ] -- 对象
            FILTER ON FILTER_TYPE filter_value [, ... ] -- 过滤类型：用户、IP等

            -- DDL: ALTER | ANALYZE | COMMENT | CREATE | DROP | GRANT | REVOKE | SET | SHOW
            -- DML: COPY | DEALLOCATE | DELETE_P | EXECUTE | REINDEX | INSERT | PREPARE | SELECT | TRUNCATE | UPDATE
            -- FILTER_TYPE: APP | ROLES | IP | TIME_PERIOD
        ```

    2.  查询审计日志：通过函数在线查询

        ```sql
        SELECT * FROM pg_query_audit(begintime, endtime);
            -- time
            -- 主体信息：用户id，用户名，客户端信息，节点，线程id，本地端口，远端端口
            -- 操作信息：操作类型、操作结果、权限、SQL语句
            -- 客体信息：database，客体名，详细信息
            -- 其他：审计日志sm3 hash，hash校验结果
        ```

    3.  存储审计日志：存储在指定目录下，按二进制格式存储

        ```sql
        show audit_directory;
        ```

    4.  删除审计日志：通过时间、空间限制，自动删除，或者通过函数主动删除。

        ```sql
        -- 自动删除：按时间或总空间保留日志，旧日志被覆盖
        audit_resource_policy
        audit_file_remain_time;
        audit_space_limit;

        -- 主动删除：通过函数删除
        SELECT pg_delete_audit(begintime, endtime);
        ```

-   pgaudit
    1.  配置审计功能：通过GUC参数配置。只能按照操作进行配置。

        ```sql
        ALTER SYSTEM SET pgaudit.log TO 'all, read, write, function, role, ddl, misc'
        -- read：SELECT等
        -- write: INSERT、DELETE、UPDATE、TRUNCATE、COPY等
        -- misc: FETCH, CHECKPOINT等
        ```

    2.  查看审计日志：只能在pg_log中查询日志，一行日志示例：

        ```bash
        AUDIT: SESSION,1,1,DDL,CREATE TABLE,TABLE,public.t1,create table t1(
        id int,
        name text);
        ```

    3.  存储审计日志：复用运行日志的存储功能，在pg_log中存储
    4.  删除审计日志：不提供

## 2.2 功能说明

### 2.2.1 使用流程

E100审计的关键设计如下：

1.  配置审计特性：参考pgaudit，通过GUC参数配置，按操作类型配置审计范围
2.  存储审计日志：参考vastbase g100，生成日志后，将其存储在用户配置的目录下，文件格式为二进制格式
3.  查看审计日志：参考vastbase g100，通过在线函数查询，或者通过工具离线将日志文件转换为普通log文件
4.  删除审计日志：自动覆盖旧文件，或主动通过函数删除

#### 场景一、配置审计特性

1.  熟悉审计配置参数

    | 编号 | 参数名 | 默认值 | 取值范围 | 级别 | 功能 |
    | --- | --- | --- | --- | --- | --- |
    | 1 | enable_audit | off | on, off | postmaster | 控制是否开启审计功能 |
    | 2 | aduit_directory | 空 | 任意绝对路径 | postmaster | 审计日志存储目录。如果取值为空，则默认存储于”数据目录/vb_audit_log”下 |
    | 3 | audit_directory_size | 128M | [64M, -] | postmaster | 审计日志目录最大空间，如果文件目录达到限制时，最旧的日志文件将被新文件覆盖 |
    | 4 | audit_scope | ddl,dcl | all,ddl,dcl,dml,dql,tcl,func,mng,misc | sighup | 审计范围。可设置多个范围，示例：”ddl,dcl,dml” |
    | 5 | audit_buffer_size | 16M | [1M, 1G] | postmaster | 内存中，审计日志缓冲区大小 |

2.  开启审计特性

    ```bash
    gs_guc set -D $DATA_DIR -c "enable_audit=on"
    ```

3.  设置审计范围

    ```sql
    -- 首先，查看可设置的审计范围：
    SELECT * FROM pg_audit_scope();
        -- 预期输出：
        scope_type |                           operates
        -----------+----------------------------------------------------------------------
         ddl       | create,alter,drop,truncate,prepare,deallocate
         dcl       | grant,revoke,create user,alter user,drop user
         dml       | insert,update,delete,copy,merge,lock
         dql       | select
         tcl       | begin,start,commit,end,rollback,savepoint
         func      | do,execute
         mng       | set,show,vacuum,analyze,checkpoint,reindex,cluster,refresh,explian,load
         misc      | fetch,move

    -- 然后，设置审计范围
    ALTER SYSTEM SET audit_scope TO 'ddl,dcl,dml'

    -- 其他：只要开启审计，启动、停止集群，登录、登出用户，都会被审计，不受参数控制。（oracle也有很多必须审计的事件）
    ```

    -   pg 14完整语法：[https://www.postgresql.org/docs/14/sql-commands.html](https://www.postgresql.org/docs/14/sql-commands.html)

### 场景二、生成审计日志

事件由SQL语句触发，执行SQL时，内核会自动生成审计日志。

1.  执行DDL

    ```sql
    CREATE TABLE t1 (c1 INT, c2 TEXT);
    ```

2.  查看审计日志

    ```sql
    SELECT * FROM pg_audit_log();

        -- 预期输出（设置\x）
        -[ RECORD 1 ]---------------------------------
        scope    | ddl
        subject  | u1     -- 主体信息：用户名
        optype   | create -- 操作信息：操作类型
        optime   | 2025-07-18 18:15:17.400009+08 -- 操作信息：操作时间
        opresult |          -- 操作结果：取值为 空 或 fail；目前，失败场景只支持：检查用户表权限失败、登录失败
        object   | table    -- 客体信息：客体类型
        objdb    | postgres -- 客体信息：客体database
        objnsp   | public   -- 客体信息：客体schema
        objname  | t1       -- 客体信息：客体名
        opxid    |          -- 操作信息：本事务最近一次xid操作
        optid    |          -- 操作信息：写操作时产生的事务id
        pid      | 31648    -- 主体信息：操作的进程id
        sql      | create table t1(c1 int); -- 原始SQL语句
        extra    |          -- 其他信息：暂时保留，可能存储报错信息
    ```

3.  执行DCL  
    如果`CREATE USER/ALTER USER`语法中，包含密码，SQL语句中的密码会被替换为\*号（需要根据password关键字识别）。

    ```sql
    CREATE USER u1 PASSWORD 'u1.password';
    GRANT ALL ON SCHEMA public TO u1;

    SELECT optype,object,objdb,objnsp,objname,sql FROM pg_audit_log(now() - interval'10s', null);
         optype | object | objdb    | objnsp | objname |                  sql
        --------+--------+----------+--------+---------+----------------------------------------
         create | user   |          |        | u1      | CREATE USER u1 PASSWORD '***********';
         grant  | schema | postgres |        | public  | GRANT ALL ON SCHEMA public TO u1;
    ```

4.  执行DML  
    约束：不支持审计系统表、系统视图

    ```sql
    INSERT INTO t1 VALUES (1, 'data1');

    SELECT optype,object,objdb,objnsp,objname,sql FROM pg_audit_log(now() - interval'10s', null);
         optype | object | objdb    | objnsp | objname |                  sql
        --------+--------+----------+--------+---------+----------------------------------------
         insert | table  | postgres | public | t1      | INSERT INTO t1 VALUES (1, 'data1');
    ```

5.  执行FUNC  
    约束：不支持审计系统函数（简单的操作符，=，<,>,等，实际都是函数）

    ```sql
    CREATE OR REPLACE FUNCTION my_concat(text1 text, text2 text) RETURNS text AS $$ SELECT text1 || text2; $$ LANGUAGE sql IMMUTABLE;

    SELECT my_concat('abc', 'efg');

    SELECT optype,object,objdb,objnsp,objname,sql FROM pg_audit_log(now() - interval'10s', null);
         optype  | object   | objdb    | objnsp | objname   |                  sql
        ---------+----------+----------+--------+-----------+----------------------------------------
         execute | function | postgres | public | my_concat | SELECT my_concat('abc', 'efg');
    ```

6.  执行MNG

    ```sql
    VACUUM;

    SELECT optype,object,objdb,objnsp,objname,sql FROM pg_audit_log(now() - interval'10s', null);
         optype  | object   | objdb    | objnsp | objname   |                  sql
        ---------+----------+----------+--------+-----------+----------------------------------------
         vacuum  |          | postgres |        |           | VACUUM;
    ```

7.  执行DDL与DML

    ```sql
    CREATE TABLE t2 AS SELECT * FROM t1;

    SELECT optype,object,objdb,objnsp,objname,pid,sql FROM pg_audit_log(now() - interval'10s', null);
         optype | object | objdb    | objnsp | objname | pid  |                  sql
        --------+--------+----------+--------+---------+------+----------------------------------
         create | table  | postgres | public | t2      | 1399 | CREATE TABLE t2 AS SELECT * FROM t1;
         select | table  | postgres | public | t1      | 1399 | (repeat)
    ```

8.  执行DML与FUNC

    ```sql
    INSERT INTO t2 VALUES (1, my_concat('abc', 'efg'));

    SELECT optype,object,objdb,objnsp,objname,sql FROM pg_audit_log(now() - interval'10s', null);
         optype  | object    | objdb    | objnsp | objname   | pid  |                  sql
        ---------+-----------+----------+--------+-----------+------+----------------------------------
         execute | function  | postgres | public | my_concat | 1399 | CREATE TABLE t2 AS SELECT * FROM t1;
         select  | table     | postgres | public | t1        | 1399 | (repeat)
    ```

9.  执行DDL、DML、FUNC
    -   约束：不支持审计在DDL语句中的函数（实现麻烦，pgaudit也有该问题，需要再研究下，不一定来得及）

        ```sql
        CREATE TABLE t3 AS SELECT c1,my_concat(c2, '_t3') FROM t1;

        SELECT optype,object,objdb,objnsp,objname,sql FROM pg_audit_log(now() - interval'10s', null);
             optype | object | objdb    | objnsp | objname | pid  |                  sql
            --------+--------+----------+--------+---------+------+----------------------------------
             create | table  | postgres | public | t3      | 1399 | CREATE TABLE t3 AS SELECT c1,my_concat(c2, '_t3') FROM t1;
             select | table  | postgres | public | t1      | 1399 | (repeat)
        ```

10.  必须审计的内容
     -   启动、停止集群
     -   登录、登出用户
11.  其他操作  
     操作类型与客体类型较多，此处不一一列举。  
     操作类型：

     ```sql
     CREATE, ALTER, DROP, TRUNCATE
     GRANT, REVOKE, CREATE USER, ALTER USER, DROP USER
     INSERT, UPDATE, DELETE, COPY, MERGE, LOCK
     SELECT
     BEGIN, START, COMMIT, END, ROLLBACK, SAVEPOINT
     DO, EXECUTE
     SET, SHOW, VACUUM, ANALYZE, CHECKPOINT, REINDEX, CLUSTER, REFRESH, EXPLAIN, LOAD
     FETCH, MOVE
     ```

     客体类型包括：

     ```sql
     DATABASE, SCHEMA, TABLE SPACE, TABLE, INDEX, VIEW, MATERIALIZED VIEW, SEQUENCE
     ROLE, USER, GROUP
     FUNCTION, PROCEDURE, TRIGGER
     RULE, TYPE, DOMAIN, EXTENSION, FOREIGN DATA WRAPPER, SERVER, USER MAPPING, FOREIGN TABLE, PUBLICATION, COLLATION, CONVERSION
     AGGREGATE, CAST, POLICY, STATISTICS, ACCESS METHOD, LANGUAGE, OPERATOR, ...
     ```

     风险：部分DDL太复杂，客体名可能解析不完全，不过会保留原始SQL语句，不影响业务。

#### 场景三、查询审计日志

1.  设置查询权限  
    以下2种角色，可查询日志：
    -   superuser：包括初始用户。
    -   pg_monitor: pg_monitor是内置角色，查询具有该角色的用户。

        ```sql
        -- 查看哪些用户时superuser
        SELECT rolsuper FROM pg_authid

        -- 将pg_monitor角色赋予普通用户
        GRANT pg_monitor TO $user;

        -- 查看哪些用户具有pg_monitor角色
        SELECT pg_get_userbyid(roleid) FROM pg_auth_members WHERE member = (SELECT oid FROM pg_authid WHERE rolname = 'pg_monitor')
        ```

2.  在线查询pg_audit_query()  
    查询所有日志

    ```sql
    SELECT * FROM pg_audit_query();

        -- 预期输出（设置\x）
        -[ RECORD 1 ]---------------------------------
        scope    | ddl
        subject  | u1     -- 主体信息：用户名
        optype   | create -- 操作信息：操作类型
        optime   | 2025-07-18 18:15:17.400009+08 -- 操作信息：操作时间
        opresult |          -- 操作结果：取值为 空 或 fail；目前，失败场景只支持：检查用户表权限失败
        object   | table    -- 客体信息：客体类型
        objdb    | postgres -- 客体信息：客体database
        objnsp   | public   -- 客体信息：客体schema
        objname  | t1       -- 客体信息：客体名
        opxid    |          -- 操作信息：本事务最近一次xid操作
        optid    |          -- 操作信息：写操作时产生的事务id
        pid      | 31648    -- 主体信息：操作的进程id
        sql      | create table t1(c1 int); -- 原始SQL语句
        extra    |          -- 其他信息：暂时保留，可能存储报错信息
    ```

3.  在线查询pg_audit_query(timestamptz begtime, timestamptz endtime)  
    按时间查询日志

    ```sql
    SELECT * FROM pg_audit_query('2020-01-01 08:00:00', NOW());
    SELECT * FROM pg_audit_query(null, '2025-01-01 08:00:00');
    ```

4.  离线查询audit_tool

    ```sql
    -- 查看审计目录
    show audit_direcotory;
    ```

    离线解析日志

    ```bash
    # 1 查看日志文件
    ll $audit_direcotory
        adt_2025_0718_1815_05_054161.blog
        adt_2025_0718_1903_21_389583.blog
        adt_2025_0718_1908_48_355815.blog
        adt_2025_0718_2030_01_938610.blog
        # 命名： adt_年_月日_时分_秒_微秒.blog
        # 格式： 二进制（主要是：时间、操作类型、客体类型等不是字符串）

    # 2 解析单个日志文件
    audit_tool decode -f /data/pg_audit/adt_2025_0718_1815_05_054161.log -o adt_2025_0718_1815_05_054161.log
        # 解码后的单条日志：
        # 2025/07/18 18:15:17 400009 ddl shenkun create table postgres.public.t1 0,0 create table t1(c1 int);,-

    # 3 解析日志文件夹
    audit_tool decode -d /data/pg_audit/ -o ./decoded_log/
    ```

#### 场景四、删除审计日志

1.  自动删除日志文件

    ```sql
    -- 当审计目录下，总文件大小达到阈值时，最旧的文件将被覆盖
    show audit_direcotry_size;
    ```

2.  主动删除日志

    ```sql
    SELECT pg_delete_audit_log('2020-01-01 08:00:00', '2021-01-01 08:00:00');

    -- 预期：再次查询该之间范围内的日志，查询结果为空
    ```

3.  离线删除日志文件

    ```sql
    rm -f /data/pg_audit/adt_2025_0718_1815_05_054161.log
    ```

#### 场景五、异常场景

1.  配置异常  
    如果配置异常，会导致数据库无法启动

    | 编号 | 参数名 | 默认值 | 取值范围 | 级别 | 功能 |
    | --- | --- | --- | --- | --- | --- |
    | 1 | enable_audit | off | on, off | postmaster | 控制是否开启审计功能 |
    | 2 | aduit_directory | 空 | 任意绝对路径 | postmaster | 审计日志存储目录。如果取值为空，则默认存储于”数据目录/vb_audit_log”下 |
    | 3 | audit_directory_size | 128M | [64M, -] | postmaster | 审计日志目录最大空间，如果文件目录达到限制时，最旧的日志文件将被新文件覆盖 |
    | 4 | audit_scope | ddl,dcl | all,ddl,dcl,dml,dql,tcl,func,mng,misc | sighup | 审计范围。可设置多个范围，示例：”ddl,dcl,dml” |
    | 5 | audit_buffer_size | 16M | [1M, 1G] | postmaster | 内存中，审计日志缓冲区大小 |

2.  运行异常

    | 异常场景 | 描述 | 预期结果 |
    | --- | --- | --- |
    | 进程异常 | kill 审计进程 | 自动重启进程，不影响业务，日志不丢失 |
    | 文件异常 | audit_direcotry运行时异常 | 审计功能异常，无法记录审计日志，不影响业务 |
    | 文件异常 | audit log已写完文件丢失 | 查询日志时，缺少部分日志，影响不大 |
    | 文件异常 | audit log正在写文件丢失 | 自动重新创建文件，不影响业务 |

### 2.2.2 配置参数和文件

新增5个GUC参数

| 编号 | 参数名 | 默认值 | 取值范围 | 级别 | 功能 |
| --- | --- | --- | --- | --- | --- |
| 1 | enable_audit | off | on, off | postmaster | 控制是否开启审计功能 |
| 2 | aduit_directory | 空 | 任意绝对路径 | postmaster | 审计日志存储目录。如果取值为空，则默认存储于”数据目录/vb_audit_log”下 |
| 3 | audit_directory_size | 128M | [64M, -] | postmaster | 审计日志目录最大空间，如果文件目录达到限制时，最旧的日志文件将被新文件覆盖 |
| 4 | audit_scope | ddl,dcl | all,ddl,dcl,dml,dql,tcl,func,mng,misc | sighup | 审计范围。可设置多个范围，示例：”ddl,dcl,dml” |
| 5 | audit_buffer_size | 16M | [1M, 1G] | postmaster | 内存中，审计日志缓冲区大小 |

### 2.2.3 数据相关性

日志文件夹：由audit_directory参数配置，默认在`数据目录/vb_audit_log`

## 2.3 接口信息

新增4个函数

```sql
-- 查看可选审计范围
pg_audit_scope()

-- 查看审计日志
pg_audig_log()
pg_audig_log(timestamptz begtime, timestamptz endtime)

-- 删除审计日志
pg_delete_audit_log(timestamptz begtime, timestamptz endtime)
```

新增1个工具

```bash
audit_tool -h
# 输出如下：
audit_tool is a utility to process audit log.

usage:
   audit_tool decode [options]
   audit_tool print  [options]

[options] could be:
   -h,-?, --help                show this help, then exit
   -v, --version                show the version of this tool, then exit
   -d, --direcotry=LOG_DIR      directory of audit logs
   -f, --file=LOG_FILE          audit log file
   -o, --output=DIR_OR_FILE     used with the --direcotry or --file parameter
   -b, --begin-time=BEGIN_TIME  the earliest audit log, format example: '2020/01/01 12:00:00'
   -e, --end-time=END_TIME      the latest audit log

1. command to decode directory:
   audit_tool decode -d LOG_DIR [-o OUTPUT_DIR] [-b BEGIN_TIME] [-e END_TIME]
2. command to decode file:
   audit_tool decode -f LOG_FILE [-o OUTPUT_FILE] [-b BEGIN_TIME] [-e END_TIME]
```

## 2.4 正反向行为

### 2.4.1 生效说明

1.  查看是否开启审计功能

    ```sql
    show enable_audit;
    ```

2.  查看审计范围

    ```sql
    show audit_scope;
    ```

3.  查询审计日志

    ```sql
    SELECT * FROM pg_audit_log();
    ```

### 2.4.2 提示信息

1.  查询审计日志  
    无权限时，提示需`grant pg_monitor to current user`

### 2.4.3 约束和依赖

1.  审计范围：不支持审计系统表、系统视图、系统函数
2.  审计目录：audit_direcotry取值需为绝对路径(默认值vb_audit_log除外)
3.  日志存储：不支持同步落盘审计日志，即发生断电等异常时，可能丢失部分未及时落盘的日志(优先保证性能)
4.  审计日志：1条SQL语句，最多生成100条审计日志

## 2.5 安全性

### 2.5.1 权限控制

1.  查询日志：具有superuser或pg_monitor角色时，才可调用查询日志的函数

### 2.5.2 审计

无

## 2.6 影响范围

### 2.6.1 对已有UDT,UDF, ECPG的影响

无

### 2.6.2 对系统函数的影响

新增4个系统函数，已介绍

### 2.6.3 对系统CATALOG的影响

无

### 2.6.4 对xlog日志格式、数据格式的影响

无

### 2.6.5 与其他功能交互时的行为表现

无

### 2.6.6 版本兼容性

无

## 2.7 指标相关

### 2.7.1 关键资源指标

-   CPU：开启审计后，执行审计范围内的SQL，都有可能生成审计日志
-   内存：占用共享内存，由audit_buffer_size配置
-   进程：新增1个进程，负责将审计日志落盘
-   网络：无
-   外存：占用外存，由audit_direcotry_size配置

### 2.7.2 系统性指标

无

### 2.7.3 性能指标

性能指标：

-   audit_scope取值为ddl,dcl时，与不开审计相比，tpcc性能劣化在5%以内
-   audit_scope取值为all，即审计含SELECT等所有操作，，与不开审计相比，tpcc性能劣化在30%以内

## 2.8 测试建议

DDL：需要构造多种类型的DDL  
DML：需要构造复杂的SQL

## 2.8 其他说明

无
