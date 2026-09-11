+++
title = 'PostgreSQL 3-13 Vastbase 逻辑复制'
date = '2025-11-27T19:07:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', 'Vastbase', '逻辑复制']
weight = 313
ShowToc = true
TocOpen = true
+++
# 2 使用

## 2.1 发布端

1.  配置

    ```bash
    # vb
    echo "wal_level=logical" >> $GAUSSHOME/data/postgresql.conf
    echo "max_replication_slots=4" >> $GAUSSHOME/data/postgresql.conf
    echo "max_wal_senders=4" >> $GAUSSHOME/data/postgresql.conf
    # echo "max_worker_processes=8" >> $GAUSSHOME/data/postgresql.conf
    echo "max_logical_replication_workers=32" >> $GAUSSHOME/data/postgresql.conf

    echo "listen_addresses='*'" >> $GAUSSHOME/data/postgresql.conf

    sed -i '1i host all all 0.0.0.0/0 md5\n' $GAUSSHOME/data/pg_hba.conf
    echo "host replication all 0.0.0.0/0 md5" >> $GAUSSHOME/data/pg_hba.conf
    # host all all 0.0.0.0/0 md5

    psql -d postgres -c "SELECT name,setting FROM pg_settings WHERE name in
        ('wal_level', 'max_replication_slots', 'max_wal_senders', 'max_worker_processes', 'max_logical_replication_workers')"
    ```

2.  创建基表

    ```sql
    CREATE DATABASE pubdb;
    \c pubdb
    CREATE TABLE pt1(c1 INT,c2 TEXT);
    CREATE TABLE pt2(c1 INT, c2 TEXT);
    INSERT INTO pt1 VALUES (1,'data1-1'), (2,'data1-2');
    INSERT INTO pt1 VALUES (1,'data2-1'), (2,'data2-2');
    ```

3.  创建发布用户

    ```sql
    -- 订阅端通过pu1用户来连接发布端，以接收数据
    CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';

    GRANT CONNECT ON DATABASE pubdb TO pu1;
    GRANT USAGE ON SCHEMA public TO pu1;
    GRANT ALL ON pt1,pt2 TO pu1;
    ```

4.  导入tpcc数据

    ```bash
    ./toolbm create
    ```

5.  创建发布信息

    ```sql
    \c pubdb
    set role pu1 password 'pu1.12345';
    set search_path to 'pu1';

    SELECT txid_current();

    CREATE PUBLICATION pub1 FOR all tables;
        -- CREATE PUBLICATION pub1 FOR TABLE pt1,pt2;
        -- SELECT * FROM pg_publication;
        -- SELECT * FROM pg_publication_rel;

    -- 设置发布状态
    SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
        -- SELECT * FROM pg_replication_slots;
        -- SELECT * FROM pg_stat_replication_slots;

    -- 检查数据
        -- SELECT * FROM pg_logical_slot_peek_changes('pslot1', NULL, NULL);
    -- 删除slot
        -- SELECT pg_drop_replication_slot('pslot1');
    ```

6.  验证

    ```sql
    -- psql -h 172.16.100.134 -p 54000 -d pubdb -U pu1 -W pu1.12345
    ```

7.  其他参考语法

    ```sql
    -- ALTER SUBSCRIPTION sub1 DISABLE;
    -- ALTER SUBSCRIPTION sub1 ENABLE;
    -- ALTER PUBlication pub1 ADD TABLE new_tbl;
    ```

## 2.2 订阅端

1.  配置  
    作为客户端访问发布端，无需配置任何guc参数

    ```bash
    # 如果发布端、订阅端在同一机器，确保二者端口不同
    # echo "port=5433" >> $GAUSSHOME/datas/postgresql.conf
    ```

2.  创建基表，与发布端表定义一致

    ```sql
    -- psql -p 5433 -d postgres
    CREATE DATABASE subdb;
    \c subdb
    -- CREATE TABLE pt1(c1 INT,c2 TEXT);
    -- CREATE TABLE pt2(c1 INT, c2 TEXT);
    \! vsql -d subdb -U pu1 -W 'pu1.12345' -f /home/shenkun/tpcc/benchmarksql-5.0/run/sql.common/sub.sql
    ```

3.  创建订阅信息

    ```sql
    \! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription

    -- x86
    \c subdb
    set search_path to 'pu1';

    CREATE SUBSCRIPTION sub1
    CONNECTION 'host=172.16.100.134 port=5433 dbname=pubdb user=pu1 password=pu1.12345'
    PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false);

    -- arm
    CREATE SUBSCRIPTION sub1
    CONNECTION 'host=172.16.103.46 port=54001 dbname=pubdb user=pu1 password=pu1.12345'
    PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false);

        -- SELECT * FROM pg_subscription;
        -- SELECT * FROM pg_subscription_rel;
        -- SELECT * FROM pg_stat_subscription;
    ```

4.  查看表数据

    ```sql
    \c subdb
    SELECT * FROM pt1;
    -- 向发布端表写数据，订阅端也会收到数据
    \c pubdb
    INSERT INTO pt1 VALUES(1, 'data-after-sub');
    \c subdb
    SELECT * FROM pt1;
    ```

5.  其他操作

    ```sql
    -- 暂停接受数据
    ALTER SUBSCRIPTION sub1 DISABLE;
    ```

## 2.3 x86 all

-   vb

    ```sql
    @vb
    CREATE DATABASE pubdb;
    \c pubdb
    CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';
    GRANT CONNECT ON DATABASE pubdb TO pu1;
    GRANT USAGE ON SCHEMA public TO pu1;

    -- tpcc load data ------------------------------
    ./toolbm create
    -- tpcc load data ------------------------------

    \c pubdb
    set role pu1 password 'pu1.12345';
    set search_path to 'pu1';
    CREATE PUBLICATION pub1 FOR all tables;
    SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');

    CREATE DATABASE subdb;
    \c subdb
    CREATE SCHEMA pu1;
    GRANT CONNECT ON DATABASE subdb TO pu1;
    GRANT USAGE ON SCHEMA public TO pu1;
    -- tpcc load data ------------------------------
    vi cfg/props.pg
    subdb
    warhouse=0
    ./toolbm create
    -- tpcc load data ------------------------------
    \! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
    \c subdb
    set search_path to 'pu1';
    truncate bmsql_config,bmsql_customer,bmsql_district,bmsql_history,bmsql_item,bmsql_new_order,bmsql_oorder,bmsql_order_line,bmsql_stock,bmsql_warehouse;

    CREATE SUBSCRIPTION sub1
    CONNECTION 'host=172.16.100.134 port=5433 dbname=pubdb user=pu1 password=pu1.12345'
    PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false);

    -------------------------------
    SELECT txid_current();
    vsql -d postgres -c "SELECT * FROM rep_stat('show')"
    ```

## 2.3 vb-single-db(复制位置)

```bash
rm -rf $GAUSSHOME/data*
vinit
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf
echo "
wal_level=logical
max_replication_slots=400
max_background_workers=400
max_logical_replication_workers=400
max_wal_senders=4
listen_addresses='*'
port=64000
max_connections=1000
shared_buffers = 100GB
work_mem = 1GB
maintenance_work_mem = 4GB
effective_cache_size = 500GB
wal_buffers = 1GB
checkpoint_timeout = 55min
checkpoint_segments = 102400
checkpoint_timeout = 60min
incremental_checkpoint_timeout = 120s
max_process_memory = 700GB
" >> $GAUSSHOME/data/postgresql.conf
vstart

vsql -d postgres -p 64000  -r
```

