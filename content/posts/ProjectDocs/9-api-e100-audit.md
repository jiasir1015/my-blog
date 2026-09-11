+++
title = '海量 9 接口 E100审计'
date = '2025-06-17T18:18:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['审计']
weight = 900
ShowToc = true
TocOpen = true
+++
1.  配置审计功能  
    通过GUC配置审计功能，新增GUC如下：

| 编号 | 参数名 | 默认值 | 取值范围 | 功能 |
| --- | --- | --- | --- | --- |
| 1 | enable_audit | off | on, off | 控制是否开启审计功能 |
| 2 | aduit_directory | 空 | 任意绝对路径 | 审计日志存储目录，确保数据库用户有权访问。如果取值为空，则默认存储于”数据目录/vb_audit”下 |
| 3 | audit_directory_size | 64M | [64M, -] | 审计日志目录最大空间，如果文件目录达到限制时，最旧的日志文件将被新文件覆盖 |
| 4 | audit_scope | ddl | all, ddl, insert, update, select, delete, function | 审计范围。可设置多个范围，示例：”ddl, update, delete” |
| 5 | audit_buffer_size | 16M | [1M, 1G] | 内存中，审计日志缓冲区大小 |
| 6 | audit_detail | basic,event,sql | basic,event, sql | 控制审计日志详细程度 |
| 7 | audit_unclassfied | on |  |  |

2.  启动审计功能  
    设置审计参数后，重启数据库，内核关键变化如下：

-   申请共享内存：工作线程生成日志后，将日志写入共享内存，该内存为审计日志缓冲区，缓冲区大小由GUC参数audit_buffer_size控制
-   新增进程：新增1个线程，负责将审计缓存区中的日志，存储至文件

3.  生成审计日志  
    执行SQL语句时，如果SQL语句在审计范围内，内核一般会生成1条审计日志，如果SQL语句较复杂，语句中多个子操作会生成多条审计日志。

审计日志中，记录的内容如下：

| 日志字段 | 示例 | 解释 |
| --- | --- | --- |
| 主体类型 | user | 目前，主体类型只支持用户类型 |
| 主体名称 | u1 | 执行操作的用户，即执行SQL前，与数据库建立连接的用户 |
| 操作类型 | create | 针对不同类型的对象，操作不同，例如，针对表有create, insert, select, ..等操作 |
| 操作时间 | 2025-05-01 12:00:01 678956 | 格式：年-月-日 时-分-秒 微秒 |
| 操作XID | 20000 | 事务ID |
| 操作LSN | 0/170F5F0 | 该日志对应的SQL语句，最新生成的XLOG的写入位置 |
| 对象类型 | table | 数据库对象类型，包括database, schema, table, view, … |
| 对象名称 | t1 | 数据库对象名称 |
| 对象数据库 | db1 | 对象属于哪个database |
| 对象命名空间 | sch1 | 对象属于哪个schema |
| SQL语句 | CREATE TABLE t1(c1 INT, c2 TEXT) | 执行操作的原始SQL语句 |

4.  存储审计日志  
    在审计目录下，审计文件设计如下：

-   命名：格式为：adt\_年\_月日\_时分\_秒\_微秒.alog，文件名中包含文件创建时间  
    示例：

    ```bash
    adt_2025_0617_1909_12_425390.blog
    adt_2025_0617_1909_23_105450.blog
    adt_2025_0617_1909_23_352771.blog
    ```

-   格式：为节约空间，采用二进制格式存储日志。可通过内置的函数查询日志，或者通过离线工具audit_tool将二进制文件转换为普通字符文件。
-   大小：单位日志文件最大为64M

5.  查询审计日志

-   可通过内置函数查询日志

    ```sql
    SELECT pg_audit_log("开始时间"， "结束时间");
    -- 示例： SELECT pg_audit_log('2025-05-01 08:00:00', NOW());

    -- 输出（各字段对应的内容见上文）
    subjtype | subjname | optype | optime                     | opxid | oplsn     | objtype | objname | ojbdb | ojbnsp | sql
    ---------+----------+--------+----------------------------+-------+-----------+---------+---------+-------+--------+-------------------------
    user     | u1       | create | 2025-05-01 12:00:01 678956 | 20000 | 0/170F5F0 | table   | t1      | db1   | shc1   | CREATE TABLE t1(c1 INT, c2 TEXT)
    user     | u2       | insert | 2025-05-01 12:01:27 643511 | 2101  | 0/171A900 | table   | t1      | db1   | sch1   | INSERT INTO t1 VALUES (1, 'aa'), (2, 'bb');
    ```

