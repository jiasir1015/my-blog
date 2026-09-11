+++
title = '海量 mac 设计'
date = '2026-03-23T21:41:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['访问控制', '设计文档']
weight = 1400
ShowToc = true
TocOpen = true
+++
# 1 强制访问控制

## 1.1 功能简述

从实现的角度看，当用户执行SQL时，强制访问控制主要实现以下功能：

1.  CREATE ACCESS POLICY ..：在系统表中，记录ACCESS POLICY，以及其中的LABLE等信息
2.  CREATE TABLE ..：创建表时，如果设置acess_policy字段，则自动为表新增1列隐藏列，列名为access_label
3.  INSERT ..：向表插入数据时，根据当前用户的write_label，自动为数据生成access_label列的值。
4.  SELECT ..：从表查询数据时，根据当前用户的read_label，自动为查询语句添加过滤条件has_mac_permission(access_label, read_label)

另外，如果为表设置访问策略，需在索引中同时设置访问策略：

1.  CREATE INDEX ..：自动为索引新增1列，列名为access_label

对于一些其他语法，也许单独适配，包括：

1.  COPY ..：自动修改旧数据的access_label值

## 1.2 实现方案

### 1.2.1 整体流程

本文重点从源码角度，介绍强制访问控制策略如何基于隐藏列，实现强制访问控制，包括：创建、填充、匹配隐藏列等流程。  
核心功能的大致流程如下：

```bash
User                                              Vastbase                        Disk
+---------------------------------------------------+---------------------------------------------------------+
# 管理员
| 1. CREATE ACCESS POLICY .. LEVEL .. LABEL .. -->  |
                                                    | 2. 存储access policy至系统表vb_access_policy -->
                                                    | 3. 存储access level至系统表vb_access_level -->
                                                    | 4. 存储access label至系统表vb_access_label -->
| 5. CREATE TABLE .. (access_policy=..) -->         |
                                                    | 6. 识别是否设置access_policy
                                                    | 7. 自动添加隐藏列access_label
                                                    | 8. 存储access_policy至系统表pg_class -->
                                                    | 9. 存储accessl_label定义至系统表pg_attribute -->
| 10. CREATE USER ..
    ACCESS POLICY .. READ LABEL ..  WRITE LABEL --> |
                                                    | 11. 存储access_policy, read_label, write_label至系统表pg_authid -->
# 普通用户
| 12. vsql -U username -W password -->              |
| 14. set read_label = .. / write_label = ..  -->   |
                                                    | 15. 查询pg_authid，判断read_label/write_label是否合法 <--
                                                    | 16. 设置临时的read_label/write_label
                                                    | 17. 如何用户未自动设置read_label/write_label，自动根据pgauthid设置
| 18. INSERT ..  -->                                |
                                                    | 19. 查询pg_class，判断表是否有access_policy <--
                                                    | 20. 自动为隐藏列赋值，取值为write_label
| 21. SELECT .. -->                                 |
                                                    | 22. 查询pg_class，判断表是否有access_policy <--
                                                    | 23. 语义分析
                                                    | 24. 查询重写：自动新增过滤条件：WHERE has_mac_permission(access_label, read_label)
                                                    | 24. 计划执行：扫描Tuple，根据过滤条件，过滤不满足权限检查的Tuple
```

### 1.2.2 详细流程

#### 一、创建策略

当用户创建策略时，例如：

```sql
CREATE ACCESS POLICY p1
    LEVLE l1=10, l2=20, l3=30
    MARK ma, mb
    LABEL lab1=l1, lab2=l2, laba1=l1:ma, labb1=l1:mb;
```

内核将access policly, level, mark, label等信息存储在多个系统表中。系统表定义如下：

```sql
-- 存储访问控制策略
SELECT * FROM vb_access_policy;
  poloid | polname
  -------+---------
  17001  | p1

-- 存储LEVEL
SELECT * FROM vb_access_level;
  polid | levname | levnum (int32类型)
  ------+---------+--------
  17001 | l1      | 10
  17001 | l2      | 20
  17001 | l3      | 30

-- 存储MARK
SELECT * FROM vb_access_mark;
    polid | marname | marval (uint32类型)
    ------+---------+-----------
    17001 | ma      | 0x00000001
    17001 | mb      | 0x00000002

-- 存储LABEL
SELECT * FROM vb_access_label;
    polid | labname | levname | marname | labval (uint64类型,高32位存储levle值，低32位存储mark值)
    ------+---------+---------+---------+--------------------
    17001 | lab1    | l1      | ma      | 0x0000011000000001
```

#### 二、创建表

用户创建表时，例如：