```sql
-- 2 发布端
-- 2.1 建表
CREATE DATABASE pubdb;
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';
\c pubdb
CREATE TABLE pt1(c1 INT,c2 TEXT);
CREATE TABLE pt2(c1 INT, c2 TEXT);
INSERT INTO pt1 VALUES (1,'111111111111'), (2,'22222222222222');
INSERT INTO pt2 VALUES (1,'111111111111'), (2,'22222222222222');
-- 2.2 发布
CREATE PUBLICATION pub1 FOR all tables;
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');

-- 3 订阅端
-- 3.1 建表
\c postgres
CREATE DATABASE subdb;
\c subdb
CREATE TABLE pt1(c1 INT,c2 TEXT);
CREATE TABLE pt2(c1 INT, c2 TEXT);
-- 3.2 订阅
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345'  PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = true); -- 检查copy_data状态

-- 4 验证
\c subdb
SELECT * FROM pt1;
\c pubdb
INSERT INTO pt1 VALUES (3,'33333333333');
INSERT INTO pt1 VALUES (3,'44444444444');
\c subdb
SELECT * FROM pt1;

\c pubdb
INSERT INTO pt1 VALUES (3,'55555555555555555');

INSERT INTO pt1 VALUES (3,'666666666666666');

INSERT INTO pt1 VALUES (3,'777777777777');
\c subdb
SELECT * FROM pt1;

\c pubdb
INSERT INTO pt1 VALUES (3,'8888888');
INSERT INTO pt2 VALUES (3,'8888888');

-- 其他
-- 订阅端查看表状态
SELECT * FROM pg_subscription_rel;

CREATE FUNCTION lsn(text) RETURNS bigint AS $$ SELECT (('x' || lpad(split_part($1,'/',1),8,'0'))::bit(32)::bigint<<32) | ('x' || lpad(split_part($1,'/',2),8,'0'))::bit(32)::bigint $$ LANGUAGE sql IMMUTABLE;
SELECT catalog_xmin,lsn(restart_lsn),lsn(confirmed_flush) FROM pg_get_replication_slots();
SELECT lsn(pg_current_wal_lsn());

-- 数据来源
-- pg_replication_origin，存储数据来源
  roident | roname
  --------+----------
      1   | pg_%subid

\c subdb
DROP SUBSCRIPTION sub1;
```

## multi_db_and_pub

```bash
rm -rf $GAUSSHOME/data*
vinit # 自己初始化数据库
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf
echo "
wal_level=logical
max_replication_slots=32
max_wal_senders=4
max_logical_replication_workers=32
listen_addresses='*'
port=64000
max_connections=1000
shared_buffers = 100GB
work_mem = 1GB
maintenance_work_mem = 4GB
effective_cache_size = 500GB
wal_buffers = 1GB
checkpoint_timeout = 55min
checkpoint_segments = 102400
checkpoint_timeout = 60min
incremental_checkpoint_timeout = 120s
max_process_memory = 700GB
" >> $GAUSSHOME/data/postgresql.conf
vstart # 自己启动数据库

vsql -d postgres -p 64000  -r
```

```sql
-- 用户
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription

-- 发布端
CREATE DATABASE db1;
\c db1
CREATE TABLE ta1(c1 INT,c2 TEXT);
CREATE TABLE tb1(c1 INT, c2 TEXT);
INSERT INTO ta1 VALUES (1,'111'), (2,'222');
CREATE PUBLICATION pub1 FOR all tables WITH (ddl = 'all');
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');

\c postgres
CREATE DATABASE db2;
\c db2
CREATE TABLE ta2(c1 INT,c2 TEXT);
CREATE TABLE tb2(c1 INT, c2 TEXT);
INSERT INTO ta2 VALUES (1,'111'), (2,'222');
CREATE PUBLICATION pub2 FOR all tables WITH (ddl = 'all');
SELECT pg_create_logical_replication_slot('pslot2', 'pgoutput');

\c postgres
CREATE DATABASE db3;
\c db3
CREATE PUBLICATION pub3 FOR all tables WITH (ddl = 'all');
SELECT pg_create_logical_replication_slot('pslot3', 'pgoutput');

-- 订阅端
\c postgres
CREATE DATABASE sdb1;
\c sdb1
CREATE TABLE ta1(c1 INT,c2 TEXT);
CREATE TABLE tb1(c1 INT, c2 TEXT);
CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=db1 user=pu1 password=pu1.12345'  PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false);

\c postgres
CREATE DATABASE sdb2;
\c sdb2
CREATE TABLE ta2(c1 INT,c2 TEXT);
CREATE TABLE tb2(c1 INT, c2 TEXT);
CREATE SUBSCRIPTION sub2 CONNECTION 'host=172.16.103.90 port=64001 dbname=db2 user=pu1 password=pu1.12345'  PUBLICATION pub2 WITH (create_slot=false, slot_name = 'pslot2', copy_data = false);

\c postgres
CREATE DATABASE sdb3;
\c sdb3
CREATE TABLE ta3(c1 INT,c2 TEXT);
CREATE SUBSCRIPTION sub3 CONNECTION 'host=172.16.103.90 port=64001 dbname=db3 user=pu1 password=pu1.12345'  PUBLICATION pub3 WITH (create_slot=false, slot_name = 'pslot3', copy_data = false);

\c db1
INSERT INTO ta1 VALUES (1,'333'), (2,'444');
\c db2
INSERT INTO ta2 VALUES (1,'555'), (2,'666');

\c sdb1
SELECT * FROM ta1;
\c sdb2
SELECT * FROM ta2;

SELECT * FROM rep_stat('show');
-- 清理
\c sdb1
DROP SUBSCRIPTION sub1;
\c sdb2
DROP SUBSCRIPTION sub2;
\c sdb3
DROP SUBSCRIPTION sub3;
```

## tpcc（with copy data）

