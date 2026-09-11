+++
title = '数据库安全 防篡改'
date = '2026-07-29T10:04:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['安全']
weight = 900
ShowToc = true
TocOpen = true
+++
```sql
CREATE SCHEMA s1 WITH BLOCKCHAIN;
CREATE TABLE s1.t1(c1 INT, c2 TEXT);
\d s1.t1
\d blockchain.s1_t1_hist

INSERT INTO s1.t1 VALUES(1, 'aa'), (3, 'bb'), (7, 'cc'), (10, 'dd');
SELECT *,hash FROM s1.t1;
SELECT * FROM blockchain.s1_t1_hist; # hahs_ins,hash_del,pre_hash
SELECT * FROM gs_global_chain; # relnsp,relname,relhash,globalhash,txcommand

SELECT ledger_hist_check('s1', 't1');
SELECT ledger_gchain_check('s1', 't1');
```

## 分布式

```sql
CREATE SCHEMA s1 WITH BLOCKCHAIN;
CREATE TABLE s1.t1(c1 INT, c2 TEXT);
SELECT create_distributed_table('s1.t1', 'c1');

INSERT INTO s1.t1 VALUES(1, 'aa'), (2, 'bb'), (3, 'cc'), (7, 'dd'), (10, 'ee');
SELECT *,hash FROM s1.t1;

SELECT * FROM blockchain.s1_t1_hist;
-- hahs_ins,hash_del,pre_hash, 其中，pre_hash没用上，无作用
SELECT * FROM gs_global_chain;
-- relnsp,relname,relhash,globalhash,txcommand

SELECT * FROM ledger_hist('s1', 't1');
SELECT * FROM ledger_gchain();

SELECT ledger_hist_check('s1', 't1');
SELECT ledger_hist_archive('s1', 't1');
SELECT ledger_hist_repair('s1', 't1');

SELECT ledger_gchain_check('s1', 't1');
SELECT ledger_gchain_archive();
SELECT ledger_gchain_repair('s1', 't1');
```

## 集中式

```sql
CREATE SCHEMA s1 WITH BLOCKCHAIN;
CREATE TABLE s1.t1(c1 INT, c2 TEXT);
INSERT INTO s1.t1 VALUES(1, 'aa'), (2, 'bb'), (3, 'cc'), (7, 'dd'), (10, 'ee');
SELECT *,hash FROM s1.t1;

SELECT * FROM blockchain.s1_t1_hist;
SELECT * FROM gs_global_chain;

SELECT ledger_hist_check('s1', 't1');
SELECT ledger_hist_archive('s1', 't1');
SELECT ledger_hist_repair('s1', 't1');

SELECT ledger_gchain_check('s1', 't1');
SELECT ledger_gchain_archive();
SELECT ledger_gchain_repair('s1', 't1');

-- 下面2个函数，不用适配，别动代码，告诉我当前表现
-- SELECT * FROM ledger_hist('s1', 't1');
-- SELECT * FROM ledger_gchain();
```

CREATE SCHEMA s1 WITH BLOCKCHAIN;  
CREATE TABLE s1.t1(c1 INT, c2 TEXT);

– 非分布式表：历史表、全局历史表  
SELECT \* FROM blockchain.s1_t1_hist;  
SELECT \* FROM gs_global_chain;

– 分布式表：（历史信息存储在dn，只能用函数去dn收集）  
SELECT \* FROM ledger_hist(‘s1’, ‘t1’);  
SELECT \* FROM ledger_gchain();

```python
exec_simple_query(INSERT INTO s1.t1 VALUES(1, 'aa'), (3, 'bb'))
pg_parse_query
pg_analyze_and_rewrite
pg_plan_query
PortalStart
    ExecutorStart
        ..
PortalRun
    ExecutorRun
        ..

CREATE SCHEMA s1 WITH BLOCKCHAIN;
CREATE TABLE s1.t1(c1 INT, c2 TEXT);
\d s1.t1
\d blockchain.s1_t1_hist -- 自动生成，存储tuple hash值

exec_simple_query(INSERT INTO s1.t1 VALUES(1, 'aa'), (3, 'bb'), (7, 'cc'), (10, 'dd'))
pg_parse_query
pg_analyze_and_rewrite
pg_plan_query
PortalStart
PortalRun
    PortalRunMulti
        ProcessQuery
            ExecutorStart
                standard_ExecutorStart
                    InitPlan
                        ExecInitNode
                            ExecInitModifyTable
            ExecutorRun
                standard_ExecutorRun
                    ExecutePlan
                        ExecProcNode
                            ExecModifyTable
                                ExecInsert
                                    tuple = tableam_tslot_get_tuple_from_slot
                                    tuple = set_user_tuple_hash # 新增hash列
                                        gen_user_tuple_hash
                                            hash_combine_tuple_data
                                            pg_md5_binary
                                    tableam_tuple_insert('s1.t1')
                                    reshash = hist_table_record_insert('blockchain.s1_t1_hist' tuple) # 写 s1_t1_hist
                                        hist_table_record_internal
                                            fill_hist_block
                                                gen_hist_tuple_hash
                                            simple_heap_insert('blockchain.s1_t1_hist')
                                    lappend(estate->es_modifiedRowHash, reshash) # 保留 gs_blocal_chain 数据

            ExecutorFinish
            ExecutorEnd
                ledger_ExecutorEnd
                    hashsum = hash_combiner(estate->es_modifiedRowHash) # 计算1个或多个tuple的hash
                    ledger_gchain_append(hashsum) # 写 gs_blocal_chain
                        set_gchain_comb_string
                        gen_global_hash #
                        simple_heap_insert
                    standard_ExecutorEnd
```
