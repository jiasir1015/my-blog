+++
title = 'PostgreSQL 3-1 Heapam'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '存储引擎']
weight = 310
ShowToc = true
TocOpen = true
+++
# 1 heamp的简介

前置知识：Relation的基本概念，Tuple的基本概念

## 1.1 heapam接口的功能

heapam是存储模块对上层提供的数据读写接口，这些接口通常是操作1个relation中的1个或多个tuple。  
本文介绍以下4个最常用的接口，即如何向1个relation中写入、删除、更新、读取1个Tuple，接口定义如下：

```c
/* 向relatiion中写入1条tuple */
heap_insert(Relation relation, HeapTuple tup, ...)
/* 从relation中删除1条tuple */
heap_delete(Relation relation, ItemPointer tid, ...)
/* 在relation中，将旧tuple标记删除，并写入1个新tuple */
heap_update(Relation relation, ItemPointer otid, HeapTuple newtup, ...)
/* 从relation中读取数据，每次读取1条数据 */
HeapScanDesc heap_beginscan(Relation relation, ...)
HeapTuple heap_getnext(HeapScanDesc scan)
```

## 1.2 调用heapam接口

```c
/*
 * 此处，以4个常见的SQL为例，介绍数据库如何调用heapam接口
 *  1. INSERT INTO t1 VALUES (1, 'data1');
 *  2. SELECT * FROM t1;
 *  3. DELETE FROM t1 WHERE c1 = 1;
 *  4. UPDATE t1 SET c2 = 'data2' WHERE c1 = 1;
 */
exec_simple_query("SQL语句") /* 该函数是所有SQL语句的统一处理入口  */
    PortalRun()
        PortalRunMulti()
            ProcessQuery()
                ExecutorRun()
                    standard_ExecutorRun()
                        ExecutePlan()
                            ExecProcNode() /* 从这里开始分叉，不同类型的SQL语句，由不同函数处理 */
                                ExecModifyTable()
                                    ExecInsert() /* 处理：INSERT INTO t1 VALUES (1, 'data1') */
                                        heap_insert(relation, tuple, ..)

```

## 1.3 heapam接口的使用场景

实际应用场景中，数据库的存储模块需满足以下关键需求：

-   操作多：1个表需要支持数据写入、查询、更新、删除等操作
-   数据多：1个表可能存储亿级以上的数据
-   并发高：短时间内，可能上百个连接同时读写1个表
-   可靠性高：突然发生断电等特殊情况，数据不会发生错乱
-   性能高：使用一些机制，优化数据访问的速度，比如：缓存、锁等

明确存储接口该解决哪些问题后，了解heapam接口时，可大概清楚每一步的目的。

# 2 Heapam工作流程

## 2.1 heap_insert接口

heap_insert的工作流程分为4个阶段：

```python
heap_insert
    GetCurrentTransactionId
    heap_prepare_insert         # 1. 获取当前事务id，并为Tuple设置事务信息
    RelationGetBufferForTuple   # 2. 读取1个合适的Page，用于存放Tuple，对Page加排他锁
    RelationPutHeapTuple        # 3. 将Tuple存至Page
    XLogBeginInsert             # 4. 生成WAL日志，并将WAL日志写入WAL Buffer中
    XLogInsert
    UnlockReleaseBuffer         #    解锁Page
```

各阶段中，详细流程如下：

1.  获取当前事务id，并为Tuple设置事务信息

    ```python
    GetCurrentTransactionId
    heap_prepare_insert
        HeapTupleHeaderSetXmin
        HeapTupleHeaderSetCmin
        HeapTupleHeaderSetXmax
    ```

2.  从Buffer中，查找1个合适的Page

    ```python
    heap_insert
        RelationGetBufferForTuple
            GetPageWithFreeSpace # 1 首先，根据Tuple的大小，查找fsm，选择合适的Page
                fsm_search
            LOOP:
                ReadBufferBI # 2 从Buffer中，查找指定Page
                    ReadBuffer
                        ReadBufferExtended
                            ReadBuffer_common
                                ...
                LockBuffer(BUFFER_LOCK_EXCLUSIVE) # 3 对Page加排他锁
                if pageFreeSpace < PageGetHeapFreeSpace # 4 对Page加锁后，检查Page的空闲空间，Page空闲空间够，则返回
                    return
                else: # 5 如果在1-3步中，其他进程页操作了Page，导致Page容量变小，则解锁Page，重新查找新Page
                    LockBuffer(BUFFER_LOCK_UNLOCK)
                    RecordAndGetPageWithFreeSpace # 6 记录当前Page的空闲空间，然后查找fms，选择合适的Page，循环到步骤2
                        fsm_set_and_search
                        fsm_search

            # 7 在循环中，未找到合适的Page，则初始化1个新的Page
            LockRelationForExtension(ExclusiveLock)
            ReadBufferBI(P_NEW)
                ReadBuffer
            PageInit
    ```