```bash
rm -rf $GAUSSHOME/data*

# 一、发布端（导数）
vinit
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf
cp -r $GAUSSHOME/data $GAUSSHOME/data1

echo "
wal_level=logical
max_wal_senders=4
max_replication_slots=256
max_background_workers=256
max_logical_replication_workers=256
listen_addresses='*'
port=64000
max_connections=1000
shared_buffers = 100GB
work_mem = 1GB
maintenance_work_mem = 4GB
effective_cache_size = 500GB
wal_buffers = 1GB
checkpoint_timeout = 55min
checkpoint_segments = 102400
checkpoint_timeout = 60min
incremental_checkpoint_timeout = 120s
max_process_memory = 700GB
" >> $GAUSSHOME/data/postgresql.conf

vstart

# 二、发布端（导数）
vsql -d postgres -p 64000 -c "CREATE DATABASE pubdb;"
vsql -d postgres -p 64000 -c "CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';";

cd ~/tpcc
source envbm
./toolbm create vpub
#  100 warehouse, 400 term, 5 min, tmpc = 42w
cd -

# 三、订阅端（安装）
echo "
wal_level=logical
max_replication_slots=400
max_background_workers=400
max_logical_replication_workers=400
max_connections=3000
max_wal_senders=4
listen_addresses='*'
port=65000
max_connections=1000
shared_buffers = 100GB
work_mem = 1GB
maintenance_work_mem = 4GB
effective_cache_size = 500GB
wal_buffers = 1GB
checkpoint_timeout = 55min
checkpoint_segments = 102400
checkpoint_timeout = 60min
incremental_checkpoint_timeout = 120s
max_process_memory = 700GB
" >> $GAUSSHOME/data1/postgresql.conf

vb_ctl start -D $GAUSSHOME/data1

# 四、订阅端（建表）
vsql -d postgres -p 65000 -c "CREATE DATABASE pubdb;"
vsql -d postgres -p 65000 -c "CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';";

vsql -d pubdb -p 65000 -f ~/tpcc/benchmarksql-5.0/run/sql.common/tableCreates.sql
vsql -d pubdb -p 65000 -f ~/tpcc/benchmarksql-5.0/run/sql.common/indexCreates.sql

# 五、开始跑tpcc(换窗口)
./toolbm run vpub

# 五、发布端（发布）
vsql -d pubdb -p 64000 -c "CREATE PUBLICATION pub1 FOR all tables;"
vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

sleep 3

# 六、订阅端（订阅）
gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
# don't use localhost
vsql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345'  PUBLICATION pub1 WITH (slot_name = 'pslot1', worker_number = 380);"
# create_slot=false, , copy_data = true
# vsql -d pubdb -p 65000 -c "SELECT * FROM rep_stat('start')"

# 七、发布端（监测）
vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')"

# 八、订阅端（监测）
vsql -d pubdb -p 65000 -c "SELECT * FROM rep_stat('show')"

vsql -d pubdb -p 65000 -c "SELECT * FROM pg_subscription_rel"

# 验证
for t in bmsql_config bmsql_customer bmsql_district bmsql_history bmsql_item bmsql_new_order bmsql_oorder bmsql_order_line bmsql_stock bmsql_warehouse; do
    echo "$t"
    vsql -d pubdb -p 64000 -c  "SELECT count(1) FROM $t"
    vsql -d pubdb -p 65000 -c  "SELECT count(1) FROM $t"
done;
```

vsql -d postgres -p 64000 -r

CREATE TABLE tt1(c1 INT, c2 TEXT);  
CREATE PUBLICATION tpub1 FOR all tables;  
SELECT pg_create_logical_replication_slot(‘tpslot1’, ‘pgoutput’);

vb_recvlogical -d postgres -p 64000 -U pu1 -W ‘pu1.12345’ –slot tpslot1 –start -f - -o proto_version=4 -o publication_names=tpub1 -o streaming=extreme

## 2.3 vb-rep-tpcc

```bash
rm -rf $GAUSSHOME/data*

# 一、发布端（导数）
vinit
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf
cp -r $GAUSSHOME/data $GAUSSHOME/data1

echo "
wal_level=logical
max_wal_senders=4
max_replication_slots=256
max_background_workers=256
max_logical_replication_workers=256
listen_addresses='*'
port=64000
max_connections=1000
shared_buffers = 100GB
work_mem = 1GB
maintenance_work_mem = 4GB
effective_cache_size = 500GB
wal_buffers = 1GB
checkpoint_timeout = 55min
checkpoint_segments = 102400
checkpoint_timeout = 60min
incremental_checkpoint_timeout = 120s
max_process_memory = 700GB
" >> $GAUSSHOME/data/postgresql.conf

vstart

# 二、发布端（导数）
vsql -d postgres -p 64000 -c "CREATE DATABASE pubdb;"
vsql -d postgres -p 64000 -c "CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';";

cd ~/tpcc
./toolbm create vpub
cd -
# ./toolbm run vpub
#  100 warehouse, 400 term, 5 min, tmpc = 42w

# 三、订阅端（安装）
echo "
wal_level=logical
max_replication_slots=400
max_background_workers=400
max_logical_replication_workers=400
max_wal_senders=4
listen_addresses='*'
port=65000
max_connections=1000
shared_buffers = 100GB
work_mem = 1GB
maintenance_work_mem = 4GB
effective_cache_size = 500GB
wal_buffers = 1GB
checkpoint_timeout = 55min
checkpoint_segments = 102400
checkpoint_timeout = 60min
incremental_checkpoint_timeout = 120s
max_process_memory = 700GB
" >> $GAUSSHOME/data1/postgresql.conf

vb_ctl start -D $GAUSSHOME/data1

# 四、订阅端（建表）
vsql -d postgres -p 65000 -c "CREATE DATABASE pubdb;"
vsql -d postgres -p 65000 -c "CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';";

vsql -d pubdb -p 65000 -f ~/tpcc/benchmarksql-5.0/run/sql.common/tableCreates.sql
vsql -d pubdb -p 65000 -f ~/tpcc/benchmarksql-5.0/run/sql.common/indexCreates.sql

for t in bmsql_config bmsql_customer bmsql_district bmsql_history bmsql_item bmsql_new_order bmsql_oorder bmsql_order_line bmsql_stock bmsql_warehouse; do
    rm -f ./1.bin
    # 发布端：导出
    vsql -d pubdb -p 64000 -c  "COPY $t TO '`pwd`/1.bin' BINARY"
    # 订阅端：导入
    vsql -d pubdb -p 65000 -c  "COPY $t FROM '`pwd`/1.bin' BINARY"
done;

SEQ_VAL=$(vsql -d pubdb -p 64000 -c "SELECT last_value FROM bmsql_hist_id_seq;" -t -A)
vsql -d pubdb -p 65000 -c "SELECT setval('bmsql_hist_id_seq', $SEQ_VAL);"

# 备份 -----------------------------------
vb_ctl stop -D $GAUSSHOME/data
vb_ctl stop -D $GAUSSHOME/data1
mkdir ~/repd
cp -r $GAUSSHOME/data ~/repd
cp -r $GAUSSHOME/data1 ~/repd

# 测试
rm -rf $GAUSSHOME/data1
cp -r ~/repd/data1 $GAUSSHOME
vb_ctl start -D $GAUSSHOME/data1
# -----------------------------
# 恢复
```

## 本地快速tpcc

