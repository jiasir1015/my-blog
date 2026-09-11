+++
title = 'PostgreSQL 2-4 Plan'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '查询优化']
weight = 204
ShowToc = true
TocOpen = true
+++
# SQL 引擎

# 1 概述

## 1.1 生成计划的目的

上文提到，在语法分析、语义分析之后，PostgreSQL已获取执行所需的详细信息。计划生成主要针对一些复杂的SQL语句，主要是SQL语句，计划器主要告诉PostgreSQL，如何更高效地执行复杂的SQL语句：

-   示例1  
    假设，有1个表，表上有1个索引，表中有1000万条数据

    ```sql
    CREATE TABLE t1 (c1 INT, c2 TEXT);
    CREATE INDEX i1 ON t1(c1);
    INSERT INTO t1 .. -- 假设1000万条数据
    ```

    当用户执行以下SQL语句时，数据库需要从t1表中，依次扫描所有的数据，此时，索引并没有什么作用：

    ```sql
    SELECT * FROM t1;
    ```

    当用户执行以下数据时，数据有2种执行方案：
-   语句

    ```sql
    SELECT * FROM t1 WHERE c1 = 10000;
    ```

-   方案1：依次扫描t1表所有数据，然后找到c1=10000的几行
-   方案2：先扫描索引i1，找到c1=10000的几行数据所在的位置，再去t1表中指定位置读取数据  
    显然，上述示例中，方案2的执行速度更快，数据库需要根据一定的策略，选择哪种执行方案。这便是计划器的职责。

## 1.2 生成计划的场景

1.  SQL语法

    ```sql
    CREATE TABLE t1 (c1 INT, c2 TEXT);
    INSERT INTO t1 VALUES (1, 'data-1'), (2, 'data-2');
    ANALYZE;
    SELECT * FROM pg_statistic WHERE starelid = 't1'::regclass;
    ```

## 1.3 计划的简单表示

## 1.4 算子的分类

共40个

-   扫描算子(16)

    | Node | Init Function | Exec Function | End Function |
    | :-- | :-- | :-- | :-- |
    | Seq Scan | ExecInitSeqScan | ExecSeqScan | ExecEndSeqScan |
    | Index Scan | ExecInitIndexScan | ExecIndexScan | ExecEndIndexScan |
    | Index Only Scan | ExecInitIndexOnlyScan | ExecIndexOnlyScan | ExecEndIndexOnlyScan |
    | Bitmap Heap Scan | ExecInitBitmapHeapScan | ExecBitmapHeapScan | ExecEndBitmapHeapScan |
    | Bitmap Index Scan | ExecInitBitmapIndexScan | ExecBitmapIndexScan | ExecEndBitmapIndexScan |
    | Tid Scan | ExecInitTidScan | ExecTidScan | ExecEndTidScan |
    | Tid Range Scan | ExecInitTidRangeScan | ExecTidRangeScan | ExecEndTidRangeScan |
    | Subquery Scan | ExecInitSubqueryScan | ExecSubqueryScan | ExecEndSubqueryScan |
    | Function Scan | ExecInitFunctionScan | ExecFunctionScan | ExecEndFunctionScan |
    | Table Func Scan | ExecInitTableFuncScan | ExecTableFuncScan | ExecEndTableFuncScan |
    | Values Scan | ExecInitValuesScan | ExecValuesScan | ExecEndValuesScan |
    | CTE Scan | ExecInitCteScan | ExecCteScan | ExecEndCteScan |
    | Named Tuplestore Scan | ExecInitNamedTuplestoreScan | ExecNamedTuplestoreScan | ExecEndNamedTuplestoreScan |
    | WorkTable Scan | ExecInitWorkTableScan | ExecWorkTableScan | ExecEndWorkTableScan |
    | Foreign Scan | ExecInitForeignScan | ExecForeignScan | ExecEndForeignScan |
    | Sample Scan | ExecInitSampleScan | ExecSampleScan | ExecEndSampleScan |

