+++
title = 'PostgreSQL 4-1 pgaudit'
date = '2025-05-23T10:54:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '审计']
weight = 401
ShowToc = true
TocOpen = true
+++
# 1 使用pgaudt

## 1.1 常见SQL

```sql
-- 1 ddl
CREATE USER u1 PASSWORD 'u1.password';
CREATE TABLE t1(c1 INT, c2 TEXT);
CREATE TABLE t2 (c1 INT, c2 TEXT);
CREATE INDEX i1 ON t1(c2);

-- 2 dml
INSERT INTO t1 VALUES (1, 'aaa'), (2, 'bbb'), (3, 'ccc');
INSERT INTO t2 VALUES (1, 'aaa'), (5, 'bbb');
UPDATE t1 SET c2 = 'ddd' WHERE c1 < 3;
DELETE FROM t1 WHERE c1 = 2;

-- 3 select
SELECT * FROM t1;

-- 4 function
SELECT c2 || '_oper' FROM t1;
SELECT concat(c2, '_func') FROM t1;
INSERT INTO t1 VALUES (5, concat('aaa', '_func')), (6, concat('aaa', '_func'));

-- 5 multi
INSERT INTO t1 SELECT * FROM t2;
SELECT * FROM t1 JOIN t2 ON t1.c1 = t2.c1;
CREATE TABLE t3 AS SELECT * FROM t2;
DROP TABLE t1,t2,t3;
```

# 1 安装pgaudit

## 1.1 安装postgresql

```bash
# 1 配置环境变量
echo 'export BUILD_ROOT=`pwd`' > pgenv
echo 'export PG_HOME=$BUILD_ROOT/install' >> pgenv
echo 'export PATH="$PG_HOME/bin:$PATH"' >> pgenv
source pgenv

# 2 下载源码
wget https://ftp.postgresql.org/pub/source/v14.18/postgresql-14.18.tar.gz
tar -zxvf postgresql-14.18.tar.gz
cd postgresql-14.18.tar.gz

# 3 编译源码 (不开启debug模式，提高性能)
#./configure --prefix=$PG_HOME --enable-debug=yes
./configure --prefix=$PG_HOME --enable-debug=no --enable-cassert=no
make -sj
make install -sj

# ==========================================
cd $BUILD_ROOT/pg14/contrib/pgaudit
make install USE_PGXS=1 PG_CONFIG=$PG_HOME/bin/pg_config
cd -
# ==========================================

# 4 初始化集群
initdb -D $PG_HOME/data

# 4 配置集群
# echo "port = 54000" >> $PG_HOME/data/postgresql.conf
# echo "max_connections = 1000" >> $PG_HOME/data/postgresql.conf

# ==========================================
echo "logging_collector = on" >> $PG_HOME/data/postgresql.conf
echo "shared_preload_libraries = 'pgaudit'" >> $PG_HOME/data/postgresql.conf
echo "pgaudit.log = 'ALL'" >> $PG_HOME/data/postgresql.conf

echo "pgaudit.log_catalog = true" >> $PG_HOME/data/postgresql.conf
echo "pgaudit.log_client = true" >> $PG_HOME/data/postgresql.conf
echo "pgaudit.log_parameter = true" >> $PG_HOME/data/postgresql.conf
echo "pgaudit.log_relation = true" >> $PG_HOME/data/postgresql.conf
echo "pgaudit.log_rows = true" >> $PG_HOME/data/postgresql.conf
echo "pgaudit.log_statement = true" >> $PG_HOME/data/postgresql.conf
# ==========================================

# 5 启动集群
pg_ctl start -D $PG_HOME/data

# ==========================================
DROP EXTENSION pgaudit;
CREATE EXTENSION pgaudit;
CREATE UNLOGGED TABLE adt(c1 TEXT);

CREATE TABLE t1 (c1 INT);
INSERT INTO t1 VALUES (1);

\! ls $PG_HOME/data/log
\! tail $PG_HOME/data/log/
# ==========================================
```

## 1.2 tpcc优化