```bash
vkill
rm -rf $GAUSSHOME/data*
# cp -r ~/w100_t50/data_w100 $GAUSSHOME/data
# cp -r ~/w100_t50/data1 $GAUSSHOME/
cp -r ~/w5/data $GAUSSHOME/data
cp -r ~/w5/data1 $GAUSSHOME/

# export VBDATA=$GAUSSHOME/data
# vb_guc set -D $VBDATA -c "ssl=on"
# vb_guc set -D $VBDATA -c "require_ssl=off"
# vb_guc set -D $VBDATA -c "ssl_cert_file='`pwd`/server.crt'"
# vb_guc set -D $VBDATA -c "ssl_key_file='`pwd`/server.key'"
# vb_guc set -D $VBDATA -c "ssl_ca_file='`pwd`/demoCA/cacert.pem'"

# export VBDATA=$GAUSSHOME/data1
# vb_guc set -D $VBDATA -c "ssl=on"
# vb_guc set -D $VBDATA -c "require_ssl=on"
# vb_guc set -D $VBDATA -c "ssl_cert_file='`pwd`/server.crt'"
# vb_guc set -D $VBDATA -c "ssl_key_file='`pwd`/server.key'"
# vb_guc set -D $VBDATA -c "ssl_ca_file='`pwd`/demoCA/cacert.pem'"

vb_ctl start -D $GAUSSHOME/data

# gs_guc set -D $GAUSSHOME/data1 -c "max_replication_slots=400"
# gs_guc set -D $GAUSSHOME/data1 -c "max_background_workers=400"
# gs_guc set -D $GAUSSHOME/data1 -c "max_logical_replication_workers=400"
vb_ctl start -D $GAUSSHOME/data1
# -----------------------------------

# # 验证
# for t in bmsql_config bmsql_customer bmsql_district bmsql_history bmsql_item bmsql_new_order bmsql_oorder bmsql_order_line bmsql_stock bmsql_warehouse; do
#     echo "$t"
#     vsql -d pubdb -p 64000 -c  "SELECT count(1) FROM $t"
#     vsql -d pubdb -p 65000 -c  "SELECT count(1) FROM $t"
# done;

# 五、发布端（发布）
vsql -d pubdb -p 64000 -c "CREATE PUBLICATION pub1 FOR all tables;"
vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

# vsql -d pubdb -p 64000 -r
# CREATE FUNCTION lsn(text) RETURNS bigint AS $$ SELECT (('x' || lpad(split_part($1,'/',1),8,'0'))::bit(32)::bigint<<32) | ('x' || lpad(split_part($1,'/',2),8,'0'))::bit(32)::bigint $$ LANGUAGE sql IMMUTABLE;
# \q

# SELECT catalog_xmin,lsn(restart_lsn),lsn(confirmed_flush) FROM pg_get_replication_slots();
# vsql -d pubdb -p 64000 -c "  SELECT lsn(pg_current_wal_lsn());"

# 七、发布端（监测）
vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')"

# 跑10分钟
./toolbm run vpub

# ---------------------------------------------
# 六、订阅端（订阅）
gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
# don't use localhost
vsql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = true, worker_number=300);"
#  worker_number=100

vsql -d pubdb -p 65000 -c "SELECT * FROM rep_stat('show')"
vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')"

sleep 20
vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')" && sleep 10 && vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')"

vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')" && sleep 100 && vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')"

vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')" && sleep 10 && vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')"

# 测试订阅速度
sleep 30
vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')" && sleep 100 && vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')"

vsql -d pubdb -p 65000 -c "SELECT * FROM rep_stat('show')" && sleep 100 && vsql -d pubdb -p 65000 -c "SELECT * FROM rep_stat('show')"

vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')" && sleep 100 && vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')"
sleep 60
vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')" && sleep 100 && vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')"

# 八、订阅端（监测）
vsql -d pubdb -p 65000 -c "SELECT * FROM rep_stat('show')"

# 发
vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')" && sleep 10 && vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')"
# 订
vsql -d pubdb -p 65000 -c "SELECT * FROM rep_stat('show') LIMIT 10" && sleep 10 && vsql -d pubdb -p 65000 -c "SELECT * FROM rep_stat('show') LIMIT 10"

# 八、公共
vsql -d pubdb -p 64000 -c "\d+" && vsql -d pubdb -p 65000 -c "\d+"
vsql -d pubdb -p 64000 -c "SELECT * FROM rep_stat('show')" && vsql -d pubdb -p 65000 -c "SELECT * FROM rep_stat('show')"

# 重新测试
vsql -d pubdb -p 64000 -c "SELECT pg_replication_slot_advance('pslot1', pg_current_wal_lsn());"

vsql -d pubdb -p 65000 -c "DROP SUBSCRIPTION sub1"
# todo
# 1. 内存管理
# 2. 停止线程
```

| 编号 | tpcc并发数 | tpmc (10min) | tpmTotal | 发布端速度 | 订阅端速度(2次抽样) |
| --- | --- | --- | --- | --- | --- |
| 1 | 10 | 5.8w | 12.9w | 13.4 m/s | 52.2 m/s |
| 2 | 50 | 21.8w | 48.6w | 50.9 m/s | {76.4, 77.3} m/s |
| 3 | 100 | 33.3w | 73.9w | 77.5 m/s | {74.0, 73.2} m/s |
| 4 | 200 | 35.4w | 78.7w | 82.8 m/s | {73.8, 70.7} m/s |
| 5 | 300 | 36.3w | 80.9w | 84.9 m/s | {66.4, 64.0} m/s |
| 6 | 400 | 32.6w | 72.6w | 76.4 m/s | {62.1, 60.8} m/s |

-   测试环境：单机，kunpeng-920，128核，760G内存，tpcc 100 warehousee
-   发布端速度：tpcc运行10min，(结束lsn - 开始lsn) / 600s
-   订阅端速度：启动复制，抽样：(第130s的lsn - 第30s的lsn) / 100s，(第230s的lsn - 第130s的lsn) / 100s

假设:

-   t1：备机升级停机时间
-   t2：追赶时间
-   s1：发布端，生成xlog速度
-   s2：发布端，追赶期间，生成xlog速度
-   s3：订阅端，追赶速度  
    发布端xlog增量：t1 \* s1 + t2 \* s2  
    订阅端xlog增量：t1 \* 0 + t2 \* s3

以100并发为例，备机停机t1=600s，s1=77，s3=70：  
如果s2降速至50，则t2 = 23100s = 38.5 min  
如果s2降速至40，则t2 = 1540s = 25.6 min  
如果s2降速至30，则t2 = 1155s = 19.2 min  
如果s2降速至20，则t2 = 924s = 15.4 min  
如果s2降速至10，则t2 = 770s = 12.8 min  
如果s2降速至0 ，则t2 = 660s = 11 min  
如果发布端通过降低并发数降速，s3能更高，如果并发数不变，通过其他方法降速，s3应该也不变。

-   基础  
    200并发 | 37.6w | 83.6w | 88m/s
-   不dispatch：120-130m/s
-   串行：11.1 m/s
-   串行，不dispatch：22.5 m/s
-   串行，不dispatch，并行解码：79 m/s

50并发 | 24.2w | 53.9w | 56.47m/s

-   不apply  
    200 | 37 | 82 | 87 | {89， 90}

-   不dispatch  
    200 | 38 | 84 | 88 |

-   系统表新增1列：硬编码，无需升级脚本

-   ## 新增系统表

-   ## 新增函数

-   新增xlog类型

## gaussdb灰度升级流程

```bash
主a                     备b                         备c
+-----------------------+---------------------------+-----------------------------
|1 ==>执行业务
|2 开始升级
|3 执行pre-upgrade脚本
    (不停业务)
                        |4 重放pre-upgrade xlog
                                                    |5 重放pre-upgrade xlog
                        |6 替换二进制
                        |7 kill进程
                        |8 重启进程
                        |9 物理复制追赶主机
                                                    |10 替换二进制
                                                    |11 kill进程
                                                    |12 重启进程
                                                    |13 物理复制追赶主机
                        |14 升为主机
|15 降为备机
                        |16 ==>执行业务 [以后b一直是主机]
|17 替换二进制
|18 kill进程
|19 重启进程
|20 物理复制追赶主机
                        |21 执行post-upgrade脚本
|22 重放post-upgrade xlog
                                                    |23 重放post-upgrade xlog
|24 升级成功
```