-   连接算子(3)

    | Node | Init Function | Exec Function | End Function |
    | :-- | :-- | :-- | :-- |
    | Nested Loop | ExecInitNestLoop | ExecNestLoop | ExecEndNestLoop |
    | Hash Join | ExecInitHashJoin | ExecHashJoin | ExecEndHashJoin |
    | Merge Join | ExecInitMergeJoin | ExecMergeJoin | ExecEndMergeJoin |

-   聚集算子(15)

    | Node | Init Function | Exec Function | End Function |
    | :-- | :-- | :-- | :-- |
    | Sort | ExecInitSort | ExecSort | ExecEndSort |
    | Incremental Sort | ExecInitIncrementalSort | ExecIncrementalSort | ExecEndIncrementalSort |
    | Aggregate | ExecInitAgg | ExecAgg | ExecEndAgg |
    | Group | ExecInitGroup | ExecGroup | ExecEndGroup |
    | Unique | ExecInitUnique | ExecUnique | ExecEndUnique |
    | Hash | ExecInitHash | ExecHash | ExecEndHash |
    | Limit | ExecInitLimit | ExecLimit | ExecEndLimit |
    | Material | ExecInitMaterial | ExecMaterial | ExecEndMaterial |
    | Memoize | ExecInitMemoize | ExecMemoize | ExecEndMemoize |
    | Gather | ExecInitGather | ExecGather | ExecEndGather |
    | Gather Merge | ExecInitGatherMerge | ExecGatherMerge | ExecEndGatherMerge |
    | Window Agg | ExecInitWindowAgg | ExecWindowAgg | ExecEndWindowAgg |
    | Set Op | ExecInitSetOp | ExecSetOp | ExecEndSetOp |
    | Lock Rows | ExecInitLockRows | ExecLockRows | ExecEndLockRows |
    | Modify Table | ExecInitModifyTable | ExecModifyTable | ExecEndModifyTable |

-   物化算子(6)

    | Node | Init Function | Exec Function | End Function |
    | :-- | :-- | :-- | :-- |
    | Append | ExecInitAppend | ExecAppend | ExecEndAppend |
    | Merge Append | ExecInitMergeAppend | ExecMergeAppend | ExecEndMergeAppend |
    | Result | ExecInitResult | ExecResult | ExecEndResult |
    | Project Set | ExecInitProjectSet | ExecProjectSet | ExecEndProjectSet |
    | Recursive Union | ExecInitRecursiveUnion | ExecRecursiveUnion | ExecEndRecursiveUnion |
    | Custom Scan | ExecInitCustomScan | ExecCustomScan | ExecEndCustomScan |

# 2 算子

## 2.0 算子分类

### 一、扫描算子

```
- SeqScan
    CREATE TABLE t1 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (generate_series(1, 1000), 'data');
SELECT * FROM t1 WHERE c1 = 1;
- SampleScan
    CREATE TABLE t1 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (generate_series(1, 1000), 'data');
SELECT count(*) FROM t1 TABLESAMPLE BERNOULLI(10); -- 随机查询约10%的数据
- IndexScan
    CREATE TABLE t1 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (generate_series(1, 1000), 'data');
CREATE INDEX i1 ON t1(c1);
ANALYZE;
SELECT * FROM t1 WHERE c1 = 1;
- IndexOnlyScan
    CREATE TABLE t1 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (generate_series(1, 1000), 'data');
CREATE INDEX i1 ON t1(c1);
ANALYZE;
SELECT c1 FROM t1 WHERE c1 = 1;
- BitmapIndexScan
    - 根据Tid构造Bitmap
- BitmapHeapScan
    - 根据Bitmap扫描表
- TidScan
    CREATE TABLE t1 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (generate_series(1, 1000), 'data');
SELECT * FROM t1 WHERE ctid = '(0, 3)'; -- 查询第0号Page中的第3个Tuple (只查询可见Tuple)
SELECT ctid FROM t1 WHERE c1 = 100;
- FunctionScan
    SELECT * FROM random(); -- 函数的返回值构成1个Tuple
- ValuesScan
    SELECT * FROM (VALUES (1, 'data1'), (2, 'data2'), (3, 'data3')) AS t1(c1, c2);
- CteScan
- ForeignScan
- CustomScan
    - 使用C语言自定义扫描路径与扫描计划
```

