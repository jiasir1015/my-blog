+++
title = '数据库安全 9 透明加密'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['加密']
weight = 409
ShowToc = true
TocOpen = true
+++
# 1 透明加密背景

在另一篇博客中，已经讨论了几个话题：

-   数据泄露风险
-   加密方案对比
-   透明加密基本原理

因此，本篇博客直接进入主题，介绍openGauss透明加密特性。

# 2 透明加密使用

## 2.1 开启透明加密

## 2.2 定义加密表

```sql
CREATE TABLE t1 (c1 INT, c2 TEXT) WITH (enable_tde=on);
```

## 2.3 验证数据加密

# 3 透明加密设计

# 4 透明加密原理

# 1 概述

## 1.1 模块

```bash
heapam -> buffer -> smgr -> page
```

# 1 概述

## 1.1 功能

用户创建表时，通过SQL语句指定表是否加密  
数据库将数据页写入磁盘时，判断如果数据页属于加密表，对数据先加密在存储  
数据库从磁盘读取数据页时，判断如果数据页已被加密，读取后马上解密

## 1.2 适配点

-   初始化page
-   存储page
-   读取page
-   生成xlog记录：考虑初始化pagee
-   重放xlog记录：考虑初始化page

## 1.3 kun tde

# 2 调用关系

## 2.1 初始化数据页

### PageInit

```c
PageInit(Page page, Size pageSize, Size specialSize)
    heap_xlog_insert()
    heap_xlog_multi_insert()
    heap_xlog_update()
    heap_xlog_visible()
    raw_heap_insert()
    PageGetTempPageCopySpecial()
    fill_seq_with_data()
    seq_redo()
    brin_page_init()
    lazy_scan_heap()
    GinInitPage()
    GISTInitBuffer()
    _hash_pageinit()
    _bt_pageinit()
    SpGistInitPage()
    vm_readbuf()
    vm_extend()
    XLogRecordPageWithFreeSpace()
    fsm_readbuf()
    fsm_extend()
```

### image

## 2.2 写入数据页

### smgrextend

调用栈：

```c
smgrextend(SMgrRelation reln, ForkNumber forknum, BlockNumber blocknum, char *buffer)
    copy_relation_data()
        ATExecSetTableSpace() /* ALTER TABLE ... TABLESPACE */
            ATRewriteTables()
                ATController()
                    AlterTable()
                    AlterTableInternal()
    raw_heap_insert()
        rewrite_heap_tuple()
            reform_and_rewrite_tuple()
                copy_heap_data()
                    rebuild_relation()
                        cluster_rel()
                            cluster() /* case T_ClusterStmt */
                                standard_ProcessUtility()
                            vacuum_rel()
                                vacuum()
                                    ExecVacuum() /* case T_VacuumStmt  */
                                        standard_ProcessUtility()
                                    autovacuum_do_vac_analyze()
                                        do_autovacuum()
                                            AutoVacWorkerMain()
                                                StartAutoVacWorker() /* TODO */
                                                SubPostmasterMain() /* --forkavworker */
        end_heap_rewrite()
            copy_heap_data()
                /* repeat */
    end_heap_rewrite()
        /* repeat */
    ReadBuffer_common()
        ReadBufferExtended() /* 48 call */
            get_raw_page_internal()
            pg_prewarm()
            statapprox_heap()
            pgstatindex_impl()
            /* TODO */
        ReadBufferWithoutRelcache()
            XLogReadBufferExtended()
                XLogReadBufferForRedoExtended()
                    XLogReadBufferForRedo() /* 58 call */
                    XLogInitBufferForRedo() /* 33 call */
                    heap_xlog_clean()
                    heap_xlog_visible()
                    btree_xlog_vacuum()
                XLogRecordPageWithFreeSpace() /* 剪枝：FSM_FORKNUM */
                    heap_xlog_clean()
                        /* repeat */
                    heap_xlog_insert()
                    heap_xlog_multi_insert()
                    heap_xlog_update()
                btree_xlog_vacuum()
                btree_xlog_delete_get_latestRemovedXid()
    _hash_alloc_buckets()
        _hash_expandtable()
            _hash_doinsert()
                hashbuildCallback()
                hashinsert()
                _h_indexbuild()
    _bt_blwritepage()
    fsm_extend()
    vm_extend()
```

### smgrwrite

调用栈