## vastbase滚动升级

```bash
主a                     备b                         备c
+-----------------------+---------------------------+-----------------------------
|1 ==>执行业务
|2 开始滚动升级，暂停物理复制 lag=400M
                        |3 暂停物理复制
|4 创建逻辑复制槽 lsn1=1G
                        |5 恢复物理复制
                        |6 物理复制追赶到逻辑复制槽
                        |6 开始单节点升级
                        |7 [升级] 停止进程
                        |8 [升级] 替换二进制等
                        |9 [升级] 启动进程
                        |10 单节点升级成功
|11 持续执行业务 lsn2=2G
                        |12 创建订阅，启动逻辑复制，lsn1=1G
                        |13 逻辑复制开始追赶（初始差距：lsn2-lsn1)
|14 持续执行业务 lsn3=2.5G
                        |15 逻辑复制持续追赶 lsn=1.6G
|16 (可重置lag)
                        |17 差距持续缩小（从lsn2-lsn1降低到lag）
|18 发送停机命令
|19 停止业务
                        |20 差距持续缩小，从lag缩小至0
|21 停止进程成功
```

begin  
insert t1  
update t2  
delete t3  
commit

begin  
insert t3

begin  
update t1

begin  
update t4

## vb 特性开发

```bash
# create pulication
CreateSubscription
    parse_subscription_options
    heap_open('pg_subscription')
    simple_heap_insert
    replorigin_create
        heap_open('pg_replication_origin')
    AttemptConnectPublisher
    ApplyLauncherWakeupAtCommit # send signal to apply-launcher

# startup apply-launcher
ApplyLauncherMain
    get_subscription_list
        heap_open('pg_subscription')

    logical_worker_launcher

# startup apply-worker
ApplyWorkerMain
    GetSubscription
```

## 2.4 90-pg16

### copy-data

-   pg(copy data)

    ```bash
    pg_ctl stop -D $PG_HOME/data &
    pg_ctl stop -D $PG_HOME/data1

    rm -rf $PG_HOME/data*
    initdb -D $PG_HOME/data

    sed -i '1i host all all 0.0.0.0/0 md5\n' $PG_HOME/data/pg_hba.conf
    echo "host replication all 0.0.0.0/0 md5" >> $PG_HOME/data/pg_hba.conf

    cp -r $PG_HOME/data $PG_HOME/data1

    echo "
    wal_level=logical
    max_replication_slots=4
    max_wal_senders=4
    max_worker_processes=8
    max_logical_replication_workers=32
    listen_addresses='*'
    port=64000
    max_connections=1000
    password_encryption=md5
    shared_buffers = 100GB
    work_mem = 1GB
    maintenance_work_mem = 4GB
    effective_cache_size = 500GB
    wal_buffers = 1GB
    checkpoint_timeout = 55min
    max_wal_size= 100GB
    " >> $PG_HOME/data/postgresql.conf

    echo "
    wal_level=logical
    max_replication_slots=4
    max_wal_senders=4
    max_worker_processes=8
    max_logical_replication_workers=32
    listen_addresses='*'
    port=65000
    max_connections=1000
    password_encryption=md5
    shared_buffers = 100GB
    work_mem = 1GB
    maintenance_work_mem = 4GB
    effective_cache_size = 500GB
    wal_buffers = 1GB
    checkpoint_timeout = 55min
    max_wal_size= 100GB
    " >> $PG_HOME/data1/postgresql.conf

    rm -f $PG_HOME/log $PG_HOME/log1
    pg_ctl start -D $PG_HOME/data -l $PG_HOME/log
    pg_ctl start -D $PG_HOME/data1 -l $PG_HOME/log1

    psql -d postgres -p 64000 -c "CREATE DATABASE pubdb;"
    psql -d postgres -p 64000 -c "CREATE USER pu1 REPLICATION SUPERUSER PASSWORD 'pu1.12345';";
    psql -d postgres -p 65000 -c "CREATE DATABASE pubdb";
    psql -d postgres -p 65000 -c "CREATE USER pu1 REPLICATION SUPERUSER PASSWORD 'pu1.12345';";

    -- tpcc load data ------------------------------
    ./toolbm create pub
    psql -d pubdb -p 65000 -f ~/tpcc/benchmarksql-5.0/run/sql.common/tableCreates.sql
    psql -d pubdb -p 65000 -f ~/tpcc/benchmarksql-5.0/run/sql.common/indexCreates.sql
    -- tpcc load data ------------------------------

    psql -d pubdb -p 64000 -c "CREATE PUBLICATION pub1 FOR all tables;"
    psql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

    psql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=localhost port=64000 dbname=pubdb user=pu1 password=pu1.12345'  PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = true);"

    psql -d pubdb -p 64000 -c "\d+" && psql -d pubdb -p 65000 -c "\d+"

    psql -d postgres -p 64000 -c "SELECT rep_stat('show')" > $PG_HOME/start && psql -d postgres -p 65000 -c "SELECT rep_stat('show')" >> $PG_HOME/start
    cat $PG_HOME/start

    psql -d postgres -p 64000 -c "SELECT rep_stat('show') AS ppp" && psql -d postgres -p 65000 -c "SELECT rep_stat('show') AS sss" && sleep 10 && psql -d postgres -p 64000 -c "SELECT rep_stat('show') AS ppp" && psql -d postgres -p 65000 -c "SELECT rep_stat('show') AS sss"

    psql -d postgres -p 64000 -c "SELECT rep_stat('show') AS ppp" && sleep 10 && psql -d postgres -p 64000 -c "SELECT rep_stat('show') AS ppp"

    ./toolbm run pub

    psql -d pubdb -p 64000 -c "SELECT count(*) FROm bmsql_order_line" && psql -d pubdb -p 65000 -c "SELECT count(*) FROm bmsql_order_line"
    ```