### 二、控制算子

```
- Result
    SELECT 1 + 2; -- 场景1：优化一些与常量等价的条件
INSERT INTO t1 VALUES (1, 'data'); -- 场景2：封装一些VALUES子句
- ModifyTable
    CREATE TABLE t1 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (1, 'data');  -- ModifyTable算子包括：INSERT / UPDATE / DELTE 算子
UPDATE t1 SET c2 = 'data2' WHERE c1 = 1;
DELETE FROM t1 WHERE c1 = 1;
- Append
    CREATE TABLE t1 (c1 INT, c2 TEXT);
CREATE TABLE t2 (c1 INT, c2 TEXT);
(SELECT * FROM t1) UNION ALL (SELECT * FROM t2); -- 拼接不同执行计划的结果
- MergeAppend
- RecursiveUnion
- BitmapAnd
- BitmapOr
```

### 三、连接算子

```
- NestLoop
    CREATE TABLE t1 (c1 INT, c2 TEXT);
CREATE TABLE t2 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (generate_series(1, 1000), 'data');
INSERT INTO t2 VALUES (generate_series(1, 100), 'data');
SELECT t1.c1,t2.c1 FROM t1 INNER JOIN t2 ON t1.c1 = 1; -- 2层for循环

-- for i in t1 [tup-1, tup-1000]
--     for j in t2 [tup-1, tup-100]
--          do compare
- MergeJoin
    CREATE TABLE t1 (c1 INT, c2 TEXT);
CREATE TABLE t2 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (generate_series(1, 1000), 'data');
INSERT INTO t2 VALUES (generate_series(1, 100), 'data');
SELECT t1.c1,t2.c1 FROM t1 INNER JOIN t2 ON (t1.c1 = t2.c1); -- 先排序，再循环

-- sort for i in t1 [tup-1, tup-1000]
-- sort for j in t2 [tup-1, tup-100
-- for i in sort [tup-1, tup-1000]
--     for j in sort [tup-1, tup-100]
--          do compare
- HashJoin
    CREATE TABLE t1 (c1 INT, c2 TEXT);
CREATE TABLE t2 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (generate_series(1, 1000), 'data');
INSERT INTO t2 VALUES (generate_series(1, 100), 'data');
SELECT t1.c1,t2.c1 FROM t1 INNER JOIN t2 ON (t1.c1 = t2.c1); -- 先哈希，再循环

-- hash [tup-1, tup-1000]
-- for j in t2 sort [tup-1, tup-100]
--     do compare
```

### 四、物化算子

```
- Material
    CREATE TABLE t1 (c1 INT, c2 TEXT);
CREATE TABLE t2 (c1 INT, c2 TEXT);
SELECT * FROM t1 WHERE c1 > ANY (SELECT c1 FROM t2); -- 如果某些数据集合较大，需增加物化算子缓存数据集合
- Sort
    CREATE TABLE t1 (c1 INT, c2 TEXT);
SELECT * FROM t1 ORDER BY c1;
- Group
    CREATE TABLE t1 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (generate_series(1, 1000), 'data');
SELECT c1 FROM t1 GROUP BY c1 ORDER BY c1;
- Agg
    - HashAgg
    - GroupAgg
    CREATE TABLE t1 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (generate_series(1, 1000), 'data');
SELECT c1 FROM t1 GROUP BY c1; -- 聚合数据，使用HASH聚合
SELECT count(*) FROM t1 GROUP BY c1 ORDER BY c1; -- 聚合数据，使用Group聚合
- WindowAgg
- Unique
    CREATE TABLE t1 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (1, 'data1-1'), (1, 'data1-2'), (2, 'data2');
ANALYZE;
SELECT DISTINCT(c1) FROM t1 GROUP BY c1;
- Hash
- SetOp
- LockRows
- Limit
    CREATE TABLE t1 (c1 INT, c2 TEXT);
INSERT INTO t1 VALUES (1, 'data1-1'), (1, 'data1-2'), (2, 'data2');
SELECT * FROM t1 LIMIT 1;
```

