+++
title = 'PostgreSQL 3-13 逻辑复制测试记录'
date = '2026-05-21T17:38:00+08:00'
lastmod = '2026-09-03T18:23:38+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '测试用例']
weight = 313
ShowToc = true
TocOpen = true
+++
# 1 本地自测

## 1.1 快速tpcc

```bash
vkill
rm -rf $GAUSSHOME/data*
# cp -r ~/w100_t200/data $GAUSSHOME/data
# cp -r ~/w100_t200/data1 $GAUSSHOME/
cp -r ~/w5/data $GAUSSHOME/data
cp -r ~/w5/data1 $GAUSSHOME/
# cp -r ~/w100/data $GAUSSHOME/data
# cp -r ~/w100/data1 $GAUSSHOME/

# vb_guc set -D $GAUSSHOME/data -c "enable_ddl_logical_decode=on"
# vb_guc set -D $GAUSSHOME/data1 -c "enable_ddl_logical_decode=on"
# vb_guc set -D $GAUSSHOME/data1 -c "max_replication_slots=50"
# vb_guc set -D $GAUSSHOME/data1 -c "max_background_workers=50"
# vb_guc set -D $GAUSSHOME/data1 -c "max_logical_replication_workers=50"
vb_guc set -D $GAUSSHOME/data1 -c "max_connections=4000"

vb_guc set -D $GAUSSHOME/data1 -c "enable_audit=on"
vb_guc set -D $GAUSSHOME/data1 -c "audit_buffer_size=262144"
vb_guc set -D $GAUSSHOME/data1 -c "audit_directory_size=1073741824"

vb_ctl start -D $GAUSSHOME/data
vb_ctl start -D $GAUSSHOME/data1

# 五、发布端（发布）
vsql -d pubdb -p 64000 -c "CREATE PUBLICATION pub1 FOR all tables WITH (ddl='all');"
vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

# # 六、订阅端（订阅）
gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription

vsql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=220);"
#
# vsql -d pubdb -p 65000 -r
# \q
# cd ~/tpcc
# source envbm
# ./toolbm run vpub

# 换窗口查询
vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()"
vsql -d pubdb -p 64000 -c "SELECT * FROM vb_parallel_apply_stat()"

vsql -d pubdb -p 64000 -c "SELECT * FROM vb_parallel_apply_stat()"

# 场景一：验证内存
vsql -d pubdb -p 64000 -c "SELECT * FROM gs_thread_memory_context ORDER BY totalsize DESC limit 30;" > start_pub.mem
vsql -d pubdb -p 64000 -c "SELECT * FROM gs_shared_memory_detail ORDER BY totalsize DESC limit 30;;" >> start_pub.mem

vsql -d pubdb -p 65000 -c "SELECT * FROM gs_thread_memory_context ORDER BY totalsize DESC limit 30;;" > start_sub.mem
vsql -d pubdb -p 65000 -c "SELECT * FROM gs_shared_memory_detail ORDER BY totalsize DESC limit 30;;" >> start_sub.mem

# 场景八：验证数据一致性
vsql -d pubdb -p 64000 -c "DROP TABLE IF EXISTS tcnt"
vsql -d pubdb -p 64000 -c "CREATE TABLE tcnt (c1 TEXT,c2 INT);"
vsql -d pubdb -p 65000 -c "DROP TABLE IF EXISTS tcnt"
vsql -d pubdb -p 65000 -c "CREATE TABLE tcnt (c1 TEXT,c2 INT);"

for t in bmsql_config bmsql_customer bmsql_district bmsql_history bmsql_item bmsql_new_order bmsql_oorder bmsql_order_line bmsql_stock bmsql_warehouse; do
    echo "$t"
    vsql -d pubdb -p 64000 -c  "INSERT INTO tcnt VALUES('$t', (SELECT count(1) FROM $t));"
done;

for t in bmsql_config bmsql_customer bmsql_district bmsql_history bmsql_item bmsql_new_order bmsql_oorder bmsql_order_line bmsql_stock bmsql_warehouse; do
    echo "$t"
    vsql -d pubdb -p 65000 -c  "INSERT INTO tcnt VALUES('$t', (SELECT count(1) FROM $t));"
done;

vsql -d pubdb -p 64000 -c "SELECT * FROM tcnt"
vsql -d pubdb -p 65000 -c "SELECT * FROM tcnt;"

# 场景一：重启订阅端（kill）
for i in $(seq 0 10);
do
    echo "$i------------------------------------------------------------------------------------"
    ps ux | grep 'vastbase.*-D.*/data1' | grep -v grep | awk '{print $2}' | xargs kill -9
    vb_ctl start -D $GAUSSHOME/data1
    sleep 7
    vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()" >> a.out
done;

# 场景二：重启订阅端(stop)
for i in $(seq 0 10);
do
    echo "$i------------------------------------------------------------------------------------"
    echo "$i------------------------------------------------------------------------------------" >> a.out
    vb_ctl stop -D $GAUSSHOME/data1
    vb_ctl start -D $GAUSSHOME/data1
    vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()" >> a.out
    sleep 7
    vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()" >> a.out
done;

# 场景三：重启发布端
vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()"
vb_ctl stop -D $GAUSSHOME/data
sleep 5
vb_ctl start -D $GAUSSHOME/data
vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()"

vb_ctl restart -D $GAUSSHOME/data1

# 场景三：重建 subscription
for i in $(seq 0 10);
do
    echo "$i------------------------------------------------------------------------------------"
    echo "$i------------------------------------------------------------------------------------" >> a.out
    vsql -d pubdb -p 65000 -c "DROP SUBSCRIPTION sub1;"
    vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"
    vsql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=20);"
    sleep 6
    vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()" >> a.out
done;

vsql -d pubdb -p 65000 -c "DROP SUBSCRIPTION sub1;"
vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"
vsql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=20);"
vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()"

vsql -d pubdb -p 65000 -c "SELECT * FROM pg_subscription_rel"
vsql -d pubdb -p 64000 -c "SELECT * FROM vb_parallel_apply_stat()"

SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') / (1024 * 1024);

# 场景五：ddl
vsql -d pubdb -p 64000 -c "\d"
vsql -d pubdb -p 65000 -c "\d"
vsql -d pubdb -p 64000 -c "DROP TABLE bmsql_warehouse"
vsql -d pubdb -p 64000 -c "CREATE TABLE t3(c1 INT)"
vsql -d pubdb -p 64000 -c "\d"
vsql -d pubdb -p 65000 -c "\d"

# 场景六：多个发布订阅
vsql -d postgres -p 64000 -c "CREATE DATABASE db3;"
vsql -d db3 -p 64000 -c "CREATE TABLE t3(c1 INT PRIMARY KEY, c2 TEXT);"
vsql -d db3 -p 64000 -c "CREATE PUBLICATION pub3 FOR all tables WITH (ddl='all');"
vsql -d db3 -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot3', 'pgoutput');"

vsql -d postgres -p 65000 -c "CREATE DATABASE db3;"
vsql -d db3 -p 65000 -c "CREATE TABLE t3(c1 INT PRIMARY KEY, c2 TEXT);"
vsql -d db3 -p 65000 -c "CREATE SUBSCRIPTION sub3 CONNECTION 'host=172.16.103.90 port=64001 dbname=db3 user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub3 WITH (create_slot=false, slot_name = 'pslot3', copy_data = false, worker_number=20);"

vsql -d pubdb -p 65000 -c "DROP SUBSCRIPTION sub1;"

for i in $(seq 0 10); do vsql -d db3 -p 64000 -c "BEGIN; INSERT INTO t3 VALUES($i,'a'); UPDATE t3 SET c2='b' WHERE c1=$i-1; COMMIT;" & done; wait

# 跑10分钟
./toolbm run vpub

vsql -d pubdb -p 65000 -c "DROP SUBSCRIPTION sub1;"

#
for t in bmsql_config bmsql_customer bmsql_district bmsql_history bmsql_item bmsql_new_order bmsql_oorder bmsql_order_line bmsql_stock bmsql_warehouse; do
    echo "$t"
    vsql -d pubdb -p 65000 -c  "TRUNCATE $t"
done;
```

