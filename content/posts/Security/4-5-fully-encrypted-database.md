+++
title = '数据库安全 5 全密态'
date = '2026-06-24T14:47:00+08:00'
lastmod = '2026-08-19T15:39:42+08:00'
draft = false
categories = ['安全']
tags = ['加密']
weight = 405
ShowToc = true
TocOpen = true
+++
1.  [0 基础调研](#0-%E5%9F%BA%E7%A1%80%E8%B0%83%E7%A0%94)
    1.  [一、运算符](#%E4%B8%80%E3%80%81%E8%BF%90%E7%AE%97%E7%AC%A6)
    2.  [二、数据类型](#%E4%BA%8C%E3%80%81%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)
2.  [1 架构设计](#1-%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1)
    1.  [工作计划](#%E5%B7%A5%E4%BD%9C%E8%AE%A1%E5%88%92)
        1.  [Table 1: Scan Nodes](#Table-1-Scan-Nodes)
        2.  [Table 2: Join Nodes](#Table-2-Join-Nodes)
        3.  [Table 3: Processing Nodes](#Table-3-Processing-Nodes)
        4.  [Table 4: Set & Control Nodes](#Table-4-Set-amp-Control-Nodes)
        5.  [单独说明：Table Function Materialization（表函数物化计算）](#%E5%8D%95%E7%8B%AC%E8%AF%B4%E6%98%8E%EF%BC%9ATable-Function-Materialization%EF%BC%88%E8%A1%A8%E5%87%BD%E6%95%B0%E7%89%A9%E5%8C%96%E8%AE%A1%E7%AE%97%EF%BC%89)
3.  [2 驱动加密 - 实现](#2-%E9%A9%B1%E5%8A%A8%E5%8A%A0%E5%AF%86-%E5%AE%9E%E7%8E%B0)
    1.  [2.1 新增类型ciphera](#2-1-%E6%96%B0%E5%A2%9E%E7%B1%BB%E5%9E%8Bciphera)
    2.  [2.2 新增系统表pg_key](#2-2-%E6%96%B0%E5%A2%9E%E7%B3%BB%E7%BB%9F%E8%A1%A8pg-key)
    3.  [2.3 新增语法DATA KEY](#2-3-%E6%96%B0%E5%A2%9E%E8%AF%AD%E6%B3%95DATA-KEY)
    4.  [2.4 新增系统表pg_sec_class](#2-4-%E6%96%B0%E5%A2%9E%E7%B3%BB%E7%BB%9F%E8%A1%A8pg-sec-class)
    5.  [2.4 新增语法ENCRYPT](#2-4-%E6%96%B0%E5%A2%9E%E8%AF%AD%E6%B3%95ENCRYPT)
    6.  [2.5 新增公共语法解析libgram](#2-5-%E6%96%B0%E5%A2%9E%E5%85%AC%E5%85%B1%E8%AF%AD%E6%B3%95%E8%A7%A3%E6%9E%90libgram)
    7.  [2.6 libpq重写INSERT](#2-6-libpq%E9%87%8D%E5%86%99INSERT)
    8.  [2.7 libpq重写SELECT结果](#2-7-libpq%E9%87%8D%E5%86%99SELECT%E7%BB%93%E6%9E%9C)
    9.  [2.8 新增支持int类型](#2-8-%E6%96%B0%E5%A2%9E%E6%94%AF%E6%8C%81int%E7%B1%BB%E5%9E%8B)
4.  [3 机密计算 - 实现](#3-%E6%9C%BA%E5%AF%86%E8%AE%A1%E7%AE%97-%E5%AE%9E%E7%8E%B0)
    1.  [3.1 简单计划](#3-1-%E7%AE%80%E5%8D%95%E8%AE%A1%E5%88%92)
    2.  [3.2 支持范围](#3-2-%E6%94%AF%E6%8C%81%E8%8C%83%E5%9B%B4)
        1.  [一、数据类型](#%E4%B8%80%E3%80%81%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)
        2.  [二、操作符与函数](#%E4%BA%8C%E3%80%81%E6%93%8D%E4%BD%9C%E7%AC%A6%E4%B8%8E%E5%87%BD%E6%95%B0)
    3.  [3.2 新增libcalc](#3-2-%E6%96%B0%E5%A2%9Elibcalc)
    4.  [3.2 新增ta_calc/ca_calc](#3-2-%E6%96%B0%E5%A2%9Eta-calc-x2F-ca-calc)
    5.  [3.3 内核新增ciphera函数](#3-3-%E5%86%85%E6%A0%B8%E6%96%B0%E5%A2%9Eciphera%E5%87%BD%E6%95%B0)
    6.  [3.4 内核新增ciphera运算符](#3-4-%E5%86%85%E6%A0%B8%E6%96%B0%E5%A2%9Eciphera%E8%BF%90%E7%AE%97%E7%AC%A6)
    7.  [3.5 内核make_op识别机密计算](#3-5-%E5%86%85%E6%A0%B8make-op%E8%AF%86%E5%88%AB%E6%9C%BA%E5%AF%86%E8%AE%A1%E7%AE%97)
    8.  [3.6 index_scan算子](#3-6-index-scan%E7%AE%97%E5%AD%90)
    9.  [3.6 优化](#3-6-%E4%BC%98%E5%8C%96)
        1.  [ca/ta通信](#ca-x2F-ta%E9%80%9A%E4%BF%A1)
5.  [4 测试用例](#4-%E6%B5%8B%E8%AF%95%E7%94%A8%E4%BE%8B)
    1.  [等值查询](#%E7%AD%89%E5%80%BC%E6%9F%A5%E8%AF%A2)
    2.  [范围查询](#%E8%8C%83%E5%9B%B4%E6%9F%A5%E8%AF%A2)
    3.  [模糊查询](#%E6%A8%A1%E7%B3%8A%E6%9F%A5%E8%AF%A2)
6.  [附录：专利](#%E9%99%84%E5%BD%95%EF%BC%9A%E4%B8%93%E5%88%A9)
7.  [附录：AI](#%E9%99%84%E5%BD%95%EF%BC%9AAI)
    1.  [代码要求：](#%E4%BB%A3%E7%A0%81%E8%A6%81%E6%B1%82%EF%BC%9A)
8.  [附录：参考文献](#%E9%99%84%E5%BD%95%EF%BC%9A%E5%8F%82%E8%80%83%E6%96%87%E7%8C%AE)

# 0 基础调研

## 一、运算符

-   运算符  
    以int4为例：`select proname from pg_catalog.pg_proc where proname like '%int4%' order by proname;`
    -   一、比较运算符函数

        | 运算符 | 函数 |
        | --- | --- |
        | < | int4lt |
        | <= | int4le |
        | \= | int4eq |
        | != / <> | int4ne |
        | \> | int4gt |
        | \>= | int4ge |
        | (btree) | btint4cmp |

    -   二、算数运算符函数

        | 运算符 | 函数 |
        | --- | --- |
        | + | int4pl |
        | \- | int4mi |
        | \* | int4mul |
        | / | int4div |
        | % | int4mod |
        | @ | int4abs |

    -   三、聚合函数

        | 运算符 | 函数 |
        | --- | --- |
        | sum() | int4_sum |
        | max() | int4larger |
        | min() | int4smaller |
        | avg() | int4_avg_accum + int8_avg |

## 二、数据类型

```
- 一、数值与字符串
    | 类型 | 别名 | 说明 |
    | -| -| -|
    | smallint | int2 | - |
    | integer | int, int4 | - |
    | bigint | int8 | - |
    | real | float4 | - |
    | double precision | float8 | - |
    | character varying(n) | varchar(n) | - |
    | character(n) | char(n) | - |
    | text | - | - |
- 二、时间、布尔、二进制
    | 类型 | 别名 | 说明 |
    | -| -| -|
    | boolean | bool | - |
    | bytea | - | - |
    | timestamp | - | - |
    | timestamp with time zone | timestamptz | - |
    | time | - | - |
    | time with time zone | timetz | - |
    | interval | - | - |
- 三、自增序列
    | 类型 | 别名 | 说明 |
    | -| -| -|
    | smallserial | serial2 | - |
    | serial | serial4 | - |
    | bigserial | serial8 | - |
- 四、其他
    | 类型 | 别名 | 说明 |
    | -| -| -|
    | numeric(p,s) | decimal(p,s) | - |
    | bit varying(n) | varbit(n) | - |
    | jsonb | - | - |
    | uuid | - | -|
```

# 1 架构设计

```bash
Driver
    +Cache
    +Parser (libgram.so)
    +Encrypt (libdrvenc.so)
    +Rewrite (libdrvenc.so)
    Protocol
    Connect

Server
    Parser
    Analyze
    Rewrite
    Plan
    Executor
        +TeeProtocol
        +CipherQual (libcalc.so)
```

代码结构：

```bash
src
    interfaces
        libpq
            fe-drvenc.c
    backend
        utils
            adt
                ciphera.c # 新增数据类型
        security
```

-   直接计算 (ExecMakeTableFunctionResult)

    ```bash
    app                                     libpq                       libdrvenc           kernel                          ta_cacl
    |---------------------------------------|---------------------------|-------------------|-------------------------------|-----------------------------------
    CREATE DATA KEY k1 ..
                                                                                            insert catalog pg_key
    CREATE TABLE t1(c1 INT ENCRYPT .., c2 INT)
                                                                                            insert catalog pg_attribute [c1, ciphera]
                                                                                            insert catalog pg_sec_class [t1, c1, int]
    connect(drvenc=on)
                                            get encrypted columns info from catalog pg_sec_class
                                            set encrypted columns
                                                                        load encrypted columns
                                            get search_paths from catalog pg_namespace
                                            set search_paths
    INSERT INTO t1 VALUES(11,22)
                                            rewrite query if need
                                                                        load search_path
                                                                        parse query 'INSERT INTO t1 VALUES(11,22)'
                                                                        check if column encryptd [public.t1.c1] [public.t1.c2]
                                                                        encrypt column value '11'
                                                                        rewrite query 'INSERT INTO t1 VALUES('cipher_11',22)'
                                            send new query 'INSERT INTO t1 VALUES('cipher_11',22)'
                                                                                            insert t1 ['cipher_11',22]
    SELECT * FROM t1 WHERE c1 = 11 (assume: seqscan)
                                            rewrite query if need
                                                                        parse query 'SELECT * FROM t1 WHERE c1 = 11'
                                                                        check if column encryptd [public.t1.c1]
                                                                        encrypt column value '11' to 'cipher_11'
                                                                        rewrite query 'SELECT * FROM t1 WHERE c1 = cipher_11'
                                            send new query 'SELECT * FROM t1 WHERE c1 = cipher_11'
                                                                                                scan tuple [c1 = cipher_11]
                                                                                                send result ['cipher_11',22]
                                            recv result ['cipher_11',22]
                                            decrypt result  if need
                                                                        check if column encryptd [public.t1.c1]
                                                                        decrypt column result 'cipher_11' to 11
                                                                        rewrite column reslut [11,22]
                                            return result [11,22]
    receive [11,22]
    SELECT * FROM t1 WHERE c1 > 10 (assume: seqscan)
                                            rewrite query if need
                                                                        parse query 'SELECT * FROM t1 WHERE c1 > 10'
                                                                        ..
                                                                        rewrite query 'SELECT * FROM t1 WHERE c1 > cipher_10'
                                            send new query 'SELECT * FROM t1 WHERE c1 > cipher_10'
                                                                                            parse
                                                                                            analyze qual 'c1 > cipher_10' to 'ciphera_gt(c1, cipher_10)'
                                                                                            plan
                                                                                            execute
                                                                                            scan tuple ['cipher_11',22]
                                                                                            call 'ciphera_gt('cipher_11', cipher_10)'
                                                                                            package calculation [ciphera_gt, cipher_11, cipher_10]
                                                                                            send calculation
                                                                                                                            receive calculation [ciphera_gt, cipher_11, cipher_10]
                                                                                                                            decrypt cipher_11 to 11
                                                                                                                            decrypt cipher_10 to 10
                                                                                                                            call int4gt(11,10) -> true
                                                                                                                            send result [true]
                                                                                            recv calculation [true]
                                                                                            send scan result ['cipher_11',22]
                                            recv result ['cipher_11',22]
                                            decrypt result  if need
                                                                        ..
                                            return result [11,22]
    SELECT c1 + c2 FROM t1 (assume: seqscan)
                                            rewrite query if need
                                            send query 'SELECT c1 + c2 FROM t1'
                                                                                            parse
                                                                                            analyze qual 'c1 + c2' to 'ciphera_pl(c1,c2)'
                                                                                            plan
                                                                                            execute
                                                                                            scan tuple ['cipher_11',22]
                                                                                            call 'ciphera_pl('cipher_11', 22)'
                                                                                            package calculation [ciphera_pl, cipher_11, 22]
                                                                                            send calculation
                                                                                                                            receive calculation [ciphera_pl, cipher_11, 22]
                                                                                                                            decrypt cipher11 to 11
                                                                                                                            call int4pl(11,22) -> 33
                                                                                                                            encrypt result 33 to cipher_33
                                                                                                                            send result [cipher_33]
                                                                                            recv calculation [cipher_33]
                                                                                            send result [cipher_33]
                                            recv result ['cipher_11',22]
                                            decrypt result  if need
                                                                        ..
                                            return result [33]
    receive [33]
    ```

例外：

```sql
INSERT INTO t1 VALUES(10+1, 22); --> INSERT INTO t1 VALUES(ciphera_sum(cipher_10, cipher_1), 22);

INSERT INTO t1 SELECT c21,c22 FROM t2;
    INSERT INTO t1 SELECT c21::ciphera,c22 FROM t2;
    -- ciphera中，需包含key oid
    INSERT INTO t1 SELECT re_encrypt(c21, t1, c1),c22 FROM t2;
```

## 工作计划

一、基本功能

-   语句加密（驱动侧
    1.  语法解析 [0.2人月]
    2.  语句重写：10+数据类型、20+语法 [0.5人月]
    3.  结果解密 [0.1人月]
    4.  加密适配器 [0.2人月]
    5.  密钥适配器 [0.2人月]
-   密文处理（内核侧）
    1.  密文操作符处理：15+ [0.2人月]
    2.  密文函数处理：30+ [0.3人月]
    3.  密文索引处理：btree [0.3人月]
    4.  密文聚集算子处理：sort, agg, group, unique [0.6人月]
    5.  密文连接算子处理：hashjoin, mergejoin, nestloopjoin [0.5人月]
    6.  机密计算适配器 [0.3人月]
-   密文计算（可信侧）
    1.  密文函数计算：40+ [0.3人月]
    2.  密文索引处理：btree [0.3人月]

二、软硬适配

-   加密适配

    1.  三未信安加密机 [0.2人月]
-   密钥适配

    1.  华为云管理服务 [0.2人月]
-   驱动适配

    1.  JDBC [0.5人月]
-   机密计算适配

    1.  国产CPU：5 [0.8人月]
    2.  国产OS：10 [0.8人月]
-   分类

    -   表达式求值：
        -   ExecEvalExpr
        -   ExecQual
        -   ExecProject
    -   索引访问计算：
        -   bt_compare
        -   bt_search
        -   hash_func
    -   基础设施回调
        -   索引
            -   \_bt_compare
            -   \_bt_binsrch
        -   排序
            -   ApplySortComparator
            -   ST_COMPARE
        -   哈希
            -   ExecHashGetHashValue
        -   合并
            -   ExecMergeCompareKeys

### Table 1: Scan Nodes

| No. | Node | Exec Function | Expression Evaluation | Infrastructure Callback |
| :-- | :-- | :-- | :-- | :-- |
| 1 | Seq Scan | ExecSeqScan | ExecQual, ExecProject | N/A |
| 2 | Index Scan | ExecIndexScan | ExecQual (Filter/Recheck) | \_bt_compare, \_bt_binsrch |
| 3 | Index Only Scan | ExecIndexOnlyScan | ExecQual (Filter) | \_bt_compare, \_bt_binsrch |
| 4 | Bitmap Heap Scan | ExecBitmapHeapScan | ExecQual, ExecProject | N/A |
| 5 | Bitmap Index Scan | ExecBitmapIndexScan | N/A | \_bt_compare, \_bt_binsrch |
| 6 | Tid Scan | ExecTidScan | ExecQual, ExecProject | N/A |
| 7 | Tid Range Scan | ExecTidRangeScan | ExecQual, ExecProject | N/A |
| 8 | Subquery Scan | ExecSubqueryScan | ExecQual, ExecProject | N/A |
| 9 | Function Scan | ExecFunctionScan | ExecQual, ExecProject | N/A |
| 10 | TableFunc Scan | ExecTableFuncScan | ExecQual, ExecProject | N/A |
| 11 | Values Scan | ExecValuesScan | ExecQual, ExecProject | N/A |
| 12 | CTE Scan | ExecCteScan | ExecQual, ExecProject | N/A |
| 13 | Named Tuplestore Scan | ExecNamedTuplestoreScan | ExecQual, ExecProject | N/A |
| 14 | WorkTable Scan | ExecWorkTableScan | ExecQual, ExecProject | N/A |
| 15 | Foreign Scan | ExecForeignScan | ExecQual, ExecProject | N/A |
| 16 | Sample Scan | ExecSampleScan | ExecQual, ExecProject | N/A |

### Table 2: Join Nodes

| No. | Node | Exec Function | Expression Evaluation | Infrastructure Callback |
| :-- | :-- | :-- | :-- | :-- |
| 1 | Nested Loop | ExecNestLoop | ExecQual (Join Filter), ExecProject | N/A |
| 2 | Hash Join | ExecHashJoin | ExecQual, ExecProject | ExecHashGetHashValue, ExecHashGetBucket |
| 3 | Merge Join | ExecMergeJoin | ExecQual, ExecProject | ExecMergeCompareKeys |

### Table 3: Processing Nodes

| No. | Node | Exec Function | Expression Evaluation | Infrastructure Callback |
| :-- | :-- | :-- | :-- | :-- |
| 1 | Sort | ExecSort | N/A | ApplySortComparator (ST_COMPARE) |
| 2 | Incremental Sort | ExecIncrementalSort | N/A | ApplySortComparator (ST_COMPARE) |
| 3 | Aggregate | ExecAgg | ExecEvalExpr (transfn, finalfn) | N/A |
| 4 | Group | ExecGroup | N/A | execTuplesMatchPrepare / Compare |
| 5 | Unique | ExecUnique | N/A | execTuplesMatchPrepare / Compare |
| 6 | Hash | ExecHash | N/A | ExecHashGetHashValue, ExecHashGetBucket |
| 7 | WindowAgg | ExecWindowAgg | ExecEvalExpr (window func) | N/A |
| 8 | ProjectSet | ExecProjectSet | ExecEvalExpr (SRF in targetlist) | N/A |
| 9 | ModifyTable | ExecModifyTable | ExecEvalExpr (SET/WHERE exprs) | N/A |
| 10 | Limit | ExecLimit | N/A | N/A |
| 11 | Material | ExecMaterial | N/A | N/A |
| 12 | Memoize | ExecMemoize | N/A | ExecMemoizeGetHashValue |
| 13 | Gather | ExecGather | N/A | N/A |
| 14 | Gather Merge | ExecGatherMerge | N/A | ApplySortComparator (ST_COMPARE) |
| 15 | LockRows | ExecLockRows | N/A | N/A |
| 16 | SetOp | ExecSetOp | N/A | execTuplesMatchPrepare / Compare |

### Table 4: Set & Control Nodes

| No. | Node | Exec Function | Expression Evaluation | Infrastructure Callback |
| :-- | :-- | :-- | :-- | :-- |
| 1 | Append | ExecAppend | N/A | N/A |
| 2 | Merge Append | ExecMergeAppend | N/A | ApplySortComparator (ST_COMPARE) |
| 3 | Result | ExecResult | ExecQual, ExecProject | N/A |
| 4 | Recursive Union | ExecRecursiveUnion | N/A | N/A |

### 单独说明：Table Function Materialization（表函数物化计算）

在原生 PostgreSQL 中，**仅 `Function Scan` 算子**涉及此类计算。当函数被用作 FROM 子句中的数据源（即 SRF，Set-Returning Function）时，PG 执行引擎会通过 `ExecMakeTableFunctionResult` 接管控制权，循环调用该函数的 SRF 接口，并将返回的多行结果物化到内存或磁盘的 `Tuplestore` 中。此计算路径独立于表达式求值和基础设施回调，是 PG 内核中第三种且唯一的表函数专用计算机制。注意：`TableFunc Scan`（如 XMLTABLE/JSON_TABLE）走的是专门的 TableFunc API，不经过 `ExecMakeTableFunctionResult`，因此不属于此类。

SELECT \* FROM generate_series(1, 1000000);  
SELECT \* FROM pg_stat_activity;

# 2 驱动加密 - 实现

## 2.1 新增类型ciphera

1.  pg_type.dat

2.  ciphera.h / ciphera.c

    ````c
    ```
    ```c
    ````

3.  pg_proc.dat
4.  Makefile

验证：

```sql
psql -d postgres

-- 查看内置的数据类型
SELECT * FROM pg_type WHERE typname = 'ciphera';

-- 使用新类型
CREATE TABLE t1(c1 INT, c2 CIPHERA);

\d t1

-- 检查数据正常处理
INSERT INTO t1 VALUES (1, 'c101aaff');

SELECT * FROM t1;
```

## 2.2 新增系统表pg_key

```sql
SELECT * FROM pg_key;

\d+ pg_key
```

## 2.3 新增语法DATA KEY

```sql
CREATE DATA KEY dk1(password='pass.123');
-- 在pg_key中，存储密钥信息

SELECT * FROM pg_key;

DROP DATA KEY dk1;
```

## 2.4 新增系统表pg_sec_class

```sql
SELECT * FROM pg_sec_class;
    -- reloid, attname, atttypid, atttypmod
```

## 2.4 新增语法ENCRYPT

```sql
CREATE DATA KEY dk1(password='pass.123');
CREATE TABLE t1(c1 INT ENCRYPT dk1);
    -- pg_attribute中，c1列的类型自动变更为ciphera
    -- pg_sec_class中，attroid列，存储c1列才pg_attribute中的oid
    -- pg_sec_class中，attrtype, attrmod

SELECT * FROM pg_attribute WHERE attname = 'c1';
SELECT * FROM pg_sec_class;
```

## 2.5 新增公共语法解析libgram

## 2.6 libpq重写INSERT

```sql
CREATE DATA KEY dk1(password='pass.123');
CREATE TABLE t1(c1 TEXT, c2 TEXT ENCRYPT dk1, c3 TEXT);

INSERT INTO t1 VALUES ('aaa', 'bbb', 'ccc');
INSERT INTO t1(c2,c3) VALUES ('xxx', 'yyy');
INSERT INTO t1 VALUES ('a1', 'b1', 'c1'), ('a2', 'b2', 'c2');

SELECT * FROM t1;
```

## 2.7 libpq重写SELECT结果

```sql
CREATE DATA KEY dk1(password='pass.123');
CREATE TABLE t1(c1 TEXT, c2 TEXT ENCRYPT dk1, c3 TEXT);

INSERT INTO t1 VALUES ('aaa', 'bbb', 'ccc'), ('xxx', 'yyy', 'zzz');;

SELECT * FROM t1 WHERE c2 = 'yyy';
    -- where ciphera_eq(c2,'...')
```

## 2.8 新增支持int类型

```sql
CREATE DATA KEY dk1(password='pass.123');
CREATE TABLE t1(c1 INT, c2 INT ENCRYPT dk1, c3 INT);

INSERT INTO t1 VALUES (10,11,12);
INSERT INTO t1(c2,c3) VALUES (100,101);
INSERT INTO t1 VALUES (1001,1002,1003), (1011,1012,1013);

SELECT * FROM t1 WHERE c2 = 100;
```

# 3 机密计算 - 实现

## 3.1 简单计划

-   目标

    ```sql
    -- 构造
    CREATE DATA KEY dk1(password='pass.123');
    CREATE TABLE t1(c1 INT, c2 INT ENCRYPT dk1, c3 INT);
    INSERT INTO t1 VALUES (11,12,13), (21,22,23), (31,32,33), (41,42,43);
    -- 预期：tee中，执行ciphera_gt
    SELECT * FROM t1 WHERE c2 > 30;
    -- 清理
    DROP TABLE t1;
    DROP DATA KEY dk1;
    ```

-   AI提示  
    我已经在pg16中，从0实现全密态等值查询，使用方法如下：

    ```sql
    --
    -- 1 定义密钥（新增语法）：在系统表pg_key中，存储密钥
    CREATE DATA KEY dk1(password='pass.123');
    -- 2 新增内置数据类型：新增ciphera类型，存储text, int加密后的值，类似与bytea
    -- 3 定义加密列（新增语法 ）：在系统表 pg_attrbute中，c2存储为ciphera类型，在新系统表pg_sec_class中，存储c2的原始类型int
    CREATE TABLE t1(c1 INT, c2 INT ENCRYPT dk1, c3 INT);
    -- 4 自动加密：在libpq中，自动加密INSERT语法中c2列的值，将其转换为ciphera类型
    INSERT INTO t1 VALUES (11,12,13), (21,22,23), (31,32,33), (41,42,43);
    -- 5 自动解密：在libpq中，自动解密SELECT返回结果中c2的值，将其转换为int类型
    SELECT * FROM t1;
    -- 6 密态等值查询：自动加密SELECT语法中c2列的值，服务端直接比较密文
    SELECT * FROM t1 WHERE c2 = 12;
    ```

    其中，支持自动加解密的数据类型如下：

    -   int2
    -   int4
    -   int8
    -   varchar(n)
    -   text
    -   bytea

    执行计划  

    ```sql
    CREATE TABLE t1(c1 INT, c2 INT ENCRYPT dk1, c3 INT);
    INSERT INTO t1 VALUES (11,12,13), (21,22,23), (31,32,33), (41,42,43);
    -- 在代码中，以下SQL的执行计划
    SELECT sum(c1) FROM t1 WHERE c1 > 10 AND c2 < 40;
    "Agg
        -> Scan t1
            Filter (c1 > 10) AND (c2 < '40'::ciphera) "

    SELECT c1,c2 FROM t1 WHERE c2 < 40 ORDER BY c2 LIMIT 10;
    "LIMIT
        -> Sort
            Sort Key: c2
            -> Scan t1
                Filter c2 < '40' "

    -- 如果数据很多，要确保以下计算速度最快，怎么创建索引优化呢？注意c1加密，c2不加密。
    SELECT * FROM t1 WHERE c1 > 10 AND c2 < 40;
    SELECT * FROM t1 WHERE c1 > 10 OR c2 < 40;
    ```

    现在，我要在服务端实现机密计算，支持int类型的各种操作，我要新增一批ciphera的运算函数，比如cipehra_lt等，cipehra_lt中，解密数据，然后转换为int4_lt。为覆盖int的各种运算，我需要新增的ciphera运算函数应该包含哪些？

## 3.2 支持范围

### 一、数据类型

```
- 一、数值与字符串
    | 类型 | 别名 | 说明 |
    | -| -| -|
    | smallint | int2 | - |
    | integer | int, int4 | - |
    | bigint | int8 | - |
    | real | float4 | - |
    | double precision | float8 | - |
    | character varying(n) | varchar(n) | - |
    | character(n) | char(n) | - |
    | text | - | - |
- 二、时间、布尔、二进制
    | 类型 | 别名 | 说明 |
    | -| -| -|
    | boolean | bool | - |
    | bytea | - | - |
- 三、其他
    | 类型 | 别名 | 说明 |
    | -| -| -|
    | numeric(p,s) | decimal(p,s) | - |
```

### 二、操作符与函数

```
- 一、比较运算符函数
    | 运算符 | 函数 |
    | -| -|
    | < | ciphera_lt |
    | <= | ciphera_le |
    | = | ciphera_eq |
    | != / <> | ciphera_ne |
    | > | ciphera_gt |
    | >= | ciphera_ge |
    | (btree) | bt_ciphera_cmp |
- 二、算术运算符函数
    | 运算符 | 函数 |
    | -| -|
    | + | ciphera_pl |
    | - | ciphera_mi |
    | * | ciphera_mul |
    | / | ciphera_div |
    | % | ciphera_mod |
    | @ | ciphera_abs |
- 三、位运算符函数
    | 运算符 | 函数 |
    | -| -|
    | & | ciphera_bitand |
    | \| | ciphera_bitor |
    | # | ciphera_bitxor |
    | ~ | ciphera_bitnot |
    | << | ciphera_bitshiftleft |
    | >> | ciphera_bitshiftright |
- 四、字符串与二进制操作函数
    | 运算符 / 函数名 | 函数 |
    | -| -|
    | \|\| | ciphera_cat |
    | length() | ciphera_length |
    | substr() | ciphera_substr |
    | lower() | ciphera_lower |
    | upper() | ciphera_upper |
    | trim() | ciphera_trim |
    | replace() | ciphera_replace |
    | position() | ciphera_position |
    | like | ciphera_like |
    | ilike | ciphera_ilike |
    | ~ / ~* | ciphera_regexp_match |
- 五、聚合状态转换函数
    | 聚合函数 | 函数 |
    | -| -|
    | SUM() | ciphera_sum |
    | MAX() | ciphera_larger |
    | MIN() | ciphera_smaller |
    | AVG() | ciphera_avg_accum |
    | STRING_AGG() | ciphera_string_agg |
```

## 3.2 新增libcalc

## 3.2 新增ta_calc/ca_calc

-   ca_calc：独立进程。自动生成pg的各种计算int2，text等计算，比如int2eq等，格式化入参，通过共享内内存的方式，把数据发送给ta_calc进程，等待计算结果。
-   ta_calc：独立进程。通过共享内存，接收ca_calc发送的数据，并且反格式化，并调用libcalc.so接口，完成计算，把计算结果返回给ca_calc。

## 3.3 内核新增ciphera函数

```sql
SELECT oid,proname,prorows,pronargs,proargtypes,prorettype,pronargdefaults,proargnames,prosrc FROM pg_proc WHERE proname like '%cipher%';

SELECT
    oid,
    proname,
    prorows,
    pronargs,
    (SELECT string_agg(format_type(oid, NULL), ', ' ORDER BY ord) FROM unnest(proargtypes) WITH ORDINALITY AS u(oid, ord)) AS argin,
    format_type(prorettype, NULL) AS argout,
    pronargdefaults,
    proargnames,
    prosrc
FROM pg_proc WHERE proname LIKE '%cipher%' ORDER BY oid;
```

## 3.4 内核新增ciphera运算符

## 3.5 内核make_op识别机密计算

## 3.6 index_scan算子

```sql
CREATE TABLE t1(c1 INT, c2 TEXT, c3 INT);
CREATE INDEX i1 ON t1(c1,c2);
-- 假设t1有很多数据，且analyze过
-- 哪些查询会走索引？哪些不走？给一些例子！要全一点

-- 走索引：
SELECT * FROM t1 WHERE c1 = 1；
SELECT * FROM t1 WHERE c1 = 1 + 1；
SELECT * FROM t1 WHERE c1 IN (1,2,3);
SELECT * FROM t1 WHERE c1 > 1;
SELECT * FROM t1 WHERE c1 > 1 AND c1 < 2;

SELECT * FROM t1 WHERE c1 = 1 AND c2 = 'a'; -- 不能c2 > 'a'

SELECT * FROM t1 ORDER BY c1；
SELECT c1,count(*) FROM t1 GROUP BY c1;

SELECT max(c1) FROM t1;

SELECT * FROm t1 JOIN t2 ON t1.c1 = t2.c1;

DELETE FROM t1 WHERE c1 = 1;
UPDATE t1 SET c2 = 'b' WHERE c1 = 1;

-- 不走索引
SELECT * FROM t1 WHERE c2 = 'a';
SELECT * FROM t1 WHERE c2 > 'a';

SELECT * FROM t1 WHERE c1 + 1 = 2; -- 不行
SELECT * FROM t1 WHERE c1::text = '1';

SELECT * FROM t1 WHERE c1 != 1;
SELECT * FROM t1 WHERE c1 NO IN (1,2,3);

SELECT * FROM t1 WHERE c1 = 1 AND c2 > 'a';

SELECT * FROM t1 WHERE c1 = 5 OR c3 = 10;
```

tpcc 1000 warehouse

-   bmsql_customer 表：
    -   行数：3000w
    -   大小：13.5 G
    -   索引：(c_w_id, c_d_id, c_id)
    -   索引大小：700 M
    -   索引行数：300w
    -   索引层数：3层
        -   root：1 page \* 400 tup/page
        -   internal：400 page \* 400 tup/page
        -   leaf：8.8w page \* 400 tup/page
    -   tee交互次数：3

## 3.6 优化

### ca/ta通信

```bahs
   ca1          ca1         ca2             ca3
+--------[fdbk]+----------[fdbk]+-------------[fdbk]+---------------+

---------
itemdesc
itemdesc
itemdesc
itemdesc

total=1000

p1 alloc off=[0-100]
p2 alloc off=[100-300]
p3 alloc off=[300-700]
p4 alloc off=[700-1000]
p3 free off=[300-700]
p5 alloc len=100, 怎么处理？
p6 alloc len=200，怎么处理？
```

我在使用C语言编程。有个场景：多个生产者，比如是p1,p2,p3,p4。1个消费者s1。每个p1都执行psend，然后执行precv阻塞等待s1反馈。帮我设计并实现一个demo。

# 4 测试用例

## 等值查询

## 范围查询

```sql
-- 构造
CREATE DATA KEY dk1(password='pass.123');
CREATE TABLE t1(c1 INT, c2 INT ENCRYPT dk1, c3 INT);
INSERT INTO t1 VALUES (11,12,13), (21,22,23), (31,32,33), (41,42,43);
-- 预期：tee中，执行ciphera_gt
SELECT * FROM t1 WHERE c2 > 30;
-- 清理
DROP TABLE t1;
DROP DATA KEY dk1;
```

## 模糊查询

# 附录：专利

-   SQL改写
    -   select \* from t1 where c1 > 10
    -   select \* from t1 where ciphera_gt(c1, cipherf_10)
-   加密上下文
    -   驱动侧：’Q’修改为’C’：携带 加密上下文版本号
    -   内核侧：CREATE/ALTER/DROP TABLE，CREAT/ALTER/DROP KEY，更新 加密上下文版本号
-   表达式短路求值
    -   内核侧：SELECT .. WHERE cipher > .. OR plian > ..优化为WHERE plian > .. OR cipher > .. OR

# 附录：AI

## 代码要求：

1.  尽量少使用换行，遵循以下格式：

    ```c
    typedef struct CreateDataKeyStmt {
        NodeTag	type;
        char *keyname;
    } CreateDataKeyStmt;

    int funcname(int arg1, char *arg2) /* 要求1：返回值、函数名等放在一行 */
    {
        int tmpa; /* 要求2：缩进统一用1个tab，1个tab是4个空格，确保是4个空格哦 */
        int tmpb; /* 要求3：类型和变量名之间，用1个空格 */

        if (arg1 < 5 && arg < 10 &&
            arg2 != NULL) { /* 要求4：换行缩进1个tab，除了函数定义外，所有大括号不单独换行 */
            /* do something */
        }

        switch (arg1) { /* 要求5：switch和大括号放在同一行 */
            case 30:
                /* do something */
                break;
            case 40:
                /* do something */
                break;
            default:
                break;
        }

        if (arg == NULL) { /* 要求6：即使if中只有1行代码，也加大括号 */
            return -1;
        } else {
            /* do something */
        }

        return 1;
    }
    ```

-   计划
    -   新增libcalc.so
        -   支持的类型：int2,int4,int8,varchar(n),text,bytea
        -   支持的运算：lt, le, eq, ne, gt, ge, bt_cmp, pl, mi, mul, div, mod, abs, bitand, bitor, bitxor, bitnot, bitshiftleft, bitshiftright, cat, length, substr, lower, upper, trim, replace, position, like, ilike, regexp_match, sum, larger, smaller, avg_accum, string_agg
    -   新增内置函数：ciphera内置函数：lt, le, eq, ne, gt, ge, bt_cmp, pl, mi, mul, div, mod, abs, bitand, bitor, bitxor, bitnot, bitshiftleft, bitshiftright, cat, length, substr, lower, upper, trim, replace, position, like, ilike, regexp_match, sum, larger, smaller, avg_accum, string_agg
        -   (ciphera, ciphera)：密文和密文
        -   (ciphera, int2)：密文和明文
    -   独立编译运

# 附录：参考文献

1.  全密态概述：[https://www.jos.org.cn/html/2024/8/7095.htm#outline_anchor_6](https://www.jos.org.cn/html/2024/8/7095.htm#outline_anchor_6)
