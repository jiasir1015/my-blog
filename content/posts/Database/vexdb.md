+++
title = '国测 vexdb'
date = '2026-07-27T14:19:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['数据库']
weight = 900
ShowToc = true
TocOpen = true
+++
```sql
-- cn: 50000
-- dn1: 50005
-- dn2: 50010

vsql -d postgres -p 50000 -r

SELECT * FROM PG_DIST_NODE;

CREATE TABLE t1(c1 INT, c2 TEXT);
SELECT create_distributed_table('t1', 'c1');
-- 创建8个分片，dn1和dn2，每个dn有4个分片，即4个表，表名为 t1_$oid
SELECT * FROM pg_dist_shard; -- min和max是hash之后的值
SELECT * FROM pg_dist_shard_placement;
SELECT * FROM pg_dist_partition;

INSERT INTO t1 VALUES(1, 'aa'), (3, 'bb'), (7, 'cc'), (10, 'dd');

vsql -d postgres -p 50005 -r
SELECT oid,relname FROM pg_class WHERE relname like '%t1%';

vsql -d postgres -p 50010 -r
SELECT oid,relname FROM pg_class WHERE relname like '%t1%';
```

```python
# cn
SELECT create_distributed_table('t1', 'c1');
    # --> shard 1 (dn1)
        SELECT worker_apply_shard_ddl_command (12042, 'CREATE TABLE public.t1 (c1 integer, c2 text) WITH (orientation=row, compression=no, fillfactor=80)');
        # dn1
            worker_apply_shard_ddl_command
            ddlnode = ParseTreeNode(sql)
            RelayEventExtendNames(ddlnode, sharid) # 在语法解析树中，把t1名称，修改为t1_$shardid
            ProcessUtilityParseTree
            SELECT worker_apply_shard_ddl_command (12042, 'ALTER TABLE public.t1 OWNER TO shenkun');
    # --> shard 2 (dn2)
        SELECT worker_apply_shard_ddl_command (12043, 'CREATE TABLE public.t1 (c1 integer, c2 text) WITH (orientation=row, compression=no, fillfactor=80)');
        SELECT worker_apply_shard_ddl_command (12043, 'ALTER TABLE public.t1 OWNER TO shenkun');
    # --> shared 3 (dn1)
        ...
    # --> 一共8个分片，每个分片2条SQL！

# cn
INSERT INTO t1 VALUES(1,'aa'),(3,'bb'),(7,'cc'),(10,'dd');
    exec_simple_query
    pg_parse_query
    pg_analyze_and_rewrite
    pg_plan_query
        [planner hook] distributed_planner
            CreateDistributedPlan
            CreateModifyPlan
            RouterInsertJob                      (deferredPruning=true)
            # 返回 CustomScan
    PortalStart
        ExecutorStart
            [DVecExecutorStart] DVecExecutorStart
            BeginCustomScan → DVecBeginScan
                DVecBeginModifyScan
                    RegenerateTaskListForInsert
                    BuildRoutesForInsert
                        FindShardInterval
                        ActiveShardPlacementList
                    RebuildQueryStrings
                        DeparseTaskQuery
                            AppendShardIdToName  # 生成改名后SQL
    PortalRun
        ExecutorRun
            [ExecutorRun_hook] DVecExecutorRun
                ExecCustomScan
                    DVecExecScan
                    AdaptiveExecutor
                        RunDistributedExecution
                            ...
                            SendRemoteCommand
                                StartRemoteTransactionBegin
                                    BeginTransactiionCommand # 生成：BEGIN ISOLATION LEVEL READ COMMITTED;
                                    AssignDistributedTransactionIdCommand # 生成：SELECT assign_distributed_transaction_id(0,20,'...');
                                    SendRemoteCommand # 一次发送2条事务SQL
                                SendRemoteCommand
                                    PQsendQuery # INTO t1_$shardid ..
    CoordinatedRemoteTransactionsPrepare
        ..
            SendRemoteCommand # 发送 REPARE TRANSACTION ..
            SendRemoteCommand # 发送 COMMIT PREPARED ..
    # --> shard 1 (dn1)
        BEGIN ISOLATION LEVEL READ COMMITTED;
        SELECT assign_distributed_transaction_id(0,20,'...');
        INSERT INTO public.t1_12042 AS dvec_table_alias (c1, c2) VALUES (1,'aa'::text)
        REPARE TRANSACTION 'dvecx_...';
        COMMIT PREPARED 'dvecx_...';
        # 执行分布式事务
            INSERT INTO public.t1_12042 AS dvec_table_alias (c1, c2) VALUES (1,'aa'::text)
    # --> shard 2 (dn2)
        INSERT INTO public.t1_12043 AS dvec_table_alias (c1, c2) VALUES (10,'dd'::text)
    # --> shared 3 (d1)
        ...
    # --> 一共8个分片，其中4个分片，各收到1条INSERT语句
    # 多行在同一分片，INSERT语句合并

# cn
SELECT * FROM t1 WHERE c1 > 10;
    exec_simple_query
    pg_parse_query
    pg_analyze_and_rewrite
    pg_plan_query
        [planner hook] distributed_planner
            CreateDistributedPlan
                GetRouterPlanType
                    (一造 multi-shard fan-out(非 router 计划))
                MultiLogicalPlanCreate                      (logical planner:建逻辑计划)
                CreatePhysicalDistributedPlan               (physical planner)
                    ├─ 为命中的每个分片建一个 Task(本表 8 个分片 → 8 个 Task)
                    UpdateTaskQueryString
                    DeparseTaskQuery
                        deparse_shard_query
                            AppendShardIdToName                   # t1 → t1_<shardId>
                            # SELECT * + c1,c2 ; WHERE c1>10 → (c1 OPERATOR(pg_catalog.>) 10)
                            # 包成 CustomScan 返回
    PortalStart
        ExecutorStart
            [DVecExecutorStart] DVecExecutorStart
            BeginCustomScan → DVecBeginScan
    PortalRun
        ExecutorRun
            [ExecutorRun_hook] DVecExecutorRun
            ExecCustomScan
            DVecExecScan
            AdaptiveExecutor
                RunDistributedExecution
                    AssignTasksToConnectionsOrWorkerPool     # 8 个 Task 分给 DN1/DN2 的连接
                    ConnectionStateMachine
                        StartRemoteTransactionBegin
                            *发送: BEGIN + assign(每条 DN 连接首次用,只发一次)
                        BeginTransactionCommand
                            # 生成: BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED
                        AssignDistributedTransactionIdCommand
                            # 生成: SELECT assign_distributed_transaction_id(...)
                        SendRemoteCommand → PQsendQuery
                            *两条合并成一条发出
                            # 发送: SELECT c1,c2 FROM t1_<shardId> WHERE (c1>10)
                            #     DN1 上 4 条 (12042/12044/12046/12048), DN2 上 4 条
    (COMMIT)
        RemoteTransactionCommit
            SendRemoteCommand → PQsendQuery
                # 只读 → 普通 COMMIT(无 PREPARE/COMMIT PREPARED,无 2PC)
                # COMMIT

    # --> shard 1 (dn1)
        SELECT c1, c2 FROM public.t1_12042 t1 WHERE (c2 OPERATOR(pg_catalog.>) 'cc'::text)

SELECT * FROM t1 WHERE c2 > 'cc';
```

```sql
密态：
    cn
        CREATE TABLE t1 (c1 ..)
        INSERT INTO t1 VALUES (..)
        SELECT c1,c2 FROM t1 WHERE ..
    dn
        CREATE TABLE t1_$shardid (c1 ..)
        INSERT INTO t1_$shardid VALUES (..) # values的值不变
        SELECT c1,c2 FROM t1_$shardid WHERE .. # WHERE子句不变
```
