+++
title = 'PostgreSQL 3-2 Transation (v2)'
date = '2026-07-03T16:51:00+08:00'
lastmod = '2026-08-17T18:36:57+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '事务']
weight = 306
ShowToc = true
TocOpen = true
+++
# 概述

假如，2个会话，并发写入数据：

```sql
BEGIN;
INSERT INTO t1 VALUES(1, 'data1');
COMMIT;

BEGIN;
INSERT INTO t1 VALUES(1, 'data2');
COMMIT;
```

加锁逻辑：

```python
exec_simple_query
    pg_parse_query
    pg_analyze_and_rewrite
    pg_plan_queries
    PortalStart
    PortalRun
        PortalRunMulti
            ProcessQuery
                ExecutorStart
                    standard_ExecutorStart
                        InitPlan
                            ExecInitNode
                                ExecInitModifyTable
                                    ExecInitResultRelation
                                        ExecGetRangeTableRelation
                                            table_open(relation, 'RowExclusiveLock') # 8级锁，行级排他锁
                                                relation_open
                                                    LockRelationOid
                                                        LockAcquire
                ExecutorRun
                    standard_ExecutorRun
                        ExecutePlan
                            ...
                                ExecInsert
                                    table_tuple_insert
                                        heapam_tuple_insert
                                            heap_insert
                                                RelationGetBufferForTuple
                                                    LockBuffer
                                                        LWLockAcquire(buffer, 'LW_EXCLUSIVE') # 读写锁
                                                RelationPutHeapTuple
                                                log_heap_insert
```

-   锁
-   HWLock
    -   8级
    -   relation, index, buffer
    -   死锁检测
-   ## LWLocks

    -   buffer

-   SpinLock
-   PresicateLock

## HWLock

| 锁 | 取值 | 操作 |
| --- | --- | --- |
| AccessShareLock | 1 | SELECT |
| RowShareLock | 2 | SELECT FOR UPDATE/SHARE |
| RowExclusiveLock | 3 | INSERT/UPDATE/DELETE |
| ShareUpdateExclusiveLock | 4 | VACUUM/ANALYZE/CRATE INDEX CONCURRENTLY |
| ShareLock | 5 | CREATE INDEX |
| ShareRowExclusiveLock | 6 | row share |
| ExclusiveLock | 7 | block ROW SHARE/SELECT FOR UPDATE |
| AccessExclusiveLock | 8 | ALTER TABLE/DROP TABLE/VACUUM FULL |

```bash
LockRelationOid
    LockAcquireExtended
        hash_search

```

所有进程共享

## LWLocks

类似信号量

-   LW_SHARED
-   LW_EXCLUSIVE

```bash
LWLockAcquire
```

| 目标 | 工具/方法 |
| :-- | :-- |
| 查看当前所有 heavyweight locks | `SELECT * FROM pg_locks;` |
| 查看 LWLock 等待统计 | `SELECT * FROM pg_stat_activity WHERE wait_event_type = 'LWLock';` |
| 查看 LWLock 累计统计 | `SELECT * FROM pg_stat_lwlocks;` (PG16 新增) |
| 跟踪锁获取/释放 | GDB 断点 `LockAcquireExtended`, `LWLockAcquire` |
| 分析死锁 | 日志 `deadlock detected` + `pg_locks` 快照 |
| 观察 SSI 谓词锁 | `debug_parallel_query = off` + GDB `PredicateLockTuple` |