3.  将Tuple存至Page（详见Page模块）

    ```python
    RelationPutHeapTuple
        PageAddItem
    ```

4.  生成WAL日志，并将WAL日志写入WAL Buffer中（详见WAL模块）

## 2.2 heap_delete接口

heap_delete的工作流程分为4个阶段：

```python
heap_delete
    GetCurrentTransactionId     # 1. 获取当前事务的id
    ReadBuffer                  # 2. 找到待删除Tuple所在的Page
    PageGetItemId
    HeapTupleSatisfiesUpdate    # 3. 判断Tuple是否可见
```

# 3

```c
otherBuffer：update场景，包含旧数据
targetBuffer：插入的页面，默认从上次插入的页面接着插入

Oid heap_insert(Relation relation, HeapTuple tup, CommandId cid, int options, BulkInsertState bistate)
    HeapTuple heaptup = heap_prepare_insert(relation, tup, xid, cid, options)
    Buffer buffer = RelationGetBufferForTuple(relation, heaptup->t_len,InvalidBuffer, options, bistate, &vmbuffer, NULL)
    RelationPutHeapTuple(relation, buffer, heaptup)
    if PageIsAllVisible(BufferGetPage(buffer)):
        visibilitymap_clear(relation, ItemPointerGetBlockNumber(&(heaptup->t_self)), vmbuffer)
    MarkBufferDirty(buffer)

    if !(options & HEAP_INSERT_SKIP_WAL) && RelationNeedsWAL(relation):
        /* 如果是系统表 */
        if RelationIsAccessibleInLogicalDecoding(relation):
            log_heap_new_cid(relation, heaptup)
                ...
                XLogInsert(RM_HEAP2_ID, XLOG_HEAP2_NEW_CID)

        if ItemPointerGetOffsetNumber(&(heaptup->t_self)) == FirstOffsetNumber:
            info |= XLOG_HEAP_INIT_PAGE
            bufflags |= REGBUF_WILL_INIT

        XLogBeginInsert()
        XLogRegisterData((char *) &xlrec, SizeOfHeapInsert)
        XLogRegisterBuffer(0, buffer, REGBUF_STANDARD | bufflags)
        XLogRegisterBufData(0, (char *) &xlhdr, SizeOfHeapHeader)
        XLogRegisterBufData(0, heaptup->t_data + SizeofHeapTupleHeader, heaptup->t_len - SizeofHeapTupleHeader)
        XLogIncludeOrigin()

        recptr = XLogInsert(RM_HEAP_ID, info)
        PageSetLSN(page, recptr)

    CacheInvalidateHeapTuple(relation, heaptup, NULL)
    return HeapTupleGetOid(tup)
```

## init page时机

一共3处：

```c
heap_insert()
    ...
    Buffer buffer = RelationGetBufferForTuple()
    ...
    RelationPutHeapTuple(relation, buffer, heaptup)
    ...
    if ItemPointerGetOffsetNumber(&(heaptup->t_self)) == FirstOffsetNumber:
        info |= XLOG_HEAP_INIT_PAGE

heap_xlog_insert()
    if XLogRecGetInfo(record) & XLOG_HEAP_INIT_PAGE:
        buffer = XLogInitBufferForRedo(record, 0)
            XLogReadBufferForRedoExtended(RBM_ZERO_AND_LOCK)
                if XLogRecHasBlockImage(record, block_id):
                    *buf = XLogReadBufferExtended()
                    page = BufferGetPage(*buf)
                    RestoreBlockImage(record, block_id, page)
                    MarkBufferDirty(*buf)
                else:
                    *buf = XLogReadBufferExtended()
        page = BufferGetPage(buffer)
        PageInit(page, BufferGetPageSize(buffer), 0)
    else:
        XLogReadBufferForRedo(record, 0, &buffer)

    data = XLogRecGetBlockData(record, 0, &datalen)
    htup = &tbuf.hdr
    htup->t_infomask2 = xlhdr.t_infomask2
    htup ... = ...
    PageAddItem(page, (Item) htup, newlen, xlrec->offnum)
    MarkBufferDirty(buffer)

heap_multi_insert(HeapTuple *tuples, int ntuples)
    ...
    while (ndone < ntuples)
        buffer = RelationGetBufferForTuple()
        RelationPutHeapTuple()
        for (nthispage = 1; ndone + nthispage < ntuples; nthispage++)
            RelationPutHeapTuple()
            log_heap_new_cid(relation, heaptup)
        MarkBufferDirty(buffer)

        init = (ItemPointerGetOffsetNumber(&(heaptuples[ndone]->t_self)) == FirstOffsetNumber &&
			PageGetMaxOffsetNumber(page) == FirstOffsetNumber + nthispage - 1)
        if init:
            info |= XLOG_HEAP_INIT_PAGE
        ...

```