```sql
CREATE TABLE t1(c1 INT, c2 TEXT) WITH (access_policy = p1);
```

内核判断如果用户设置了access_policy，则自动为表新增1列隐藏列，列名为access_label，存储每行数据的访问控制标签，等价于用户执行：

```sql
CREATE TABLE t1(c1 INT, c2 TEXT，access_label UINT64) (access_policy = p1);
```

在代码中，关键实现流程如下：

```python
@pg.16
PostgresMain
    exec_simple_query('CREATE TABLE t1(c1 INT, c2 TEXT) WITH (access_policy = p1);') # 1. 定义表，启用强制访问控制
        pg_parse_query # 2. 语法解析
        PortalStart
        PortalRun
            PortalRunMulti
                PortalRunUtility
                    ProcessUtility
                        standard_ProcessUtility # 3. 执行DDL
                            ProcessUtilitySlow
                                transformCreateStmt # 3.1 语义分析与预处理
                                    foreach(CreateStmt.tableElts) # 格式化用户定义的列
                                        transformColumnDefinition
                                            lappend(CreateStmtContext.columns)
                                    if CreateStmt.options has 'access_policy' # 如何设置访问策略，自动新增隐藏列
                                        'makeNode(ColumnDef)' # 列名：access_label, 类型：uint64
                                        'transformColumnDefinition'
                                            'lappend(CreateStmtContext.columns)'
                                DefineRelation # 3.2 在系统表中存储表信息
                                    MergeAttributes
                                    BuildDescForRelation
                                    heap_create_with_catalog
                                        AddNewRelationTuple('pg_class', CreateStmt.options) # 在pg_class中，存储access_policy的取值
                                        'AddNewAttributeTuples('pg_attribute', CreateStmtContext.columns)' # 在pg_attribute中，存储新增的隐藏列access_label
```

#### 三、创建用户

#### 四、登录集群

#### 五、插入数据

用户插入数据时，例如：

```sql
INSERT INTO t1 VALUES (1, 'data1');
```

内核判断如果为表设置了access_policy，则在物化行数据阶段，自动填充隐藏列的值，等价于用户执行：

```sql
INSERT INTO t1 VALUES (1, 'data1', $write_label);
-- write_label：会话级GUC参数write_label的取值
```

在代码中，关键实现流程如下：

```python
@pg.16
PostgresMain
    exec_simple_query('INSERT INTO t1 VALUES (1, 'data1');') # 1. 执行INSET语法
        pg_parse_query  # 2. 语法解析
        pg_analyze_and_rewrite_fixedparams
            parse_analyze_fixedparams # 3. 语义分析
            pg_rewrite_query # 4. 查询重写
        pg_plan_queries # 5. 计划生成
            pg_plan_query
        PortalStart
        PortalRun # 6. 计划执行
            PortalRunMulti
                ProcessQuery
                    ExecutorStart
                        standard_ExecutorStart
                            InitPlan # 6.1 初始化计划
                                ExecInitNode
                                    ExecInitModifyTable
                                        ExecInitResultRelation
                                            ExecGetRangeTableRelation # 初始化relation结构体
                                                table_open
                                                    relation_open
                                                        RelationIdGetRelation
                                                            RelationBuildDesc
                                                                'ScanPgRelation' # 从pg_class系统表中获取表的access_policy信息
                                                                    systable_beginscan(pg_class)
                    ExecutorRun
                        ExecProcNode
                            ExecModifyTable
                                ExecInsert # 6.2 执行insert算子
                                    ExecMaterializeSlot # 物化行数据 (1, 'data1')，生成tuple
                                        tts_heap_materialize
                                    'if Relation.access_policy' # 修改tuple，为access_label列赋值，取值为guc参数write_label
                                        'mac_insert_tuple_label'
                                            'heap_modify_tuple'
```

#### 六、查询数据

用户查询数据时，例如：

```sql
SELECT * FROM t1 WHERE c1 > 1;
```

内核判断如果为表设置了access_policy，则在查询重写阶段，自动新增权限判断过滤条件，等价于用户执行：

```sql
SELECT * FROM t1 WHERE has_mac_permission(access_label, $read_label) AND c1 > 1;
-- access_label：t1中的隐藏列
-- read_label：会话级GUC参数read_label的取值
```

在代码中，关键实现流程如下：