## 2.1 扫描算子

### 问题场景

### 一、SeqScan

```bash
| PageIdx | Tuple Idx | c1 |   c2  |
+---------+-----------+----+-------+
|         |     1     |  6 | data6 |
|   1     |     2     |  8 | data8 |
|         |     3     |  4 | data4 |
+---------+-----------+----+-------+
|         |     1     |  9 | data9 |
|   2     |     2     |  1 | data1 |
|         |     3     |  8 | data8 |
+---------+-----------+----+-------+
```

**源码**

```python
ExecSeqScan
    ExecScan
        ExecScanFetch
            SeqNext
                heap_beginscan
                heap_getnext
                    heapgettup
```

### 二、IndexScan

1.  前置条件：存储数据

    ```bash
    | PageIdx | Tuple Idx | c1 |   c2  |
    +---------+-----------+----+-------+
    |         | 1 [delete]|  6 | data6 |
    |   1     |     2     |  8 | data8 |  存在被删除的数据
    | [delete]|     3     |  4 | data4 |
    +---------+-----------+----+-------+----
    |         |     1     |  9 | data9 |
    |   2     |     2     |  1 | data1 |  不存在被删除的数据
    |         |     3     |  8 | data8 |
    +---------+-----------+----+-------+

            | PageIdx | Tuple Idx | c1 |  tid  |
            +---------+-----------+----+-------+
            |         |     1     |  1 | [2,2] |
            |   1     |     2     |  4 | [1,3] |
            |         |     3     |  6 | [1,1] |
            +---------+-----------+----+-------+
                                                \
                                                 \
                                    | PageIdx | Tuple Idx | c1 |  tid  |
                                    +---------+-----------+----+-------+
                                    |         |     1     |  8 | [1,2] |
                                    |   2     |     2     |  8 | [2,3] |
                                    |         |     3     |  9 | [2,1] |
                                    +---------+-----------+----+-------+
    ```

2.  查询数据

    ```sql
    SELECT * FROM t1 WHERE c1 > 6 AND c1 < 9;
    ```

3.  查找数据
    1.  在Index中，找到c1=8的数据对应的tid=[1,2]
    2.  在Heap中，读取1个Page，获取第2个Tuple
    3.  在Index中，找到c1=8的数据对应的tid=[2,3]
    4.  在Heap中，读取2个Page，获取第3个Tuple
4.  返回数据

    ```bash
     c1 | c2
    ----+--------
     8  | data8
     8  | data8
    ```

**源码**

```python
ExecIndexScan
    ExecScan
        ExecScanFetch
            IndexNext
                index_beginscan
                index_getnext
                    tid = index_getnext_tid # 1 扫描index page, 获取idx tup，获取heap tup的tid
                        amgettuple -> btgettup
                            # 5 如果上次扫描的idx tup对应的heap tup已被删除，将上次扫描的idx tup记录在scan中
                            if scan->kill_prior_tuple:
                                so->killedItems[so->numKilled++]
                    index_fetch_heap  #  2 根据tid，从heap page中，获取heap tup
                        heap_page_prune_opt
                        heap_hot_search_buffer # 3 遍历 hot 链，查找tuple
                        scan->kill_prior_tuple = true # 4 如果未找到，标记当前heap tup已被删除

ExecEndIndexScan
    index_endscan
        amendscan -> btendscan
            _bt_killitems # 6 如果有些heap tup已被删除，将它们对于的idx tup也设置删除标记
                _bt_killitems
                    _bt_getbuf
                    ItemIdMarkDead # ItemId->lp_flags = LP_DEAD
        IndexScanEnd
```