-   pg(copy data, stream)

    ```bash
    pg_ctl stop -D $PG_HOME/data &
    pg_ctl stop -D $PG_HOME/data1

    rm -f log log1
    rm -rf $PG_HOME/data*
    initdb -D $PG_HOME/data

    sed -i '1i host all all 0.0.0.0/0 md5\n' $PG_HOME/data/pg_hba.conf
    echo "host replication all 0.0.0.0/0 md5" >> $PG_HOME/data/pg_hba.conf

    cp -r $PG_HOME/data $PG_HOME/data1

    echo "
    wal_level=logical
    max_replication_slots=4
    max_wal_senders=4
    max_worker_processes=8
    max_logical_replication_workers=32
    listen_addresses='*'
    port=64000
    max_connections=1000
    password_encryption=md5
    shared_buffers = 100GB
    max_wal_size= 10GB
    work_mem = 1GB
    maintenance_work_mem = 4GB
    effective_cache_size = 500GB
    wal_buffers = 1GB
    checkpoint_timeout = 55min
    " >> $PG_HOME/data/postgresql.conf

    echo "
    wal_level=logical
    max_replication_slots=4
    max_wal_senders=4
    max_worker_processes=8
    max_logical_replication_workers=32
    listen_addresses='*'
    port=65000
    max_connections=1000
    password_encryption=md5
    shared_buffers = 100GB
    max_wal_size= 10GB
    work_mem = 1GB
    maintenance_work_mem = 4GB
    effective_cache_size = 500GB
    wal_buffers = 1GB
    checkpoint_timeout = 55min
    " >> $PG_HOME/data1/postgresql.conf
    ```

    ```sql
    rm -f $PG_HOME/log $PG_HOME/log1
    pg_ctl start -D $PG_HOME/data -l $PG_HOME/log
    pg_ctl start -D $PG_HOME/data1 -l $PG_HOME/log1

    psql -d postgres -p 64000 -c "CREATE DATABASE pubdb;"
    psql -d postgres -p 64000 -c "CREATE USER pu1 REPLICATION SUPERUSER PASSWORD 'pu1.12345';";
    psql -d postgres -p 65000 -c "CREATE DATABASE pubdb";
    psql -d postgres -p 65000 -c "CREATE USER pu1 REPLICATION SUPERUSER PASSWORD 'pu1.12345';";

    -- tpcc load data ------------------------------
    ./toolbm create pub
    psql -d pubdb -p 65000 -f ~/tpcc/benchmarksql-5.0/run/sql.common/tableCreates.sql
    psql -d pubdb -p 65000 -f ~/tpcc/benchmarksql-5.0/run/sql.common/indexCreates.sql
    -- tpcc load data ------------------------------

    psql -d pubdb -p 64000 -c "CREATE PUBLICATION pub1 FOR all tables;"
    psql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

    psql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=localhost port=64000 dbname=pubdb user=pu1 password=pu1.12345'  PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = true, streaming=on);"

    psql -d pubdb -p 64000 -c "\d+" && psql -d pubdb -p 65000 -c "\d+"

    psql -d postgres -p 64000 -c "SELECT rep_stat('show')" && psql -d postgres -p 65000 -c "SELECT rep_stat('show')"  > $PG_HOME/start

    psql -d postgres -p 64000 -c "SELECT rep_stat('show') AS ppp" && psql -d postgres -p 65000 -c "SELECT rep_stat('show') AS sss" && sleep 3 && psql -d postgres -p 64000 -c "SELECT rep_stat('show') AS ppp" && psql -d postgres -p 65000 -c "SELECT rep_stat('show') AS sss"

    ./toolbm run pub

    psql -d pubdb -p 64000 -c "SELECT count(*) FROm bmsql_order_line" && psql -d pubdb -p 65000 -c "SELECT count(*) FROm bmsql_order_line"
    ```

# 3 原理

## 3.1 消息格式

```bash
# WalSndPrepareWriterHelper
+-----------+------------+
| data type | data body  |
------------+------------+

# part 1: data type
+-----+-----------+------------+-----------+
| 'w' | data_lsn  | walend_lsn | sendtime  |
+-----+-----------+------------+-----------+
   1       8              8             8

# part 2: data body: message
# 1. begin (logicalrep_write_begin)
+-----+-----------+-------------+----------+----------+
| 'B' | final_lsn | commit_time | xid      | (csn)    |
+-----+-----------+-------------+----------+----------+
   1      8            8            8         8

# 2. commit
+-----+-------+------------+----------+-------------+
| 'C' | flags | commit_lsn | end_lsn  | commit_time |
+-----+-------+------------+----------+-------------+
   1      1        8            8          8
                            remote_lsn
# 3. insert
+-----+-------+--------------+
| 'I' | relid | 'N' | tuple  |
+-----+-------+--------------+
   1      4      1     ..

# 4. delete
+-----+-------+------------+--------+
| 'D' | relid | 'O' or 'K' | tuple  |
+-----+-------+------------+--------+
   1      4        1           ..
```

## 3.2 关键系统表

```sql
-- 订阅端
SELECT * FROM pg_subscription;
SELECT * FROM pg_subscription_rel;

-- 发布端
SELECT pg_current_wal_lsn();
SELECT txid_current();
SELECT * FROM pg_publication;
SELECT * FROM pg_publication_rel;
SELECT * FROM pg_replication_slots;
```

## 3.2 关键逻辑

```c
leader()
{
    for (;;)
        msg = receive()
        switch (msgtype) {
            case 'B':
                txn_wkr.send(msg)
            case 'C':
                txn_wkr.send(msg)
                txn_wkr.send(ask_fdbk)
                recv(txn_wkr)
            case 'S':
                stm_wkr.alloc()
                if ()
        }
}
    while True:
        msg = receive()
        if 'B':
```

## 3.3 基本概念

-   csn (commit sequence number)
    -   概念：提交序列号。xid表示事务开始顺序，csn表示事务提交顺序
    -   用途：csn可替代传统snapshot，csn snapshot只需记录当前最大的csn即可
    -   存储：tupe-header中，存储csn。xid与csn一起记录在提交日志clog中

## 3.4 维护复制位置

```bash
======+=====================================
      |
 create slot
```

1.  发布端：创建复制槽

    ```sql
    SELECT pg_current_wal_lsn();

    SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');

    SELECT * FROM pg_get_replication_slots(); -- 从ReplicationCtl中获取状态
    -- slot_name
    -- xmin
    -- cofirmed_flush : 已发送，已回放
    -- restart_lsn : 根据cofirmed_flush，自动计算多余保留已回放的（例如cofirmed_flush=100， restart_lsn=50）
    ```

2.  订阅端：维护复制位置  
    断线重连时，订阅端决定复制位置

    ```sql
    CREATE SUBSCRIPTION ..

    SELECT * FROM pg_show_replication_origin_status(); -- 从repStateShm共享内存中获取状态，实际存储在 pg_replorigin/ 文件中（内存定期同步到文件中）
    -- local_id
    -- remote_lsn : 已接收，已回放（发布端的lsn）
    -- local_lsn : 已接收，已回放（订阅端的lsn）
    ```

3.  订阅端：记录物化复制位置（发给发布端记录）

    ```python
    # 提示：有的场景，不要求事务持久性，可以开启事务异步提交，比如存储日志的表

    # 记录位置
    apply_handle_commit
        apply_handle_commit_internal
            replorigin_session_origin_lsn = commit_data->end_lsn # remote
            CommitTransactionCommand
                RecordTransactionCommit
                    replorigin_session_advance(replorigin_session_origin_lsn, XactLastRecEnd) # (用于持久化) remote_lsn, local_lsn
                        curRepState == repStatesShm = ..
            store_flush_position # (用于反馈发布端) remote_lsn, local_lsn
                dlist_push_tail(lsnMapping)

    # 反馈位置
    send_feedback
        get_flush_position
            dlist_foreach_modify(lsnMapping) # 有个异步提交事务的参数
        walrcv_send

    # 存储位置
    CreateCheckPoint
        CheckPointReplicationOrigin
            disk_state.remote_lsn = repStatesShm->remote_lsn == curRepState
            write(disk_state)
    ```