### 续点重传

```bash
vkill
rm -rf $GAUSSHOME/data*
# cp -r ~/w5/data $GAUSSHOME/data
# cp -r ~/w5/data1 $GAUSSHOME/
cp -r ~/w100/data $GAUSSHOME/data
cp -r ~/w100/data1 $GAUSSHOME/

vb_guc set -D $GAUSSHOME/data1 -c "max_connections=4000"

vb_ctl start -D $GAUSSHOME/data
vb_ctl start -D $GAUSSHOME/data1

# 五、发布端（发布）
vsql -d pubdb -p 64000 -c "CREATE PUBLICATION pub1 FOR all tables WITH (ddl='all');"
vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

# # 六、订阅端（订阅）
gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription

vsql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=220);"
#
# vsql -d pubdb -p 65000 -r
# \q

vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()"
vsql -d pubdb -p 64000 -c "SELECT * FROM vb_parallel_apply_stat()"

# ./toolbm run vpub

# 重启订阅端（kill）
for i in $(seq 0 10);
do
    echo "$i------------------------------------------------------------------------------------"
    ps ux | grep 'vastbase.*-D.*/data1' | grep -v grep | awk '{print $2}' | xargs kill -9
    vb_ctl start -D $GAUSSHOME/data1
    sleep 7
    vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()" >> a.out
done;

vsql -d pubdb -p 64000 -c "  SELECT * FROM pg_get_replication_slots(); "
vsql -d pubdb -p 64000 -c "  SELECT pg_current_wal_lsn();"

# 验证数据一致性
vsql -d pubdb -p 64000 -c "DROP TABLE IF EXISTS tcnt"
vsql -d pubdb -p 64000 -c "CREATE TABLE tcnt (c1 TEXT,c2 INT);"
vsql -d pubdb -p 65000 -c "DROP TABLE IF EXISTS tcnt"
vsql -d pubdb -p 65000 -c "CREATE TABLE tcnt (c1 TEXT,c2 INT);"

for t in bmsql_config bmsql_customer bmsql_district bmsql_history bmsql_item bmsql_new_order bmsql_oorder bmsql_order_line bmsql_stock bmsql_warehouse; do
    echo "$t"
    vsql -d pubdb -p 64000 -c  "INSERT INTO tcnt VALUES('$t', (SELECT count(1) FROM $t));"
done;

for t in bmsql_config bmsql_customer bmsql_district bmsql_history bmsql_item bmsql_new_order bmsql_oorder bmsql_order_line bmsql_stock bmsql_warehouse; do
    echo "$t"
    vsql -d pubdb -p 65000 -c  "INSERT INTO tcnt VALUES('$t', (SELECT count(1) FROM $t));"
done;

vsql -d pubdb -p 64000 -c "SELECT * FROM tcnt"
vsql -d pubdb -p 65000 -c "SELECT * FROM tcnt;"
```

```sql
-- ===================== worker_number =======================
CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false);
DROP SUBSCRIPTION sub1;
\! vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

CREATE SUBSCRIPTION sub2 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=1);
DROP SUBSCRIPTION sub2;
\! vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

CREATE SUBSCRIPTION sub3 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=2);
DROP SUBSCRIPTION sub3;
\! vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

CREATE SUBSCRIPTION sub4 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=200);
DROP SUBSCRIPTION sub4;
\! vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

CREATE SUBSCRIPTION sub5 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=400);
DROP SUBSCRIPTION sub5;

CREATE SUBSCRIPTION sub6 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=1000);
DROP SUBSCRIPTION sub6;

-- ===================== copy_data =======================
-- do truncate fist
CREATE SUBSCRIPTION sub21 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = true, worker_number=50);
SELECT * FROM pg_subscription_rel;
DROP SUBSCRIPTION sub21;

-- copy and stop

-- ===================== cache file =======================
-- 1. drop subscription
-- 2. kill progress

-- ===================== 断点续传 =======================
```

```bash
vsql -d postgres -p 50000 -c "DROP TABLE IF EXISTS t1"
vsql -d postgres -p 50000 -c "CREATE TABLE t1(c1 INT, c2 TEXT)"

for i in $(seq 0 10); do vsql -d postgres -p 50000 -c "BEGIN; INSERT INTO t1 VALUES($i,'a'); UPDATE t1 SET c2='b' WHERE c1=$i-1; COMMIT;" & done

vsql -d postgres -p 50000 -c "SELECT * FROM t1 ORDER BY c1"
```

## parallel_apply.source

### 1 自测

### 批量验证

#### 初始化模板

```sql
export VDATA=~/g100/rep/data

vb_guc set -D $VDATA -c "port=64000"
vb_guc set -D $VDATA -c "max_connection=2000"
vb_guc set -D $VDATA -c "wal_level=logical"
vb_guc set -D $VDATA -c "max_replication_slots=100"
vb_guc set -D $VDATA -c "max_background_workers=100"
vb_guc set -D $VDATA -c "max_logical_replication_workers=100"
sed -i '1i host all all 0.0.0.0/0 sha256\n' $VDATA/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $VDATA/pg_hba.conf
```

#### insert性能

```sql
export VDATA=~/g100/rep/data

vkill
rm -rf ~/g100/rep/data
cp -r ~/g100/rep/temp ~/g100/rep/data
vstart

vsql -d postgres -p 64000 -r
-- 3 create publicatioin
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables;
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');

-- sub
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name='pslot1', copy_data=false, worker_number=80);

SELECT count(1) FROM t1;
SELECT * FROM vb_parallel_apply_stat();

\c pubdb
truncate t1;
\c subdb
truncate t1;

SELECT datname,state,length(query) FROM pg_stat_activity WHERE datname = 'pubdb';
```

#### 多个发布订阅