### 三、IndexOnlyScan

功能：直接从Index中获取大部分数据

1.  前置条件：存储数据

    ```bash
    | PageIdx | Tuple Idx | c1 |   c2  |
    +---------+-----------+----+-------+
    |         | 1 [delete]|  6 | data6 |
    |   1     |     2     |  8 | data8 |  存在被删除的数据
    | [delete]|     3     |  4 | data4 |
    +---------+-----------+----+-------+----
    |         |     1     |  9 | data9 |
    |   2     |     2     |  1 | data1 |  不存在被删除的数据
    |         |     3     |  8 | data8 |
    +---------+-----------+----+-------+

            | PageIdx | Tuple Idx | c1 |  tid  |
            +---------+-----------+----+-------+
            |         |     1     |  1 | [2,2] |
            |   1     |     2     |  4 | [1,3] |
            |         |     3     |  6 | [1,1] |
            +---------+-----------+----+-------+
                                                \
                                                 \
                                    | PageIdx | Tuple Idx | c1 |  tid  |
                                    +---------+-----------+----+-------+
                                    |         |     1     |  8 | [1,2] |
                                    |   2     |     2     |  8 | [2,3] |
                                    |         |     3     |  9 | [2,1] |
                                    +---------+-----------+----+-------+
    ```

2.  查询数据  
    必要条件：要查找的列，全在索引文件中

    ```sql
    SELECT c1 FROM t1 WHERE c1 > 6 AND c1 < 9;
    ```

3.  查找数据
    1.  从索引中，基于B+树的原理，快速找到c1=6的Tid为[1,1]
    2.  从Vm文件中，判断第1个表Page是否包含被标记删除的Tuple，发现1第个Page，存在被删除的Tuple
    3.  读取表文件的第1个Page，然后找到第1个Tuple
    4.  从索引中，找到c1=8,Tid=[1,2]的Tuple

**源码**

```python
ExecIndexOnlyScan
    ExecScan
        ExecScanFetch
            IndexOnlyNext
                index_beginscan
                tid = index_getnext_tid # 1 扫描index page, 获取idx tup，获取heap tup的tid
                if !VM_ALL_VISIBLE(tid.ip_blkid) # 2 判断heap tup所在的page，是否全部tup可见
                    tup = index_fetch_heap       # 3 如果非全部可见，扫描haep page，获取heap tup
                    # 如果tup不可见，继续扫描一个idx tup
                ExecStoreTuple # 从idx tup中，获取数据，此次扫描结束
```

### 四、BitmapScan

-   场景1
    1.  多个索引上查询

        ```sql
        CREATE TABLE t1 (c1 INT, c2 INT);
        CREATE INDEX i1 ON t1(c1);
        CREATE INDEX i2 ON t1(c2);
        explain SELECT * FROM t1 WHERE c1 > 5 AND c2 < 5;
        ```

    2.  使用索引 i1，构造bitmap 1
    3.  使用所以 i2，构造bitmap 2
    4.  bitmap 1 AND bitmap 2

3.  查找数据
    1.  找到需要读取的Tuple [1,1] [1,2] [2,3]
    2.  读取第1个Page，获取第1和第2个Tuple
    3.  读取第2个Page，获取第3个Tuple

```python
ExecBitmapIndexScan

ExecBitmapHeapScan
    ExecScan
        ExecScanFetch
            BitmapHeapNext
```

### 五、SubquryScan

### 六、

## 1.1 概述

**优化方法**

-   逻辑优化：RBO：基于规则：关系代数，等价变化
-   物理优化：CBO：查询优化：物理执行路径

## 1.2 逻辑优化

**关系代数**

-   选择
-   投影
-   笛卡尔积
-   并集
-   差集

**非关系代数**

-   聚集
-   分组

**常用方法**

-   选择操作下推
-   叶子节点投影

## 1.2 物理优化

**四个法宝**

-   b+树
-   hash表
-   排序
-   物化

**物理路径搜索**