4.  发布端：接收复制位置

    ```python
    # 存储位置
    CreateCheckPoint
        LogStandbySnapshot
            LogCurrentRunningXacts
                record->self_lsn = XLogInsert(XLOG_RUNNING_XACTS)

    SnapBuildProcessRunningXacts(record->self_lsn)
        SnapBuildSerialize
        LogicalIncreaseRestartDecodingForSlot
            slot->candidate_restart_lsn = last_serialized_snapshot = record->self_lsn

    # 发布端：更新位置 @pg-16
    StartLogicalReplication
        WalSndLoop
            for (;;)
                ProcessRepliesIfAny
                    ProcessStandbyMessage
                        ProcessStandbyReplyMessage
                            LogicalConfirmReceivedLocation
                                slot->confirmed_flus = fdbk.flush_lsn
                                slot->restart_lsn = slot->candidate_restart_lsn

    # 发布端：使用位置
    StartLogicalReplication
        CreateDecodingContext
        XLogBeginRead(slot->restart_lsn)
    ```

5.  订阅端：使用物理复制位置

    ```python
    # 读取位置
    StartupXLOG
        StartupReplicationOrigin
            read('pg_logical/replorigin_checkpoint')
            repStateShm->states = disk_state.remote_lsn

    # 使用位置
    ApplyWorkerMain
        replorigin_session_get_progress
            remote_lsn = curRepState.remote_lsn == repStatesShm.remote_lsn
        walrcv_startstreaming
            sub_startstreaming
                StartRemoteStreaming

    ```

6.  问题1：apply xid=1, xid=2，checkpoint记录到xid=1，发生故障，重启后，会重复apply xid=2吗？

    ```python
    CommitTransaction
        RecordTransactionCommit
            XactLogCommitRecord
                xl_origin.origin_lsn = replorigin_session_origin_lsn
                    XLogInsert
    ```

## 3.5 维护数据基线（ TableSyncWorker）

```
# 发布端
CREATE PUBLICATION pub1 FOR $tables;

# 订阅端
CREATE SUBSCRIPTION ...
    CreateSubscription
            parse_subscription_options
            heap_open('pg_subscription') # catalog 1
            simple_heap_insert
            replorigin_create
                heap_open('pg_replication_origin') # catalog 2: roident, roname
            check_publications # 检查publication是否存在
            check_publications_origin
                walrcv_exec('SELECT .. pg_get_publication_tables') # 从发布端获取表信息
            foreach (fetch_table_list)
                AddSubscriptionRelState('pg_subscription_rel') # catalog 3
                # table_state = copy_data ? INIT : READY;
            ApplyLauncherWakeupAtCommit # send signal to apply-launcher
```

1.  发布端：建表、导数（数据1）
2.  订阅端：建表、导数（数据2）
3.  订阅端：同步数据（复制数据1）

    ```sql
    -- 发布端：(create slog时，会创建snapshot，copy时会使用这个snapshot)
    lsn   1  2  3  4  5  6   7
    --------------------------->
    data  a  b  c  d  e  f  g

    - lsn 3：
        - apply-worker：开始apply
        - table-sync-worker：开始copy lsn 1-3，表状态
            init -> datasync -> finishedcopy
    - lsn 4:
        - apply-worker：发现lsn 4对应的表，还没copy完，不是r状态，等待
        -  table-sync-worker：copy 到 lsn 3后，开始进入追赶状态，追赶 lsn 3-4
            init -> datasync -> finishedcopy -> (begin sync)waitsync -> catchup -> syncdone -> ready
    - lsn 5：
        - apply-worker：从lsn 5正常apply

    1个synctable-worker处理1个表，发布端对应1个wal sender
    ```

    dispatch时，先处理commit，在处理sync table。sync时，根据已commit的lns。

```python
ApplyWorkerMain
    start_table_sync # 1个进程，1个rel
        LogicalRepSyncTableStart
            UpdateSubscriptionRelState('SUBREL_STATE_DATASYNC')
            walrcv_exec('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ')
            walrcv_create_slot(remote_lsn) # 创建slot
            copy_table
                logicalrep_relmap_update
                walrcv_exec('COPY xx.xx (colname, ..) TO STDOUT')
            walrcv_exec('COMMIT')
            UpdateSubscriptionRelState('SUBREL_STATE_FINISHEDCOPY')
            wait_for_worker_state_change('SUBREL_STATE_CATCHUP')
```

```bash
publisher              worker                      syncworker
--------------------------------------------------------------
insert 1,10
create slot, lsn=10
insert 11
                    start rep, lsn=10
                    apply_dispatch 10
                    apply commit lsn=10
                    start table sync
                                            start sync lsn=10
                    apply lsn=11, skip
                                            copy lsn=10
                                            state=syncwait
                    wakeup syncworker
                    wait state=syncdone
                                            sync lsn=11
```

## 阿芳滚动升级

```bash
# 0 获取旧安装包、补丁包

# 1 安装旧包
bash -x installcluster.sh -c A -k Vastbase-G100-3.0_Build9_30126-Linux-kunpeng920-no_mot-202601162225.tar.gz -H HAS-G100-3.6_7129-Linux-kunpeng920-202601141008_release.tar.gz -u sunwf -g sunwf -X /home/sunwf/setting.xml -p k8snode@123 -G 172.16.103.254

# 查看状态
cm_ctl query -Cvid
vsql -d vastbase -r

# 2 跑tpcc

# 3 执行升级
rm -rf patch
bash -x upgradecluster.sh -b xxx -u sunwf -g sunwf -X /home/sunwf/setting.xml -i n -l 100MB -p y -s y

# 4 卸载集群
cd script
./gs_uninstall --delete-data --clear-disk

# 看失败日志
```

## 3.6 定位死锁

```sql
SELECT
  usename,
  application_name,
  query_start,
  state,
  locktype,
  mode,
  granted,
  relation::regclass,
  query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE NOT granted;

WITH waiting AS (
  SELECT
    l.pid AS waiting_pid,
    l.locktype,
    l.transactionid AS waiting_xid,
    l.mode AS waiting_mode
  FROM pg_locks l
  WHERE NOT l.granted AND l.locktype = 'transactionid'
)
SELECT
  w.waiting_pid,
  a.pid,
  a.usename,
  a.application_name,
  a.query_start,
  a.state,
  l.transactionid,
  l.mode,
  a.query
FROM waiting w
JOIN pg_locks l ON
  w.locktype = l.locktype
  AND w.waiting_xid = l.transactionid
  AND l.granted
JOIN pg_stat_activity a ON l.pid = a.pid;
```

发布端，多个事务，如果没冲突，发布端可以并行，订阅端也可以并行

## 第一次发送位置