```bash

vb_guc set -D ~/g100/rep/data -c "max_replication_slots=256"
vb_guc set -D ~/g100/rep/data -c "max_background_workers=256"
vb_guc set -D ~/g100/rep/data -c "max_logical_replication_workers=256"

export VDATA=~/g100/rep/data

vkill
rm -rf ~/g100/rep/data
cp -r ~/g100/rep/temp ~/g100/rep/data
vb_guc set -D ~/g100/rep/data -c "enable_ddl_logical_decode=on"
vb_guc set -D ~/g100/rep/data -c "max_wal_senders=36"
vb_guc set -D ~/g100/rep/data -c "max_replication_slots=256"
vb_guc set -D ~/g100/rep/data -c "max_background_workers=256"
vb_guc set -D ~/g100/rep/data -c "max_logical_replication_workers=256"
vb_guc set -D ~/g100/rep/data -c "max_connections=1000"
vstart

rm -rf ~/g100/rep/data1
vb_guc set -D ~/g100/rep/data1 -c "port=65000"
cp -r ~/g100/rep/temp ~/g100/rep/data1
vb_ctl start -D  ~/g100/rep/data1

# 发布
vsql -d postgres -p 64000 -c "CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';"
for i in $(seq 0 11);
do
    vsql -d postgres -p 64000 -c "CREATE DATABASE pubdb$i;"
    vsql -d pubdb$i -p 64000 -c "CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);"
    vsql -d pubdb$i -p 64000 -c "CREATE PUBLICATION pub$i FOR all tables;"
    vsql -d pubdb$i -p 64000 -c "SELECT pg_create_logical_replication_slot('pslot$i', 'pgoutput');"
done;

# 5 load data
for i in $(seq 0 11);
do
    for j in $(seq 0 10);
    do
        vsql -d pubdb$i -p 64000 -c "BEGIN; INSERT INTO t1 VALUES($j,'a'); UPDATE t1 SET c2='b' WHERE c1=$j-1; COMMIT;" &
    done;
    sleep 2
done; wait

# 订阅
gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription

for i in $(seq 0 11);
do
    vsql -d postgres -p 65000 -c "CREATE DATABASE subdb$i;"
    vsql -d subdb$i -p 65000 -c "CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);"
    vsql -d subdb$i -p 65000 -c "CREATE SUBSCRIPTION sub$i CONNECTION 'host=127.0.0.1 port=64001 dbname=pubdb$i user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub$i WITH (create_slot=false, slot_name = 'pslot$i', copy_data = false, worker_number=30);"
done;

sleep 5

# 6 check
for i in $(seq 0 11);
do
    vsql -d pubdb$i -p 64000 -c "SELECT count(1) FROM t1"
done;

for i in $(seq 0 11);
do
    vsql -d subdb$i -p 65000 -c "SELECT count(1) FROM t1"
done;

vsql -d postgres -p 64000 -c " SELECT * FROM pg_get_replication_slots();"

vsql -d postgres -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()"

# 7 cleanup
DROP SUBSCRIPTION sub1;
\c postgres
DROP DATABASE IF EXISTS pubdb;
DROP DATABASE IF EXISTS subdb;
DROP USER pu1;
```

#### copydata

```sql
export VDATA=~/g100/rep/data

vkill
rm -rf ~/g100/rep/data
cp -r ~/g100/rep/temp ~/g100/rep/data
vstart

rm -rf ~/g100/rep/data1
cp -r ~/g100/rep/temp ~/g100/rep/data1
vb_guc set -D ~/g100/rep/data1 -c "port=65000"
vb_ctl start -D  ~/g100/rep/data1

vsql -d postgres -p 64000 -r
-- 3 create publicatioin
-- pub
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables;
-- CREATE PUBLICATION pub1 FOR TABLE t1,t2;
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';
-- INSERT INTO t1 VALUES(1,'a'),(2,'b'),(3,'c');
-- INSERT INTO t1 (c1,c2) SELECT i,'BASE_' || i || '_' || repeat('X', 13000) FROM generate_series(1, 10000) AS i;
\q

-- for i in $(seq 0 1000); do vsql -d pubdb -p 64000 -c "INSERT INTO t1 VALUES($i,'a'); " ; done

vsql -d postgres -p 65000 -r
-- sub
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (copy_data=false, worker_number=10);

-- \! for i in $(seq 20000 20010); do vsql -d pubdb -p 64000 -c "INSERT INTO t1 VALUES($i,'a'); " ; done

SELECT * FROM t1;
SELECT * FROM vb_parallel_apply_stat();

vsql -d pubdb -p 64000 -c "SELECT count(1) FROM t1"
vsql -d subdb -p 65000 -c "SELECT count(1) FROM t1"
vsql -d subdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()"

SELECT * FROM pg_replication_slots;

INSERT INTO t1 VALUES(4,'a'),(5,'b'),(6,'c');
```

#### ddl

```sql
export VDATA=~/g100/rep/data

vkill
rm -rf ~/g100/rep/data
cp -r ~/g100/rep/temp ~/g100/rep/data
vb_guc set -D ~/g100/rep/data -c "enable_ddl_logical_decode=on"
vstart

rm -rf ~/g100/rep/data1
cp -r ~/g100/rep/temp ~/g100/rep/data1
vb_guc set -D ~/g100/rep/data1 -c "port=65000"
vb_ctl start -D  ~/g100/rep/data1

vsql -d postgres -p 64000 -r
-- 3 create publicatioin
-- pub
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables WITH (publish='insert,update,delete,truncate', ddl='all');
-- CREATE PUBLICATION pub1 FOR TABLE t1,t2;
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';
-- INSERT INTO t1 VALUES(1,'a'),(2,'b'),(3,'c');
\q

vsql -d postgres -p 65000 -r
-- sub
CREATE DATABASE subdb;
\c subdb  
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (copy_data=true, worker_number=4);

SELECT * FROM t1;

\! vsql -d pubdb -p 64000 -c "TRUNCATE t1"
\! sleep 1
SELECT * FROM t1;

\! vsql -d pubdb -p 64000 -c "DROP TABLE t1"
\! sleep 1
SELECT * FROM t1;

SELECT * FROM pg_replication_slots;

INSERT INTO t1 VALUES(4,'a'),(5,'b'),(6,'c');
```

#### sub-txn + ddl

```sql
export VDATA=~/g100/rep/data

vkill
rm -rf ~/g100/rep/data
cp -r ~/g100/rep/temp ~/g100/rep/data
vb_guc set -D ~/g100/rep/data -c "enable_ddl_logical_decode=on"
vstart

rm -rf ~/g100/rep/data1
cp -r ~/g100/rep/temp ~/g100/rep/data1
vb_guc set -D ~/g100/rep/data1 -c "port=65000"
vb_ctl start -D  ~/g100/rep/data1

vsql -d postgres -p 64000 -r
-- 3 create publicatioin
-- pub
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables WITH (publish='insert,update,delete,truncate', ddl='all');
-- CREATE PUBLICATION pub1 FOR TABLE t1,t2;
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';
INSERT INTO t1 VALUES(1,'a'),(2,'b'),(3,'c');
\q

vsql -d postgres -p 65000 -r
-- sub
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (copy_data=true, worker_number=4);

SELECT * FROM t1;

\! vsql -d pubdb -p 64000 -c "TRUNCATE t1"
\! sleep 1
SELECT * FROM t1;

\! vsql -d pubdb -p 64000 -c "DROP TABLE t1"
\! sleep 1
SELECT * FROM t1;

\! vsql -d pubdb -p 64000 -c "BEGIN; CREATE TABLE t3(c1 int); SAVEPOINT sp1; INSERT INTO t3 VALUES(3); SAVEPOINT sp2; TRUNCATE t3; SAVEPOINT sp3; COMMIT;"
SELECT * FROM t3;
DROP TABLE t3;
SELECT * FROM pg_replication_slots;

INSERT INTO t1 VALUES(4,'a'),(5,'b'),(6,'c');
```