-   自底向上：动态规划
-   自顶向下：枚举
-   随机搜索

**postgresql**

-   表少：动态规划
-   表多：遗传算法

# 2 查询树

## 结构体

-   Var
-   RangeTblEntry / RangleTblRef
-   JoinExpr
-   FromExpr
-   Query

## 函数

-   query_tree_mutator / query_tree_walker
-   walker：遍历查询树：修改节点值，但不会增加或删除节点
-   mutator：增加或删除节点

# 3 逻辑重写优化

## 3.2 提升子查询

**查询**

-   子连接 sublink：以表达式形式存在
    -   WHERE / ON 子句 （伴随 ANY/ALL/IN/EXISTS/SOME 等谓语）
    -   投影 子句
-   子查询 subquery：范围表形式
    -   FROM 子句

**子查询**

-   相关子查询：子查询引用外层表列属性：外层表执行一次，子查询执行一次 （可提升）
-   非相关子查询：子查询语句独立，外表重复利用子查询结果

## 3.2.1 提升子链接

子链接类型

-   EXISTS_SUBLINK （提升）
-   ALL_SUBLINK
-   ANY_SUBLINK (提升)

```c
exec_simple_query()
    pg_parse_query()
    for (;;):
        pg_analyze_and_rewrite()
        pg_plan_queries()
        PortalRun()
```

## 1.2 计划器

```c
pg_plan_queries()
    pg_plan_query(Query)
        PlannedStmt *plan  = planner(Query)
            standard_planner(Query)
                PlannerGlobal *glob = makeNode(PlannerGlobal)
                subquery_planner(PlannerGlobal *glob, Query *parse, PlannerInfo **subroot)
                    PlannerInfo *root = makeNode(PlannerInfo)
                    root->parse = parse
                    if parse->cteList:
                        SS_process_ctes(root)
                    if parse->hasSubLinks:
                        pull_up_sublinks(root)
                    inline_set_returning_functions(root)
                    pull_up_subqueries(root)
                    if parse->setOperations:
                        flatten_simple_union_all(root)
                    preprocess_rowmarks(root)
                    xpand_inherited_tables(root)
                    parse->targetList = preprocess_expression(root, parse->targetList)
                    parse->returningList = preprocess_expression(root, parse->returningList)
                    preprocess_qual_conditions(root, parse->jointree)
                    parse->havingQual = preprocess_expression(root, parse->havingQual)
                    parse->limitOffset = preprocess_expression(root, parse->limitOffset)
                    parse->limitCount = preprocess_expression(root, parse->limitCount)
                    root->append_rel_list  = preprocess_expression(root, root->append_rel_list)
                    ...
                    if hasOuterJoins:
                        reduce_outer_joins(root)

                    /* do the main plainning */
                    if parse->resultRelation:
                        plan = inheritance_planner(root)
                    else:
                        plan = grouping_planner(root)
                        if parse->commandType != CMD_SELECT:
                            plan = make_modifytable(root, plan, SS_assign_special_param(root))
                    return plan
```

## 1.3 计划器执行流程

```c
grouping_planner(PlannerInfo *root)
    Query *parse = root->parse
    if parse->limitCount || parse->limitOffset:
        preprocess_limit(root)
    if parse->setOperations:
        List *set_sortclauses
        Plan *result_plan = plan_set_operations(root, &set_sortclauses)
        List *current_pathkeys = make_pathkeys_for_sortclauses(root, set_sortclauses, result_plan->targetlist)
        parse->targetList = postprocess_setop_tlist(result_plan->targetlist)
        root->sort_pathkeys = make_pathkeys_for_sortclauses(root, parse->sortClause)
    else:
        ...
        parse->targetList = preprocess_targetlist(root, parse->targetList)
        expand_security_quals(root, parse->targetList)
        ...
        RelOptInfo *final_rel = query_planner(root, standard_qp_callback)
        path_rows = clamp_row_est(final_rel->rows)
        ...
        sorted_path = get_cheapest_fractional_path_for_pathkeys()

```