```python
@pg-16
    # 发布端：更新位置 @pg-16
    exec_replication_command
        if 'CREATE SLOT':
            CreateReplicationSlot
        elif 'START REPLICATION'
            StartLogicalReplication
                ReplicationSlotAcquire
                    MyReplicationSlot # 1. 读取slot
                CreateDecodingContext
                    StartupDecodingContext
                        AllocateSnapshotBuilder # 2. 初始化发送位置
                            builder->start_decoding_at = start_lsn
                        reorder->begin = begin_cb_wrapper # 3. 注册回调函数
                XLogBeginRead
                WalSndLoop(XLogSendLogical)
                    for (;;)
                        ProcessRepliesIfAny
                        send_data -> XLogSendLogical
                            XLogReadRecord # 4. 读取wal record
                            LogicalDecodingProcessRecord
                                GetRmgr
                                rmgr.rm_decode
                                    if 'xact':
                                        xact_decode
                                            if 'COMMIT':
                                                ParseCommitRecord
                                                DecodeCommit
                                                    SnapBuildCommitTxn
                                                    if DecodeTXNNeedSkip:
                                                            SnapBuildXactNeedsSkip
                                                                ptr < start_decoding_at
                                                        ReorderBufferForget
                                                    ReorderBufferCommit
                                                        ReorderBufferReplay
                                                            ReorderBufferProcessTXN
                                                                pgoutput_begin_txn
                                            elif 'ABORT':
                                            elif ''
                                    elif 'heap':
                                        if 'INSERT/UPDATE/DELETE':
                                            change_cb_wrapper
                                                pgoutput_change
                                                    is_publishable_relation # 检查
                                                    RelationIdGetRelation
                                                    ExecStoreHeapTuple
                                                    MakeTupleTableSlot
                                                    pgoutput_row_filter
                                                    logicalrep_write_insert

@g100
```

# 4 事务正确性

## 4.1 事务冲突场景

-   写-写场景  
    2个事务，操作同一条数据，此时，2个事务的begin，commit顺序，可能会影响最终结果

    | 类型 | INSERT | UPDATE | DELETE |
    | --- | --- | --- | --- |
    | INSERT | I-I | I-U | I-D |
    | UPDATE | U-I | U-U | U-D |
    | DELETE | D-I | D-U | D-D |

-   写-写冲突问题
    -   写-写 已存在的数据。例如，已存在数据0，事务1操作数据0，事务2也操作数据0

        | 写-写 | INSERT | UPDATE | DELETE |
        | --- | --- | --- | --- |
        | INSERT | I-I | I-U | I-D |
        | UPDATE | U-I | U-U(冲突) | U-D(冲突，等价于U-U) |
        | DELETE | D-I | D-U(冲突，等价于U-U) | D-D（冲突，等价与U-U） |

    -   写-写 新生成的数据。例如，事务1产生数据1，事务2操作数据1

        | 写-写 | INSERT | UPDATE | DELETE |
        | --- | --- | --- | --- |
        | INSERT | I-I | I-U（冲突） | I-D（冲突，等价于I-U） |
        | UPDATE | U-I | U-U(冲突，等价于I-U) | U-D(冲突，等价于I-U) |
        | DELETE | D-I | D-U | D-D |

-   写-写冲突示例
    -   写-写 已存在的数据

        ```sql
        -- 前置条件
        create table t(c text);
        insert into t values('0');

        -- @事务x1                                   -- @事务x2
        begin; -- 1
        insert into t values('-'); -- 2
                                                    begin; -- 3
                                                    insert into t values('-'); -- 4
        update t set c = '1' where c = '0'; -- 5
                                                    update t set c = '2' where c = '0'; -- 6 (与5冲突，阻塞，等待事务x1)
        commit; -- 7
                                                    commit; -- 8
        ```

    -   写-写 新生成的数据

        ```sql
        -- 前置条件
        create table t(c1 text);

        -- @事务x1                                   @-- 事务2
        begin; -- 1 (先开始)
        insert into t values('1'); -- 2
                                                    begin; -- 3
                                                    insert into t values('-'); -- 4
        commit; -- 5
                                                    update t set c1 = '2' where c1 = '1'; -- 6 (读已提交)
                                                    commit; -- 7
        ```

## 4.2 事务并行分析

### 4.2.1 写-写 已存在的数据

-   执行顺序  
    在read-commited隔离级别中，以下2种场景，结果一致。
    -   场景一：

        ```sql
        -- 前置条件
        create table t(c text);
        insert into t values('0');

        -- @事务x1                                   -- @事务x2
        begin; -- 1
        insert into t values('-'); -- 2
                                                    begin; -- 3
                                                    insert into t values('-'); -- 4
        update t set c = '1' where c = '0'; -- 5
                                                    update t set c = '2' where c = '0'; -- 6 (与5冲突，阻塞，等待事务x1)
        commit; -- 7
                                                    commit; -- 8
        ```

    -   场景二：[1、2、3、4]的顺序，对结果无影响。[4、5]与[7、8]的顺序，对结果有影响。

        ```sql
        -- 前置条件
        create table t(c text);
        insert into t values('0');

        -- @事务x1                                   -- @事务x2
                                                    begin; -- 1
                                                    insert into t values('-'); -- 2
        begin; -- 3
        insert into t values('-'); -- 4
        update t set c = '1' where c = '0'; -- 5
                                                    update t set c = '2' where c = '0'; -- 6 (与5冲突，阻塞，等待事务x1)
        commit; -- 7
                                                    commit; -- 8
        ```

-   WAL日志顺序
    -   场景一

        ```bash
        logic-lsn:    1   2   3   4   5    6   7    8
                    +---+---+---+---+----+---+----+---+
                x1  | B | I |   |   | U1 | C |    |   |
                x2  |   |   | B | I |    |   | U2 | C |
                    +---+---+---+---+----+---+----+---+
        ```

    -   场景二

        ```bash
        logic-lsn:    1   2   3   4   5    6   7    8
                    +---+---+---+---+----+---+----+---+
                x1  |   |   | B | I | U1 | C |    |   |
                x2  | B | I |   |   |    |   | U2 | C |
                    +---+---+---+---+----+---+----+---+
        ```

-   逻辑复制顺序
    -   场景一

        ```bash
        # send x1
        +------+---+----+---+
        | B-x1 | I | U1 | C |
        +------+---+----+---+
                            # send x2
                            +------+---+----+---+
                            | B-x2 | I | U2 | C |
                            +------+---+----+---+
        ```

    -   场景二

        ```bash
        # send x1
        +------+---+----+---+
        | B-x1 | I | U1 | C |
        +------+---+----+---+
                            # send x2
                            +------+---+----+---+
                            | B-x2 | I | U2 | C |
                            +------+---+----+---+
        ```

### 4.2.2 写-写 新生成的数据

-   执行顺序
    -   场景一

        ```sql
        -- 前置条件
        create table t(c1 text);

        -- @事务x1                                  -- @事务x2
        begin; -- 1 (先开始)
        insert into t values('1'); -- 2
                                                    begin; -- 3
                                                    insert into t values('-'); -- 4
        commit; -- 5
                                                    update t set c1 = '2' where c1 = '1'; -- 6 (读已提交)
                                                    commit; -- 7
        ```

    -   场景二

        ```sql
            -- 前置条件
            create table t(c1 text);

        -- @事务x1                                  -- @事务x2
                                                    begin; -- 1 (先开始)
                                                    insert into t values('-'); -- 2
            begin; -- 3
            insert into t values('1'); -- 4
            commit; -- 5
                                                    update t set c1 = '2' where c1 = '1'; -- 6 (读已提交)
                                                    commit; -- 7
        ```

-   WAL日志顺序  
    为节约篇幅，此处不再详细展开分析，结论与上一章节一致。
-   逻辑复制顺序  
    同上。

```bash
rel-1  1 2 3 4 5
commit  C I
```