#### disable

```sql
export VDATA=~/g100/rep/data

vkill
rm -rf ~/g100/rep/data
cp -r ~/g100/rep/temp ~/g100/rep/data
vstart

rm -rf ~/g100/rep/data1
cp -r ~/g100/rep/temp ~/g100/rep/data1
vb_guc set -D ~/g100/rep/data1 -c "port=65000"
vb_ctl start -D  ~/g100/rep/data1

vsql -d postgres -p 64000 -r
-- 3 create publicatioin
-- pub
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables WITH (ddl='all');
-- CREATE PUBLICATION pub1 FOR TABLE t1,t2;
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';
INSERT INTO t1 VALUES(1,'a'),(2,'b'),(3,'c');
\q

vsql -d postgres -p 65000 -r
-- sub
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (copy_data=true, worker_number=4);

SELECT * FROM t1;
-- SELECT * FROM pg_replication_slots;
SELECT * FROM pg_stat_subscription;
ALTER SUBSCRIPTION sub1 DISABLE;
\! vsql -d pubdb -p 64000 -c "INSERT INTO t1 VALUES(4,'a'),(5,'b'),(6,'c');"
SELECT * FROM t1;

ALTER SUBSCRIPTION sub1 ENABLE;
SELECT * FROM pg_replication_slots;
```

#### 基础场景

```sql
vkill
vinit
-- 1 config
vb_guc set -D $GAUSSHOME/data -c "wal_level=logical"
vb_guc set -D $GAUSSHOME/data -c "max_replication_slots=100"
vb_guc set -D $GAUSSHOME/data -c "max_background_workers=100"
vb_guc set -D $GAUSSHOME/data -c "max_logical_replication_workers=100"
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf

-- 2 startup
vstart
vsql -d postgres -p 50000 -r

-- 3 create publicatioin
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables;
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';

-- 4 create subscription
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
\! vsql -d subdb -p 50000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=50001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false);"
-- , worker_number=30
-- 172.16.103.90

\c pubdb
INSERT INTO t1 VALUES(1,'a'),(2,'b'),(3,'c');
UPDATE t1 SET c1 = 2 WHERE c2 = 'c';
INSERT INTO t1 VALUES(4,'d');

BEGIN;
INSERT INTO t1 VALUES(5,'e');
UPDATE t1 SET c1 = 1 WHERE c2 = 'b';
INSERT INTO t1 VALUES(6,'f');
COMMIT;

BEGIN;
INSERT INTO t1 VALUES(7,'d');
UPDATE t1 SET c2 = 'a' WHERE c1 = 2;
COMMIT;

-- 5 load data
\! for i in $(seq 0 10); do vsql -d pubdb -p 50000 -c "BEGIN; INSERT INTO t1 VALUES($i,'a'); UPDATE t1 SET c2='b' WHERE c1=$i-1; COMMIT;" > /dev/null 2>&1 & done; wait

\! sleep 3
-- 5 check subscription
\o pubdb.out
\c pubdb
SELECT * FROM t1 ORDER BY c1;
\o

\o subdb.out
\c subdb
SELECT * FROM t1 ORDER BY c1;
\o

\! grep -Irn "rows" pubdb.out
\! grep -Irn "rows" subdb.out
\! diff pubdb.out subdb.out
\! cat subdb.out

\! rm -f pubdb.out subdb.out

-- 7 cleanup
DROP SUBSCRIPTION sub1;
\c postgres
DROP DATABASE IF EXISTS pubdb;
DROP DATABASE IF EXISTS subdb;
DROP USER pu1;
```

### 空库feedback

```bash
vkill
rm -rf $GAUSSHOME/data*
cp -r ~/w5/data $GAUSSHOME/data
cp -r ~/w5/data1 $GAUSSHOME/

vb_guc set -D $GAUSSHOME/data1 -c "max_connections=4000"

vb_ctl start -D $GAUSSHOME/data
vb_ctl start -D $GAUSSHOME/data1

# 五、发布端（发布）
vsql -d pubdb -p 64000 -c "CREATE PUBLICATION pub1 FOR all tables WITH (ddl='all');"
vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

vsql -d pubdb -p 64000 -c "CREATE DATABASE db1";
vsql -d pubdb -p 64000 -c "CREATE DATABASE db2";
vsql -d db1 -p 64000 -c "CREATE PUBLICATION p1 FOR all tables WITH (ddl='all');"
vsql -d db1 -p 64000 -c " SELECT pg_create_logical_replication_slot('ps1', 'pgoutput');"
vsql -d db2 -p 64000 -c "CREATE PUBLICATION p2 FOR all tables WITH (ddl='all');"
vsql -d db2 -p 64000 -c " SELECT pg_create_logical_replication_slot('ps2', 'pgoutput');"

# 六、订阅端（订阅）
gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
vsql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=220);"

vsql -d pubdb -p 65000 -c "CREATE DATABASE db1";
vsql -d pubdb -p 65000 -c "CREATE DATABASE db2";
vsql -d db1 -p 65000 -c "CREATE SUBSCRIPTION s1 CONNECTION 'host=172.16.103.90 port=64001 dbname=db1 user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION p1 WITH (create_slot=false, slot_name = 'ps1', copy_data = false, worker_number=220);"
vsql -d db2 -p 65000 -c "CREATE SUBSCRIPTION s2 CONNECTION 'host=172.16.103.90 port=64001 dbname=db2 user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION p2 WITH (create_slot=false, slot_name = 'ps2', copy_data = false, worker_number=220);"

vsql -d pubdb -p 64000 -c "CREATE VIEW pstat AS SELECT slot_name,active,confirmed_flush, (pg_wal_lsn_diff(confirmed_flush, '0/0') / (1024 * 1024))::int as confirmed_lsn FROM pg_get_replication_slots();"

# 查看复制进度
vsql -d pubdb -p 64000 -c "SELECT * FROM pstat"

# 查看速度
vsql -d pubdb -p 64000 -c "SELECT (pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') / (1024 * 1024))::int as mb"

vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()"
vsql -d pubdb -p 64000 -c "SELECT * FROM vb_parallel_apply_stat()"
```

#### 子事务

```markdown
1. 这是一个基于opengauss开发的数据
2. 我已经设置了一些alias命令。全量编译vcmake。增量编译：vrecmake。启动集群：vinit, vstart。强制停止集群：vkill。
3. core文件目录：/data/
4. 并行逻辑复制关键代码：parallel_apply.cpp
5. $GAUSSHOME也就是install目录下，所有文件都是临时生成的，随便动
```