```python
@pg.16
PostgresMain
    exec_simple_query('SELECT * FROM t1 WHERE c1 > 1;') # 1 执行SELECT语法
        pg_parse_query  # 2 语法解析
        pg_analyze_and_rewrite_fixedparams
            parse_analyze_fixedparams # 3 语义分析
            pg_rewrite_query # 4 查询重写
                QueryRewrite
                    RewriteQuery # 4.1 重写INSERT/UPDATE/DELETE/...
                    fireRIRrules # 4.2 重写SELECT
                        table_open
                        get_row_security_policies # 4.2.1 为表设置行级访问控制策略
                            get_policies_for_relation
                            add_security_quals
                                RangeTblEntry->securityQuals
                        'if Relation.access_policy:' # 4.2.3 为表设置强制访问策略
                            'mac_set_relation_quals'
                                'RangeTblEntry->securityQuals += has_mac_permission(access_label, read_label)'
        pg_plan_queries # 5 计划生成
            pg_plan_query
                planner
                    standard_planner
                        subquery_planner
                            pull_up_subqueries
                            preprocess_qual_conditions
                            grouping_planner
                                query_planner
                                    build_simple_rel # 5.1 初始化表的过滤条件
                                        'RelOptInfo.baserestrictinfo = securityQuals'
                                    make_one_rel
                                        set_base_rel_pathlists # 5.2 查找扫描路径：查找所有Scan类型
                                            set_rel_pathlist
                                                set_plain_rel_pathlist
                                                    create_seqscan_path
                        get_cheapest_fractional_path
                        create_plan
                            create_plan_recurse
                                create_scan_plan
                                    create_seqscan_plan # 5.3 生成扫描算子
                                        'SeqScan.qual = RelOptInfo.qual'
        PortalStart
        PortalRun # 6 计划执行
            PortalRunSelect
                ExecutorRun
                    standard_ExecutorRun
                        ExecutePlan
                            ExecProcNode
                                ExecScan # 6.1 执行scan算子
                                    ExecScanFetch # 扫描tuple
                                    ExecQual # 执行过滤条件
                                        ExecEvalExprSwitchContext
                                            'has_mac_permission(tuple.access_label, $read_label)' # 判断tuple是否满足过滤条件
```

#### 七、更新数据

#### 八、创建索引

## 1.3 接口说明

1.  新增SQL语法：ACCESS POLICY

    ```sql
    CREATE ACCESS POLICY $policy_name
        [LEVEL $level_name=$level_number [, $level_name=$level_number ...]]
        [MARK $mark_name [, $mark_name ...]]
        LABEL $label_name={$level_name | $mark_name | $level_name:$mark_name [, ...]}

    ALTER ACCESS POLICY $policy_name
        [ADD LEVEL $level_name=$level_number [, $level_name=$level_number ...]]
        [ALTER LEVEL $level_name=$level_number [, $level_name=$level_number ...]]
        [DROP LEVEL $level_name [, $level_name ...]]
        [ADD MARK ..]
        [ALTER MARK ..]
        [DROP MARK ..]
        [ADD LABEL ..]
        [ALTER LABEL ..]
        [DROP LABEL ..]

    DROP ACCESS POLICY [IF EXISTS] $policy_name [, $policy_name];
    ```

2.  扩展SQL语法：CREATE/ATLER USER

    ```sql
    CREATE/ALTER USER $user_name
        [ACCESS POLICY $policy_name WRITE $label_list READ $label_list]
    ```

3.  扩展SQL语法：CREATE/ALTER TABLE

    ```sql
    CREATE TABLE $table_name .. WITH (access_policy = $policy_name);
    ALTER TABLE $table_name .. WITH (access_policy = none);
    ```

4.  新增会话级GUC参数write_label
5.  新增会话级GUC参数read_label
6.  新增系统表vb_access_policy
7.  新增系统表vb_access_level
8.  新增系统表vb_access_mark
9.  新增系统表vb_access_label
10.  扩展系统表pg_authid：新增2列rolaccpol，rolacclab
11.  新增系统函数has_mac_permission(uint64, uint64)

## 1.4 内存管理

未新增共享内存。只在query的内存上下中，临时存储与访问策略相关的信息，所有新申请内存的生命周期与query内存上下文一致。

## 1.5 安全

强制访问控制，与自主访问控制、行级访问控制共存，即当主体访问客体时，同时生效。  
审计新增的DDL语法：CREATE/ALTER/DROP ACCESS POLICY。

## 1.6 性能

tpcc场景，为所有表设置访问策略，与不设置相比，性能劣化不高于5%

## 1.7 专利

无

## 1.8 升级管理

对系统元数据影响：

-   新增2个GUC：write_label、read_label
-   新增4个系统表：vb_access_policy、vb_access_level、vb_access_mark、vb_access_label
-   修改系统表：pg_authid：新增2列rolaccpol，rolacclab  
    对用户表影响：
-   无：当前版本，仅支持CRETE TABLE阶段设置访问策略

## 1.9 其他说明

无