```bash
echo "
shared_buffers = 200GB
work_mem = 1GB
maintenance_work_mem = 4GB
effective_cache_size = 500GB
wal_buffers = 1GB
checkpoint_timeout = 55min
" >> $PG_HOME/data/postgresql.conf

show shared_buffers;
show work_mem;
show maintenance_work_mem;
show effective_cache_size;
show wal_buffers;
show checkpoint_timeout;
```

## 1.3 安装pgaudit

```bash
# 1 下载源码
wget https://codeload.github.com/pgaudit/pgaudit/tar.gz/refs/tags/1.6.2 -O pgaudit-1.6.2.tar.gz
tar -zxvf pgaudit-1.6.2.tar.gz

# 2 编译
cd pgaudit-1.6.2
make install USE_PGXS=1 PG_CONFIG=$PG_HOME/bin/pg_config

# 3 验证编译成功
ll $PG_HOME/share/extension
cat $PG_HOME/data/postgresql.conf | grep shared_preload_libraries

# 4 开启日志功能
echo "logging_collector = on" >> $PG_HOME/data/postgresql.conf
echo "log_statement = all" >> $PG_HOME/data/postgresql.conf

# 5 开启 pgaudit
echo "shared_preload_libraries = 'pgaudit'" >> $PG_HOME/data/postgresql.conf
echo " pgaudit.log = 'ALL'" >> $PG_HOME/data/postgresql.conf
```

```sql
-- 1 安装pgaudit
CREATE EXTENSION pgaudit;

-- 2 查看配置参数
SHOW pgaudit.log;
    -- ALL
    -- READ: SELECT
    -- WRITE: INSERT, UPDATE, DELETE
    -- ROLE
    -- DDL
    -- FUNCTION
    -- MISC
    -- MISC_SET
SHOW pgaudit.role;
SHOW pgaudit.log_level;

-- 查看审计文件
SHOW log_directory;
SHOW log_filename;
```

1.  审计策略：客户

优先3.0

# 2 pgaudit工作原理

# E100

### pgaudit性能测试（pg-14）

-   配置：arm 128核，内存700G，1000仓，调整内存相关guc参数，其他guc参数默认（导数据约1h）
-   测试（不开审计）：cpu 60%，30min，500并发，tpmc = 35.68w
-   测试（开pgaudit全审计）：cpu 100%，30min，500并发，tpmc = 1.02w
-   测试（开pgaudit全审计，优化：不通过ereport记录日志，记录到unlogged table中）：cpu 60%，30min，500并发，tmpc = 预计20w (有1点点提升空间)

### E100客户要求：

-   功能：E100审计所有SQL语句
-   性能：性能劣化不高（内部认为20-30%可能能接收）
-   交付：尽量6月上旬，内核开发约2周

### E100审计方案：

4种方案：

1.  迁移G100审计功能（不建议）
    -   功能：非常多
    -   性能：开启1个审计线程，与pgaudit接近。开启48个审计线程，劣化20%
    -   交付：工作量较大。G100与E100代码差异非常大，比如进程/线程架构。且G100审计代码：质量差、较分散、逻辑乱，不过2周应该可搞定
2.  使用pgaudit（排除：性能非常低）
    -   功能：支持DML，DDL，FUNCTION等，**不支持用户登录、登出**
    -   性能：**不开审计35.68w（cpu 60%），开审计1.05w (cpu 99%)**
    -   交付：工作量最小
3.  优化pgaudit（日志存到TABLE，可花1天开发demo并验证性能）
    -   功能：支持DML，DDL，FUNCTION等
        -   日志收集：参考pgaudit
        -   日志存储：**UNLOGGED TABLE（备机是否需要审计日志？）**
        -   日志传输：Postgres进程 –> ShareBuffer –> BgWriter/CheckPointer进程
    -   性能：不好评估，30%有点悬
    -   交付：工作量适中
4.  优化pgaudit（日志存到文件，可花2天开发demo并验证性能）
    -   功能：支持DML，DDL，FUNCTION等
        -   日志收集：参考pgaudit
        -   日志存储：新增审计文件（**发生故障时，比如突然断电，允许丢失小部分日志吗，比如8k**）
        -   日志传输：Postgres进程 –> 新增共享内存、信号量 –> 新增日志进程
    -   性能：不好评估，比方案3好一些
    -   交付：工作量适中，2周应该可以搞懂