```sql
vkill
vinit
-- 1 config
vb_guc set -D $GAUSSHOME/data -c "wal_level=logical"
vb_guc set -D $GAUSSHOME/data -c "max_replication_slots=100"
vb_guc set -D $GAUSSHOME/data -c "max_background_workers=100"
vb_guc set -D $GAUSSHOME/data -c "max_logical_replication_workers=100"
# vb_guc set -D $GAUSSHOME/data -c "enable_audit=on"
# vb_guc set -D $GAUSSHOME/data -c "audit_buffer_size=262144"
# vb_guc set -D $GAUSSHOME/data -c "audit_directory_size=1073741824"
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf

-- 2 startup
vstart
vsql -d postgres -p 50000 -r

-- 3 create publicatioin
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables;
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';

-- 4 create subscription
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription

\! vsql -d subdb -p 50000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=50001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=20);"
-- , worker_number=30
-- 172.16.103.90

\c pubdb
BEGIN;
INSERT INTO t1 VALUES(1,'111'); -- 假如xid=1
SAVEPOINT s1;
INSERT INTO t1 VALUES(2,'222'); -- 假如xid=2 [savepoint 2, xid:1-2]
SAVEPOINT s2;

INSERT INTO t1 VALUES(3,'333'); -- 假如xid=3 [savepoint 3, xid:1-2-3]
SAVEPOINT s3;
INSERT INTO t1 VALUES(4,'444'); -- 假如xid=4 [savepoint 4, xid:1-2-3-4]
SAVEPOINT s4;
INSERT INTO t1 VALUES(5,'555'); -- 假如xid=5 [savepoint 5, xid:1-2-3-4-5]
ROLLBACK TO SAVEPOINT s2;

INSERT INTO t1 VALUES(6,'666'); -- 假如xid=6  [rollback to 3: xid:1-2]
SAVEPOINT s5;
INSERT INTO t1 VALUES(7,'777'); -- 假如xid=7
RELEASE SAVEPOINT s2; -- 此时，xid=6和xid=7会归并到xid=2的事务中

INSERT INTO t1 VALUES(8,'888'); -- 假如xid=2（假设上面RELEASE到s1，则xid=1，和顶层事务一致）
COMMIT;

-- \! sleep 3
-- 5 check subscription
\c pubdb
SELECT xmin,* FROM t1 ORDER BY c1;
\c subdb
SELECT * FROM vb_parallel_apply_stat();

SELECT xmin,* FROM t1 ORDER BY c1;

-- rollback to top
\c pubdb
BEGIN;
INSERT INTO t2 VALUES(1,'111'); -- 假如xid=1
SAVEPOINT s1;
INSERT INTO t2 VALUES(2,'222'); -- 假如xid=2
SAVEPOINT s2;

INSERT INTO t2 VALUES(3,'333'); -- 假如xid=3
SAVEPOINT s3;
INSERT INTO t2 VALUES(4,'444'); -- 假如xid=4
SAVEPOINT s4;
INSERT INTO t2 VALUES(5,'555'); -- 假如xid=5
ROLLBACK TO SAVEPOINT s2;

INSERT INTO t2 VALUES(6,'666'); -- 假如xid=6
SAVEPOINT s5;
INSERT INTO t2 VALUES(7,'777'); -- 假如xid=7
RELEASE SAVEPOINT s1; -- 此时，xid=6和xid=7会归并到xid=2的事务中

INSERT INTO t2 VALUES(8,'888'); -- 假如xid=2（假设上面RELEASE到s1，则xid=1，和顶层事务一致）
COMMIT;

-- \! sleep 3
-- 5 check subscription
\c pubdb
SELECT xmin,* FROM t2 ORDER BY c1;
\c subdb
SELECT xmin,* FROM t2 ORDER BY c1;

SELECT * FROM vb_parallel_apply_stat();

-- 延时检查
CREATE TABLE t3 (c1 INT, c2 TEXT );
ALTER TABLE t3 ADD CONSTRAINT t3_c1_unique UNIQUE (c1) DEFERRABLE;

-- 事务1                            -- 事务2
BEGIN;
INSERT INTO t3 VALUES (1, 'a');
                                    BEGIN;
                                    SET CONSTRAINTS ALL DEFERRED;
                                    INSERT INTO t3 VALUES (1, 'a');
COMMIT;
                                    COMMIT;

-- 7 cleanup
DROP SUBSCRIPTION sub1;
\c postgres
DROP DATABASE IF EXISTS pubdb;
DROP DATABASE IF EXISTS subdb;
DROP USER pu1;
```

#### 子事务 + 主键冲突

```sql
vkill
vinit
-- 1 config
vb_guc set -D $GAUSSHOME/data -c "wal_level=logical"
vb_guc set -D $GAUSSHOME/data -c "max_replication_slots=100"
vb_guc set -D $GAUSSHOME/data -c "max_background_workers=100"
vb_guc set -D $GAUSSHOME/data -c "max_logical_replication_workers=100"
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf

-- 2 startup
vstart
vsql -d postgres -p 50000 -r

-- 3 create publicatioin
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables;
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';

-- 4 create subscription
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription

CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=50001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=20);

INSERT INTO t1 VALUES(3,'old');

\c pubdb
BEGIN;
INSERT INTO t1 VALUES(1,'111'); -- 假如xid=1
SAVEPOINT s1;
INSERT INTO t1 VALUES(2,'222'); -- 假如xid=2 [savepoint 2, xid:1-2]
SAVEPOINT s2;
INSERT INTO t1 VALUES(3,'333'); -- 假如xid=3 [savepoint 3, xid:1-2-3]
SAVEPOINT s3;
INSERT INTO t1 VALUES(4,'444'); -- 假如xid=4 [savepoint 4, xid:1-2-3-4]
SAVEPOINT s4;
COMMIT;

\c subdb
SELECT * FROM t1;

SELECT * FROM vb_parallel_apply_stat();

-- 7 cleanup
DROP SUBSCRIPTION sub1;
\c postgres
DROP DATABASE IF EXISTS pubdb;
DROP DATABASE IF EXISTS subdb;
DROP USER pu1;
```

#### 子事务开发

