+++
title = 'PostgreSQL fdw'
date = '2025-05-29T14:20:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 E100 fdw

```bash
+----
| User
|
```

1.  定义外表

```sql
-- \c atlasdb

-- ALTER SYSTEM SET password_encryption = 'scram-sha-256';
-- SELECT pg_reload_conf();
-- SHOW password_encryption;

-- 外部数据库：fdb1
CREATE DATABASE fdb1;
CREATE USER fu1 PASSWORd 'QAZ2wsx@123';
\c fdb1
set role fu1;
CREATE TABLE ft1 (c1 INT);
INSERT INTO ft1 VALUES (11);
reset role;

-- 配置本地数据库
\c atlasdb
CREATE EXTENSION postgres_fdw;

CREATE USER u1 PASSWORD 'u1.password';
CREATE SERVER s1 FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host '172.16.100.134', port '5432', dbname 'fdb1');
GRANT ALL ON FOREIGN SERVER s1 TO u1;

set role u1;
CREATE FOREIGN TABLE t1 (c1 INT) SERVER s1 OPTIONS (schema_name 'public', table_name 'ft1');
CREATE USER MAPPING FOR u1 SERVER s1 OPTIONS (user 'fu1', password 'QAZ2wsx@123');

-- 配置远程登录
echo 'host all u1 0.0.0.0/0 md5' >> $PG_HOME/data/atlasdb_hba.conf
echo 'host all fu1 0.0.0.0/0 md5' >> $PG_HOME/data/atlasdb_hba.conf
echo "listen_addresses='0.0.0.0'" >> $PG_HOME/data/atlasdb.conf
pstop
pstart

-- 访问外表
set role u1;
SELECT * FROM t1;

SELECT * FROM pg_user_mapping;

-- clean
DROP SERVER s1 CASCADE;
DROP USER u1;

DROP DATABASE fdb1;
DROP USER fu1;
```

# 2 G100 fdw

1.  安装外部集群

    ```bash
    # 1. 安装外部集群，设置端口为6432

    # 2. 创建数据库、用户、表
    vsql -d postgres -p 6432 -c "CREATE DATABASE fdb1;"
    vsql -d postgres -p 6432 -c "CREATE USER fu1 PASSWORd 'fu1.password'; "
    vsql -d fdb1 -p 6432 -c "CREATE TABLE ft1 (c1 INT); INSERT INTO ft1 VALUES (11); "
    ```

2.  集群创建关联

    ```sql
    -- 1. 安装集群，该设置端口为5432（通过fdw从该集群访问外部集群）
    -- 2. 安装插件
    \c vastbase
    CREATE EXTENSION postgres_fdw;

    -- 3. 生成访问外部服务器的密码
    \! gs_guc generate -S 'fu1.password' -D $GAUSSHOME/bin -o usermapping

    -- 3. 创建外部服务器
    CREATE PUBLIC DATABASE LINK flink CONNECT TO fu1 IDENTIFIED BY 'fu1.password' USING postgres_fdw(host 'localhost', port '6432', dbname 'fdb');

    -- 4. 尝试访问外部服务器（报错没权限正常，因为fu1本就无权限访问ft1）
    SELECT * FROM ft1@flink;

    -- 5. 创建用户
    CREATE USER u1 PASSWORD 'u1.password';
    CREATE USER u2 PASSWORD 'u1.password';

    -- 使用u1查询
    SET ROLE u1 PASSWORD 'u1.password';
    SELECT count(*) FROM information_schema.columns@flink;
    ```

3.  其他操作

    ```sql
    -- 使用u2查询
    SET ROLE u2 PASSWORD 'u2.password';
    SELECT count(*) FROM information_schema.columns@flink;

    -- 6 查看dblink相关信息
    SELECT oid,* FROM pg_foreign_data_wrapper;
    SELECT oid,* FROM pg_foreign_server;
    SELECT oid,* FROM pg_user_mapping;
    SELECT *,ftrelid::regclass FROM pg_foreign_table;

    -- 清理
    DROP EXTENSION postgres_fdw CASCADE;
    DROP USER u1;
    DROP USER u2;
    ```

```python
PostgresMain
    exec_simple_query
        pg_analyze_and_rewrite
            parser_analzye
                transformTopLevelStmt
                    taransfromStmt
                        transformSelectStlt
                            transformFromClause
                                transformTableEntry
                                    parserOpenTable
                                        dblinkTableHandle
                                            execute_sql_string('create schema vbdbkinl_pub....; grant all on schemma vbdblinkpub... to public; alter default privileges in schema vbdblinkpub...')
```

```python
exec_simple_query
    PortalStart
        standatd_ExecutorStart
            InitPlan
                ExecInitNode
                    ExecInitForeignScan
                        postgresBeginForeignScan
                            GetUserMapping
                                SearchSysCache('pg_user_mapping')
                                decryptUserMapping
                            GetConnection
                                connect_pg_server
```