```c
smgrwrite(SMgrRelation reln, ForkNumber forknum, BlockNumber blocknum, char *buffer)
    FlushBuffer()
        BufferAlloc()
            ReadBuffer_common()
                /* repeat */
        SyncOneBuffer()
            BufferSync()
                CheckPointBuffers()
                    CheckPointGuts()
                        CreateCheckPoint()
                            StartupXLOG()
                                StartupProcessMain()
                                InitPostgres()
                            ShutdownXLOG()
                                CheckpointerMain() /* case CheckpointerProcess */
                                    AuxiliaryProcessMain()
                                InitPostgres()
                            CheckpointerMain()
                                /* repeat */
                            RequestCheckpoint()
                                XLogWrite()
                                StartupXLOG()
                                do_pg_start_backup()
                                XLogPageRead()
                                createdb()
                                dropdb()
                                movedb()
                                DropTableSpace()
                                standard_ProcessUtility() /* case T_CheckPointStmt */
                        CreateRestartPoint()
            BgBufferSync()
                BackgroundWriterMain()
                    AuxiliaryProcessMain() /* case BgWriterProcess */
        FlushOneBuffer()
            XLogReadBufferForRedoExtended()
                XLogInitBufferForRedo()
                    heap_xlog_insert()
                    heap_xlog_multi_insert()
                    heap_xlog_update()
                    seq_redo()
                    ... /* 33 calls, most indexs */
                XLogReadBufferForRedo()
                    xlog_redo()
                    heap_xlog_insert()
                    heap_xlog_multi_insert()
                    heap_xlog_update()
                    heap_xlog_inplace()
                    heap_xlog_delete()
                    heap_xlog_confirm()
                    heap_xlog_visible()
                    heap_xlog_freeze_page()
                    heap_xlog_lock()
                    heap_xlog_lock_updated()
                    ... /* 58 calls, most index */
                heap_xlog_clean()
                heap_xlog_visible()
                btree_xlog_vacuum()
        FlushRelationBuffers()
            /* repeat */
        FlushDatabaseBuffers()
    FlushRelationBuffers()
        heap_sync()
            CopyFrom()
            end_heap_rewrite()
                /* repeat */
            intorel_shutdown()
            transientrel_shutdown()
            ATRewriteTable()
                /* repeat */
        ATExecSetTableSpace()
            /* repeat */
    LocalBufferAlloc()
        ReadBuffer_common()
            /* repeat */
    btbuildempty()
    _bt_blwritepage()
    spgbuildempty()
```

## 2.3 读取数据页

```c
smgrread(SMgrRelation reln, ForkNumber forknum, BlockNumber blocknum, char *buffer)
    pg_prewarm()
    copy_relation_data()
    ReadBuffer_common()
        /* repeat */
```

## 2.4 记录数据

# 3 关键函数

```c
heap_xlog_insert(XLogReaderState *record)
    if XLOG_HEAP_INIT_PAGE:
        XLogInitBufferForRedo()
        PageInit()
    else:
        XLogReadBufferForRedo(record, 0, &buffer)
            XLogReadBufferForRedoExtended(record, 0, RBM_NORMAL, false, buf) {
                XLogRecGetBlockTag(record, block_id, &rnode, &forknum, &blkno)
                if XLogRecHasBlockImage(record, block_id):
                    *buf = XLogReadBufferExtended(rnode, forknum, blkno, RBM_ZERO_AND_LOCK) {
                        smgr = smgropen(rnode, InvalidBackendId)
                        smgrcreate(smgr, forknum, true)
                        lastblock = smgrnblocks(smgr, forknum)
                        if blkno < lastblo:
                            buffer = ReadBufferWithoutRelcache(rnode, forknum, blkno, mode, NULL)
                                smgropen(rnode, InvalidBackendId)
                                ReadBuffer_common(smgr, RELPERSISTENCE_PERMANENT, forkNum, blockNum,mode, NULL, &hit)
                                    BufferAlloc() ... /* see buffer.md */
                        else:
                            ...
                    }
                    page = BufferGetPage(*buf)
                    RestoreBlockImage(record, block_id, page)
                    MarkBufferDirty(*buf)
            }
```

# 2 记录

xlog记录类型：（仅针对用户表）

1.  1条tuple  
    heap_insert() : RM_HEAP_ID, XLOG_HEAP_INSERT | XLOG_HEAP_INIT_PAGE  
    heap_delete() : RM_HEAP_ID, XLOG_HEAP_DELETE  
    heap_update() : RM_HEAP_ID, XLOG_HEAP_LOCK  
    heap_lock_tuple() : RM_HEAP_ID, XLOG_HEAP_LOCK  
    heap_lock_updated_tuple_rec() : RM_HEAP2_ID, XLOG_HEAP2_LOCK_UPDATED  
    heap_finish_speculative() : RM_HEAP_ID, XLOG_HEAP_CONFIRM  
    heap_abort_speculative() : …  
    heap_inplace_update : RM_HEAP_ID, XLOG_HEAP_INPLACE

2.  多条tuple  
    heap_multi_insert() : RM_HEAP2_ID, XLOG_HEAP2_MULTI_INSERT | XLOG_HEAP_INIT_PAGE

3.  1页page

4.  数据写入时机：  
    单写：

    1.  INSERT  
        批量写：
    2.  ALTER … TABLESPACE
    3.  VACUUM FULL

log_newpage场景：

1.  vacuum full: 创建新文件，拷贝旧文