```sql
-- 子事务开发
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);

SELECT pg_current_wal_lsn();

-- 场景一：relase commit
BEGIN;
INSERT INTO t1 VALUES(1,'111'); -- 假如xid=1
SAVEPOINT s1;
INSERT INTO t1 VALUES(2,'222'); -- 假如xid=2
SAVEPOINT s2;

INSERT INTO t1 VALUES(3,'333'); -- 假如xid=3
SAVEPOINT s3;
INSERT INTO t1 VALUES(4,'444'); -- 假如xid=4
SAVEPOINT s4;
INSERT INTO t1 VALUES(5,'555'); -- 假如xid=5
ROLLBACK TO SAVEPOINT s2;

INSERT INTO t1 VALUES(6,'666'); -- 假如xid=6
SAVEPOINT s5;
INSERT INTO t1 VALUES(7,'777'); -- 假如xid=7
RELEASE SAVEPOINT s2; -- 此时，xid=6和xid=7会归并到xid=2的事务中

INSERT INTO t1 VALUES(8,'888'); -- 假如xid=2（假设上面RELEASE到s1，则xid=1，和顶层事务一致）

COMMIT;

SELECT xmin,* FROM t1 ORDER BY c1;

\! pg_xlogdump -p $GAUSSHOME/data/pg_xlog -s xxx -x xid

-- 场景二：release abort
BEGIN;
INSERT INTO t1 VALUES(1,'111'); -- 假如xid=1
SAVEPOINT s1;
INSERT INTO t1 VALUES(2,'222'); -- 假如xid=2
SAVEPOINT s2;

INSERT INTO t1 VALUES(3,'333'); -- 假如xid=3
SAVEPOINT s3;
INSERT INTO t1 VALUES(4,'444'); -- 假如xid=4
SAVEPOINT s4;
INSERT INTO t1 VALUES(5,'555'); -- 假如xid=5
ROLLBACK TO SAVEPOINT s2;

INSERT INTO t1 VALUES(6,'666'); -- 假如xid=6
SAVEPOINT s5;
INSERT INTO t1 VALUES(7,'777'); -- 假如xid=7
RELEASE SAVEPOINT s2; -- 此时，xid=6和xid=7会归并到xid=2的事务中

INSERT INTO t1 VALUES(8,'888'); -- 假如xid=2（假设上面RELEASE到s1，则xid=1，和顶层事务一致）

ROLLBACK TO SAVEPOINT s1;

COMMIT;

SELECT xmin,* FROM t1 ORDER BY c1;
```

```sql
-- pg 用例
echo "
wal_level=logical
max_worker_processes=20
max_logical_replication_workers=20
max_parallel_apply_workers_per_subscription=10 " >> $PG_HOME/data/postgresql.conf

\c postgres
CREATE DATABASE pubdb;
CREATE DATABASE subdb;

\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR ALL TABLES;
CREATE USER pu1 REPLICATION LOGIN PASSWORD 'pu1.12345';
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');

-- 2 create subscription
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE SUBSCRIPTION sub1
CONNECTION 'host=127.0.0.1 port=5432 dbname=pubdb user=pu1 password=pu1.12345 replication=database'
PUBLICATION pub1
WITH (
    create_slot=false,
    slot_name='pslot1',
    copy_data=false,
    streaming=parallel
);

-- 3 test transaction
-- \c pubdb
-- BEGIN;
-- INSERT INTO t1 VALUES(1,'111'); -- top xid
-- SAVEPOINT s1;
-- INSERT INTO t1 VALUES(2,'222'); -- subxid 2
-- SAVEPOINT s2;
-- INSERT INTO t1 VALUES(3,'333'); -- subxid 3
-- SAVEPOINT s3;
-- INSERT INTO t1 VALUES(4,'444'); -- subxid 4
-- SAVEPOINT s4;
-- INSERT INTO t1 VALUES(5,'555'); -- subxid 5
-- ROLLBACK TO SAVEPOINT s2;
-- INSERT INTO t1 VALUES(6,'666'); -- subxid 6
-- SAVEPOINT s5;
-- INSERT INTO t1 VALUES(7,'777'); -- subxid 7
-- RELEASE SAVEPOINT s2;
-- INSERT INTO t1 VALUES(8,'888'); -- 回到s1对应事务上下文
-- COMMIT;

\c pubdb
BEGIN;
INSERT INTO t1 VALUES(1,'111'); -- 假如xid=1
SAVEPOINT s1;
INSERT INTO t1 VALUES(2,'222'); -- 假如xid=2
SAVEPOINT s2;
INSERT INTO t1 VALUES(3,'333'); -- 假如xid=3
SAVEPOINT s3;
INSERT INTO t1 VALUES(4,'444'); -- 假如xid=4
SAVEPOINT s4;
INSERT INTO t1 VALUES(5,'555'); -- 假如xid=5
ROLLBACK TO SAVEPOINT s2;
INSERT INTO t1 VALUES(6,'666'); -- 假如xid=6
SAVEPOINT s5;
INSERT INTO t1 VALUES(7,'777'); -- 假如xid=7
RELEASE SAVEPOINT s2; -- 此时，xid=6和xid=7会归并到xid=2的事务中
INSERT INTO t1 VALUES(8,'888'); -- 假如xid=2（假设上面RELEASE到s1，则xid=1，和顶层事务一致）
ROLLBACK TO SAVEPOINT s1;
COMMIT;

-- 4 check
\c pubdb
SELECT xmin,* FROM t1 ORDER BY c1;

\c subdb
SELECT * FROM pg_stat_subscription;
SELECT xmin,* FROM t1 ORDER BY c1;
```

```python
# 发布端：2阶段处理
ReleaseSavepoint
    for loop:
        cur = CurrentTransactionState
        cur->blockState = TBLOCK_SUBRELEASE
        cur = cur->parent

CommitTransactionCommand
    if CurrentTransactionState is TBLOCK_SUBRELEASE
        for loop:
            CommitSubTransaction
                AtSubCommit_childXids
                    CurrentTransactionState->parent->childXids[cnt++] = CurrentTransactionState->xid
                PopTransaction
                    CurrentTransactionState = s->parent

# 订阅端：
pa_start_subtrans
    DefineSavepoint
    subxactlist = lappend_xid(subxactlist, current_xid)

apply_handle_stream_commit

pa_stream_abort
    for loop:
        curxid = subxactlist
        if curxid == subxid:
            RollbackToSavepoint
```

实现原理：

```sql
BEGIN;
INSERT INTO t1 VALUES(1,'111'); -- 假如xid=1
SAVEPOINT s1;
INSERT INTO t1 VALUES(2,'222'); -- 假如xid=2 [savepoint 2, xid:1-2]
SAVEPOINT s2;

INSERT INTO t1 VALUES(3,'333'); -- 假如xid=3 [savepoint 3, xid:1-2-3]
SAVEPOINT s3;
INSERT INTO t1 VALUES(4,'444'); -- 假如xid=4 [savepoint 4, xid:1-2-3-4]
SAVEPOINT s4;
INSERT INTO t1 VALUES(5,'555'); -- 假如xid=5 [savepoint 5, xid:1-2-3-4-5]
ROLLBACK TO SAVEPOINT s2;                    [rollback to 5, xid:1-2-3-4]
                                             [rollback to 4, xid:1-2-3]
                                             [rollback to 3, xid:1-2]
INSERT INTO t1 VALUES(6,'666'); -- 假如xid=6  [savepoint 6, xid:1-2-6]
SAVEPOINT s5;
INSERT INTO t1 VALUES(7,'777'); -- 假如xid=7  [savepoint 7, xid:1-2-6-7]
RELEASE SAVEPOINT s2; -- 此时，xid=6和xid=7会归并到xid=2的事务中

INSERT INTO t1 VALUES(8,'888'); -- 假如xid=2（假设上面RELEASE到s1，则xid=1，和顶层事务一致） --
ROLLBACK TO s2;  [rollback to 2, xid:1]
COMMIT;
```

#### disable subscirption