-   可通过离线工具解析日志

    ```bash
    audit_tool decode -f /审计目录/审计文件 -o /任意目录/文件名

    # 示例
    audit_tool decode -f /data/aduit_log/adt_2025_0617_1909_12_425390.blog -o ./2025_0617_1909_12_425390.log
    ```

6.  审计性能规格

-   性能：在业务场景下，或TPCC场景下：
    -   审计范围为ddl，与不开审计相比，性能劣化在5%以内
    -   审计范围为all，即审计含SELECT等所有操作，性能劣化在30%以内

7.  审计注意事项

-   如果审计范围过大，短时间内生成的日志会非常多

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
CREATE OR REPLACE FUNCTION my_concat(text1 text, text2 text) RETURNS text AS $$ SELECT text1 || text2; $$ LANGUAGE sql IMMUTABLE;

SELECT c2 || '_oper' FROM t1;
SELECT my_concat('abc', 'efg');
SELECT my_concat(c2, '_func') FROM t1;
INSERT INTO t1 VALUES (5, my_concat('aaa', '_func')), (6, my_concat('aaa', '_func'));

-- 5 dml & dml
INSERT INTO t1 SELECT * FROM t2;
SELECT * FROM t1 JOIN t2 ON t1.c1 = t2.c1;

CREATE VIEW v1 AS SELECT t1.c1 FROM t1 JOIN t2 ON t1.c1 = t2.c1;
SELECT * FROM v1;

-- ddl & dml
CREATE TABLE t3 AS SELECT * FROM t2;

-- dml & function
CREATE FUNCTION ft1() RETURNS TRIGGER AS $$ BEGIN SELECT count(*) FROM t1; RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ddl & dml & function

-- clean
DROP TABLE t1,t2,t3;

SELECT * FROM pg_audit_log('2025/07/01 12:00:00', '2025/08/01 12:00:00');
SELECT * FROM pg_audit_log('2025/07/01 12:00:00', NOW());
SELECT * FROM pg_audit_log(NULL, NULL);
SELECT * FROM pg_audit_log();
```

```bash
# result of 'pg_audit_log'
# proallargtypes => '{timestamptz,text,text,text,text,text,text,int8,int8,text,text}',
# proargmodes => '{o,o,o,o,o,o,o,o,o,o,o}',
# proargnames => '{optime,subject,optype,object,objdb,objnsp,objname,opxid,optid,sql,extra}',
```

-   设计思路：参考pgaudit
-   改进：function、改进

```python
# pg 14 / E100
PostgresMain
    exec_simple_query()         # 1. 执行SQL
        pg_parse_query()        # 2. 解析语法、分析语义、重写查询、生成计划
        pg_analyze_and_rewrite()
        pg_plan_queries()
            pg_plan_query()
                planner()
                    planner_hook() # ---->
                    standard_planner()
                        ...
                            preprocess_expression() # 函数预求值
                                ...
                                ExecInitExpr()
                                    ..
                                    ExecInitFunc
                                        InvokeFunctionExecuteHook()
                                            RunFunctionExecuteHook()
                                                object_access_hook()
        PortalStart()
        PobtrtalRun()             # 3. 执行计划
            PortalRunMulti()
                if 'DDL':
                    PortalRunUtility() # 执行DDL
                        ProcessUtility()
                            ProcessUtility_hook()
                            standard_ProcessUtility()
                elif 'DML':
                    ProcessQuery() # 执行DML
                        ExecutorStart()
                            ExecutorStart_hook() # ---->
                            standard_ExecutorStart()
                                InitPlan()
                                    ExecCheckRTPerms()
                                        ExecCheckRTEPerms()
                                        ExecutorCheckPerms_hook()
                                    ExecInitNode()
                                        ExecInitFunc()
                                            InvokeFunctionExecuteHook()
                                                RunFunctionExecuteHook()
                                                    object_access_hook()
                        ExecutorRun()
                            ExecutorRun_hook()
                            standard_ExecutorRun()
                                ExecutePlan()
                                    ExecProcNode
                                        ...
                                            FunctionCallInvoke()
                        ExecutorFinish()
                            ExecutorFinish_hook()
                            standard_ExecutorFinish()
                        ExecutorEnd()  # 4. 清理计划
                            ExecutorEnd_hook()
                            standard_ExecutorEnd()
        PortalDrop()
        finish_xact_command()  # 5. 提交事务
            CommitTranscationCommand()
                XLogFlush(XactLastRecEnd) # 等待本事务最后1条xlog落盘
                audit_flush()          # 如果设置了同步落盘日志：等待本事务最后1条adtlog落盘
```