```sql
vkill
vinit
-- 1 config
vb_guc set -D $GAUSSHOME/data -c "wal_level=logical"
vb_guc set -D $GAUSSHOME/data -c "max_replication_slots=100"
vb_guc set -D $GAUSSHOME/data -c "max_background_workers=100"
vb_guc set -D $GAUSSHOME/data -c "max_logical_replication_workers=100"
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf

-- 2 startup
vstart
vsql -d postgres -p 50000 -r

-- 3 create publicatioin
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables;
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';

-- 4 create subscription
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
\! vsql -d subdb -p 50000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=50001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=20);"
--

\c pubdb
BEGIN;
INSERT INTO t1 VALUES(1,'111');
INSERT INTO t1 VALUES(2,'222');
INSERT INTO t1 VALUES(3,'333');
COMMIT;

\! sleep 3
-- 5 check subscription
\c pubdb
SELECT xmin,* FROM t1 ORDER BY c1;
\c subdb
SELECT xmin,* FROM t1 ORDER BY c1;

\! for i in $(seq 10 100); do vsql -d pubdb -p 50000 -c "INSERT INTO t1 VALUES($i,'a');"; done;

ALTER SUBSCRIPTION sub1(enable=false);
```

#### 发布端异常

```sql
vkill
vinit
-- 1 config
vb_guc set -D $GAUSSHOME/data -c "wal_level=logical"
vb_guc set -D $GAUSSHOME/data -c "max_replication_slots=100"
vb_guc set -D $GAUSSHOME/data -c "max_background_workers=100"
vb_guc set -D $GAUSSHOME/data -c "max_logical_replication_workers=100"
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf

-- 2 startup
vstart
vsql -d postgres -p 50000 -r

-- 3 create publicatioin
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables;
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';

-- 4 create subscription
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
\! vsql -d subdb -p 50000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=50001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=20);"
-- , worker_number=30
-- 172.16.103.90

\c pubdb
BEGIN;
INSERT INTO t1 VALUES(1,'111'); -- 假如xid=1
SAVEPOINT s1;
INSERT INTO t1 VALUES(2,'222'); -- 假如xid=2
SAVEPOINT s2;
INSERT INTO t1 VALUES(3,'333'); -- 假如xid=3
SAVEPOINT s3;
INSERT INTO t1 VALUES(4,'444'); -- 假如xid=4
SAVEPOINT s4;
INSERT INTO t1 VALUES(5,'555'); -- 假如xid=5
ROLLBACK TO SAVEPOINT s2;
INSERT INTO t1 VALUES(6,'666'); -- 假如xid=6
SAVEPOINT s5;
INSERT INTO t1 VALUES(7,'777'); -- 假如xid=7
RELEASE SAVEPOINT s2; -- 此时，xid=6和xid=7会归并到xid=2的事务中
INSERT INTO t1 VALUES(8,'888');
COMMIT;

\! sleep 3
-- 5 check subscription
\c pubdb
SELECT xmin,* FROM t1 ORDER BY c1;
\c subdb
SELECT xmin,* FROM t1 ORDER BY c1;

\c pubdb
BEGIN;
INSERT INTO t1 VALUES(1,'111'); -- 假如xid=1
SAVEPOINT s1;
INSERT INTO t1 VALUES(2,'222'); -- 假如xid=2
SAVEPOINT s2;
INSERT INTO t1 VALUES(3,'333'); -- 假如xid=3
COMMIT;
INSERT INTO t1 VALUES(9, '999');

\! sleep 3
-- 5 check subscription
\c pubdb
SELECT xmin,* FROM t1 ORDER BY c1;
\c subdb
SELECT xmin,* FROM t1 ORDER BY c1;

-- 7 cleanup
DROP SUBSCRIPTION sub1;
\c postgres
DROP DATABASE IF EXISTS pubdb;
DROP DATABASE IF EXISTS subdb;
DROP USER pu1;
```

#### 无主键场景

```sql
vkill
vinit
-- 1 config
vb_guc set -D $GAUSSHOME/data -c "wal_level=logical"
vb_guc set -D $GAUSSHOME/data -c "max_replication_slots=100"
vb_guc set -D $GAUSSHOME/data -c "max_background_workers=100"
vb_guc set -D $GAUSSHOME/data -c "max_logical_replication_workers=100"
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf

-- 2 startup
vstart
vsql -d postgres -p 50000 -r

-- 3 create publicatioin
\c postgres
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT, c2 TEXT);
CREATE TABLE t2(c1 INT, c2 TEXT);
SELECT relreplident FROM pg_class WHERE relname in ('t1', 't2');
ALTER TABLE t1 REPLICA IDENTITY FULL;
ALTER TABLE t2 REPLICA IDENTITY FULL;
CREATE PUBLICATION pub1 FOR all tables;
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';

-- 4 create subscription
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT, c2 TEXT);
CREATE TABLE t2(c1 INT, c2 TEXT);
\! gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription
\! vsql -d subdb -p 50000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port=50001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=30);"
-- , worker_number=30
-- 172.16.103.90

-- 5 load data
\! for i in $(seq 0 50); do vsql -d pubdb -p 50000 -c "BEGIN; INSERT INTO t1 VALUES($i,'a'); UPDATE t1 SET c2='b' WHERE c1=$i-1; UPDATE t1 SET c2='a' WHERE c1=$i-2; COMMIT;" & done; wait

\c pubdb
SELECT * FROM t1;
\c subdb
SELECT * FROM t2;

\o pubdb.out
\c pubdb
SELECT * FROM t1 ORDER BY c1;
\o

\o subdb.out
\c subdb
SELECT * FROM t1 ORDER BY c1;
\o

\! grep -Irn "rows" pubdb.out
\! grep -Irn "rows" subdb.out
\! diff pubdb.out subdb.out
```

#### 多个发布订阅

```sql
vkill
rm -rf $GAUSSHOME/data

vinit
-- 1 config
vb_guc set -D $GAUSSHOME/data -c "wal_level=logical"
vb_guc set -D $GAUSSHOME/data -c "max_wal_senders=100"
vb_guc set -D $GAUSSHOME/data -c "work_mem=1GB"
vb_guc set -D $GAUSSHOME/data -c "maintenance_work_mem=4GB"
vb_guc set -D $GAUSSHOME/data -c "max_replication_slots=100"
vb_guc set -D $GAUSSHOME/data -c "max_background_workers=100"
vb_guc set -D $GAUSSHOME/data -c "max_logical_replication_workers=100"
sed -i '1i host all all 0.0.0.0/0 sha256\n' $GAUSSHOME/data/pg_hba.conf
echo "host replication all 0.0.0.0/0 sha256" >> $GAUSSHOME/data/pg_hba.conf

-- 2 startup
vstart

-- 3 create publicatioin
vsql -d postgres -p 50000 -c "CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';"
for i in $(seq 0 11);
do
    vsql -d postgres -p 50000 -c "CREATE DATABASE pubdb$i;"
    vsql -d pubdb$i -p 50000 -c "CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);"
    vsql -d pubdb$i -p 50000 -c "CREATE PUBLICATION pub$i FOR all tables;"
    vsql -d pubdb$i -p 50000 -c "SELECT pg_create_logical_replication_slot('pslot$i', 'pgoutput');"
done;

-- 4 create subscription
gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription

for i in $(seq 0 11);
do
    vsql -d postgres -p 50000 -c "CREATE DATABASE subdb$i;"
    vsql -d subdb$i -p 50000 -c "CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);"
    vsql -d subdb$i -p 50000 -c "CREATE SUBSCRIPTION sub$i CONNECTION 'host=127.0.0.1 port=50001 dbname=pubdb$i user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub$i WITH (create_slot=false, slot_name = 'pslot$i', copy_data = false, worker_number=30);"
done;

-- 5 load data
for i in $(seq 0 11);
do
    for j in $(seq 0 10);
    do
        vsql -d pubdb$i -p 50000 -c "BEGIN; INSERT INTO t1 VALUES($j,'a'); UPDATE t1 SET c2='b' WHERE c1=$j-1; COMMIT;" &
    done;
    sleep 2
done; wait

-- 6 check
for i in $(seq 0 11);
do
    vsql -d pubdb$i -p 50000 -c "SELECT count(1) FROM t1"
done;

for i in $(seq 0 11);
do
    vsql -d subdb$i -p 50000 -c "SELECT count(1) FROM t1"
done;

vsql -d pubdb -p 50000 -c "SELECT * FROM vb_parallel_apply_stat()"

-- 7 cleanup
DROP SUBSCRIPTION sub1;
\c postgres
DROP DATABASE IF EXISTS pubdb;
DROP DATABASE IF EXISTS subdb;
DROP USER pu1;
```

### 2 标准版

```bash
make fastcheck_checktest TESTS='rep_pa_apply' dbcmpt=A
```

```sql
-- 1 config
\setenv DATADIR @abs_srcdir@/tmp_check/datanode1

\! @abs_bindir@/vb_guc set -D $DATADIR -c "wal_level=logical" > /dev/null 2>&1
\! @abs_bindir@/vb_guc set -D $DATADIR -c "max_replication_slots=100" > /dev/null 2>&1
\! @abs_bindir@/vb_guc set -D $DATADIR -c "max_background_workers=100" > /dev/null 2>&1
\! @abs_bindir@/vb_guc set -D $DATADIR -c "max_logical_replication_workers=100" > /dev/null 2>&1
\! sed -i '1i host all all 0.0.0.0/0 sha256\n' $DATADIR/pg_hba.conf
\! echo "host replication all 0.0.0.0/0 sha256" >> $DATADIR/pg_hba.conf

-- 2 startup
\! @abs_bindir@/vb_ctl restart -D $DATADIR > /dev/null 2>&1
\c regression

-- 3 create publicatioin
CREATE DATABASE pubdb;
\c pubdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
CREATE PUBLICATION pub1 FOR all tables;
SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';

-- 4 create subscription
CREATE DATABASE subdb;
\c subdb
CREATE TABLE t1(c1 INT PRIMARY KEY, c2 TEXT);
CREATE TABLE t2(c1 INT PRIMARY KEY, c2 TEXT);
\! @abs_bindir@/gs_guc generate -S 'pu1.12345' -D @abs_bindir@ -o subscription > /dev/null 2>&1
\! pub_port=`expr @portstring@ + 1` && @abs_bindir@/vsql -d subdb -p @portstring@ -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=127.0.0.1 port="$pub_port" dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (create_slot=false, slot_name = 'pslot1', copy_data = false, worker_number=30);"

-- 5 load data
\! for i in $(seq 0 10); do @abs_bindir@/vsql -d pubdb -p @portstring@ -c "BEGIN; INSERT INTO t1 VALUES($i,'a'); UPDATE t1 SET c2='b' WHERE c1=$i-1; COMMIT;" > /dev/null 2>&1 & done; wait
-- wait replication
\! sleep 4

-- 5 check subscription
\o pubdb.out
\c pubdb
SELECT * FROM t1 ORDER BY c1;
\o

\o subdb.out
\c subdb
SELECT * FROM t1 ORDER BY c1;
\o

\! grep -Irn "rows" pubdb.out
\! grep -Irn "rows" subdb.out
\! diff pubdb.out subdb.out
\! rm -f pubdb.out subdb.out

-- 7 cleanup
DROP SUBSCRIPTION sub1;
\c regression
DROP DATABASE IF EXISTS pubdb;
DROP DATABASE IF EXISTS subdb;
DROP USER pu1;

```

# toto

-   todo

1.  delete leader – ok
2.  delete dcache
3.  if no worker, log it – ok
4.  startup, cleanup cache file – ok
5.  message is too long > 4000
6.  transaction is too long

# todo 0812

1.  worker error to leader - ok
2.  copy_data reconnect
3.  test: enable/disable \_REP – ok
4.  vb_parallel_apply_stat – ok
5.  mem leak test

# todo 0820

1.  relarr 100个
2.  txn_cache_pop_data，文件data最大4095
3.  fd <= 0
4.  ASSERT

-   多sub

    ```bash
    vkill
    rm -rf $GAUSSHOME/data*
    # cp -r ~/w100_t50/data_w100 $GAUSSHOME/data
    # cp -r ~/w100_t50/data1 $GAUSSHOME/
    cp -r ~/w5/data $GAUSSHOME/data
    cp -r ~/w5/data1 $GAUSSHOME/

    vb_guc set -D $GAUSSHOME/data1 -c "max_replication_slots=100"
    vb_guc set -D $GAUSSHOME/data1 -c "max_background_workers=100"
    vb_guc set -D $GAUSSHOME/data1 -c "max_logical_replication_workers=100"
    # vb_guc set -D $GAUSSHOME/data1 -c "max_connections=4000"

    vb_ctl start -D $GAUSSHOME/data
    vb_ctl start -D $GAUSSHOME/data1

    # 五、发布端（发布）
    vsql -d pubdb -p 64000 -c "CREATE PUBLICATION pub1 FOR TABLE bmsql_warehouse,bmsql_history;"
    vsql -d pubdb -p 64000 -c "CREATE PUBLICATION pub2 FOR TABLE bmsql_oorder,bmsql_config,bmsql_district,bmsql_item;"
    vsql -d pubdb -p 64000 -c "CREATE PUBLICATION pub3 FOR TABLE bmsql_order_line,bmsql_customer,bmsql_new_order,bmsql_stock;"
    # vsql -d pubdb -p 64000 -c " SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');"

    # 六、订阅端（订阅）
    gs_guc generate -S 'pu1.12345' -D $GAUSSHOME/bin -o subscription

    vsql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub1 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub1 WITH (copy_data = false, worker_number=30);"
    vsql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub2 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub2 WITH (copy_data = false, worker_number=30);"
    vsql -d pubdb -p 65000 -c "CREATE SUBSCRIPTION sub3 CONNECTION 'host=172.16.103.90 port=64001 dbname=pubdb user=pu1 password=pu1.12345 sslmode=disable' PUBLICATION pub3 WITH (copy_data = false, worker_number=30);"
    # vsql -d pubdb -p 65000 -r
    # \q

    vsql -d pubdb -p 65000 -c "SELECT * FROM pg_subscription_rel"

    vsql -d pubdb -p 65000 -c "SELECT * FROM vb_parallel_apply_stat()"
    vsql -d pubdb -p 64000 -c "SELECT * FROM vb_parallel_apply_stat()"
    ```
