+++
title = 'PostgreSQL 3-13 Publication'
date = '2025-08-28T16:18:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '逻辑复制']
weight = 313
ShowToc = true
TocOpen = true
+++
# 1 逻辑复制背景

## 1.1 逻辑复制场景

在使用数据库时，为提高整个系统的可靠性，或实现不同部门数据同步等场景，很多客户的部署模型存在：一主多备、异构数据库等特点，在保证性能的前提下，常见部署模型如下：

```bash

+-------------+    sql    +---------------------+    wal    +--------------------+
| application | --------> | postgresql (master) |  -------> | postgresql (slave) |
+-------------+           +---------------------+           +--------------------+
                                    |
                                    |
                                    |   decoded-wal         +--------------------+
                                    +---------------------> | mysql, oracle, ..  |
                                                            +--------------------+
```

## 1.2 逻辑复制功能

## 1.3 逻辑复制基础

首先，需自行了解一些存储的基本知识，包括事务特性、mvcc机制，表的物理存储格式：filenode、page、tuple等。  
此处，以一个例子，介绍什么wal日志的特点。需了解一些

1.  应用执行事务  
    假设同一时间，有2个事务，事务id分别为10和11。

    | 时间 | 应用1 | 应用2 |
    | --- | --- | --- |
    | 0 | CREATE TABLE t1 (c1 INT,c2 INT) | \- |
    | 1 | CREATE TABLE t2 (c1 INT,c2 INT) | \- |
    | 2 | BEGIN (xid=10) | \- |
    | 3 | INSERT INTO t1 VALUES(10, 1) | \- |
    | 4 | \- | BEGIN (xid=11) |
    | 5 | \- | INSERT INTO t1 VALUES (11, 1) |
    | 6 | INSERT INTO t2 VALUES (10, 2) | \- |
    | 7 | COMMIT |  |
    | 8 | \- | DELETE FROM t1 WHERE c1 = 10 |
    | 9 | \- | INSERT INTO t2 VALUES (11, 2) |
    | 10 | \- | COMMIT |

2.  内核产生wal日志  
    所有表的wal日志，按生成wal的顺序，组织在一起。上述示例中，产生的wal如下：（此处仅列举关键信息）

    | 顺序 | type | xid | filenode | offset | data |
    | --- | --- | --- | --- | --- | --- |
    | 1 | insert | 10 | (t1) | xx,xx | ‘10,1’ |
    | 2 | insert | 11 | (t1) | xx,xx | ‘11,1’ |
    | 3 | insert | 10 | (t2) | xx,xx | ‘10,2’ |
    | 4 | commit | 10 | \- | \- | \- |
    | 5 | delete | 11 | (t1) | xx,xx | \- |
    | 6 | insert | 11 | (t2) | xx,xx | ‘11,2’ |
    | 7 | commit | 11 | \- | \- | \- |

## 1.4 物理复制区别

### 一、物理复制

在复制模型中，分为主节点、备节点。

-   主节点
-   备节点：与主节点相比，数据库版本相同，表的数量相同，表的的物理信息相同，表中数据相同。回放wal日志时，可直接使用wal日志中的[filenode, offset]等信息。

用户执行SQL：`INSERT INTO t1 VALUES(1, 'data1')`时，wal的内容大概如下：

```bash
[0, [1700, 1800], [8, 3], [10, '1 data1']]
解释：
    - 0    : insert
    - 1700 : directory name (database oid)
    - 1800 : file name (filenode)
    - 8    : page index number
    - 3    : tuple index number
    - 10   : transcation id
```

### 二、逻辑复制

在复制模型中，分为发布端、订阅端。

-   发布端：
-   订阅端：
    -   异构订阅端：数据库类型不同
    -   同源订阅端：数据库类型相同，但是，以下内容可能存在差异：
        -   数据库版本
        -   表的数量
        -   表的物理信息
        -   表中数据

与物理复制相比，逻辑复制存在一些差异，包括：

1.  发布端：生成wal时，wal中信息更多一些
2.  发布端：读取wal时，解码wal，生成decoded-wal
3.  发布端：发送wal时，不按wal顺序发送decoded-wal，而是根据事务顺序，一次发送由同一事务生成的多条wal
4.  订阅端：回放wal时，根据decoded-wal，获取操作、数据等信息，调用heapam接口，例如heap_insert, heap_delete等，重放decoded-wal，生成新的wal

# 2 使用逻辑复制

## 2.1 发布端

1.  配置

    ```bash
    # pg14
    echo "wal_level=logical" >> $PG_HOME/data/postgresql.conf
    echo "max_replication_slots=4" >> $PG_HOME/data/postgresql.conf
    echo "max_wal_senders=4" >> $PG_HOME/data/postgresql.conf
    echo "max_worker_processes=8" >> $PG_HOME/data/postgresql.conf
    echo "max_logical_replication_workers=4" >> $PG_HOME/data/postgresql.conf

    echo "listen_addresses='*'" >> $PG_HOME/data/postgresql.conf

    sed -i '1i host all all 0.0.0.0/0 md5\n' $PG_HOME/data/pg_hba.conf
    # host all all 0.0.0.0/0 md5

    psql -d postgres -c "SELECT name,setting FROM pg_settings WHERE name in
        ('wal_level', 'max_replication_slots', 'max_wal_senders', 'max_worker_processes', 'max_logical_replication_workers')"
    ```

2.  创建基表

    ```sql
    CREATE DATABASE pubdb;
    \c pubdb
    CREATE TABLE pt1(c1 INT,c2 TEXT);
    CREATE TABLE pt2(c1 INT, c2 TEXT);
    INSERT INTO pt1 VALUES (1,'data1-1'), (2,'data1-2');
    INSERT INTO pt1 VALUES (1,'data2-1'), (2,'data2-2');
    ```

3.  创建发布信息

    ```sql
    CREATE PUBLICATION pub1 FOR TABLE pt1,pt2;
        -- SELECT * FROM pg_publication;
        -- SELECT * FROM pg_publication_rel;

    -- 设置发布状态
    SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
        -- SELECT * FROM pg_replication_slots;
        -- SELECT * FROM pg_stat_replication_slots;

    -- 检查数据
        -- SELECT * FROM pg_logical_slot_peek_changes('pslot1', NULL, NULL);
    -- 删除slot
        -- SELECT pg_drop_replication_slot('pslot1');
    ```

4.  创建发布用户

    ```sql
    -- 订阅端通过pu1用户来连接发布端，以接收数据
    CREATE USER pu1 REPLICATION PASSWORD 'pu1.12345';

    GRANT CONNECT ON DATABASE pubdb TO pu1;
    GRANT USAGE ON SCHEMA public TO pu1;
    GRANT ALL ON pt1,pt2 TO pu1;
    ```

5.  验证

    ```sql
    psql -h 172.16.100.134 -p 5432 -d pubdb -U pu1 -W pu1.12345
    ```

6.  其他参考语法

    ```sql
    ALTER SUBSCRIPTION sub1 DISABLE;
    ALTER SUBSCRIPTION sub1 ENABLE;
    ALTER PUBlication pub1 ADD TABLE new_tbl;
    ```

## 2.2 订阅端

1.  配置  
    作为客户端访问发布端，无需配置任何guc参数

    ```bash
    # 如果发布端、订阅端在同一机器，确保二者端口不同
    echo "port=5433" >> $PG_HOME/datas/postgresql.conf
    ```

2.  创建基表，与发布端表定义一致

    ```sql
    -- psql -p 5433 -d postgres
    CREATE DATABASE subdb;
    \c subdb
    CREATE TABLE pt1(c1 INT,c2 TEXT);
    CREATE TABLE pt2(c1 INT, c2 TEXT);
    ```

3.  创建订阅信息

    ```sql
    CREATE SUBSCRIPTION sub1
        CONNECTION 'host=127.0.0.1 port=5432 dbname=pubdb user=pu1 password=pu1.12345'
        PUBLICATION pub1
        WITH (create_slot = false, slot_name = 'pslot1', copy_data = true);
        -- SELECT * FROM pg_subscription;
        -- SELECT * FROM pg_subscription_rel;
        -- SELECT * FROM pg_stat_subscription;
    ```

4.  查看表数据

    ```sql
    SELECT * FROM pt1;
    -- 向发布端表写数据，订阅端也会收到数据
    ```

5.  其他操作

    ```sql
    -- 暂停接受数据
    ALTER SUBSCRIPTION sub1 DISABLE;
    ```

## 2.3 订阅端并行apply

```bash
# pg17
echo "max_parallel_apply_workers_per_subscription=4" >> $PG_HOME/data/postgresql.conf
```

```sql
ALTER SUBSCRIPTION sub1 SET (parallel_apply = true);
```

## 2.3 计算逻辑复制速度

1.  计算xlog生成速度

    ```sql
    -- 测试前，获取xlog写入位置
    DROP TABLE IF EXISTS tlsn;
    SELECT pg_current_wal_lsn() AS lsn1 INTO tlsn;

    -- 测试后，获取当前xlog写入位置，并计算xlog差值
    SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), (SELECT lsn1 FROM tlsn));

    -- 参考：转换为10进制
    -- SELECT ('x' || lpad(replace(pg_current_wal_lsn()::text, '/', ''), 16, '0'))::bit(64)::bigint AS decimal_lsn;
    ```

2.  插入数据  
    tpcc写入

    ```sql
    ALTER SYSTEM SET password_encryption='md5';
    SELECT pg_reload_conf();
    ```

# 3 逻辑复制原理

## 3.1 进程类型

以下是逻辑复制的进程模型与工作流程：

```bash
# pg-17
[发布端]                                                                                        [订阅端]

postmaster        postgres                     wal-writer    wal-sender              wal-file   postmaster             apply-launch                apply-worker
+-------------------+------------------------------+------------+---------------------------+---+---------------------------+---------------------------+----------------------+
| 1 receive connect |                              |            |                           |   |                           |                           |
| 2 fork postgres ->|                              |            |                           |   |                           |                           |
|                   | 3 receive sql                |            |                           |   |                           |                           |
|                   |   delete .. t1 .. c1=10      |            |                           |   |                           |                           |
|                   | 4 scan tuple from t1         |            |                           |   |                           |                           |
|                   | 5 get tuple pointer          |            |                           |   |                           |                           |
|                   | 6 mark tuple deleted         |            |                           |   |                           |                           |
|                   | 7 generate wal               |            |                           |   |                           |                           |
|                   |   type=delete,xid=11         |            |                           |   |                           |                           |
|                   |   filenode=1700,offset=8-3   |            |                           |   |                           |                           |
|                   |   data='10',column=1         |            |                           |   |                           |                           |
|                   | 8 copy wal to wal-buffer --->|            |                           |   |                           |                           |
|                                                  | 9 write wal--------------------------->|   |                           |                           |
|                                                               |                           |   | 10 startp                 |                           |
|                                                               |                           |   | 11 startup apply-launch ->|                           |
|                                                               |                           |   |                           | 12 read suscription       |
|                                                               |                           |   |                           | 13 calucate worker num    |
|                                                               |                           |   | <-------------------------| 14 register worker info   |
|                                                               |                           |   | 15 read bgworker info                                 |
|                                                               |                           |   | 16 startup apply-worker ----------------------------->|
| <-------------------------------------------------------------+---------------------------+-----------------------------------------------------------| 17 ask publliction
| 18 receive connect                                            |                           |                                                           |
| 19 fork postgres as wal-sender ------------------------------>|                           |                                                           |
                                                                | 20 read wal <-------------|                                                           |
                                                                | 21 decod to decode-wal                                                                |
                                                                | 22 send decoded-wal ----------------------------------------------------------------->|
                                                                                                                                                        | 23 receive decoded-wal
                                                                                                                                                        | 24 apply decoded-wal
                                                                                                                                                        | (if is postgresql)
                                                                                                                                                        | 25 scan tuple from t1
                                                                                                                                                        | 26 get tuple pointer
                                                                                                                                                        | 27 mark tuple deleted
                                                                                                                                                        | 28 generate wal
```

## 3.2 复制流程

```bash
application            postgres                 wal-file            wal-sender
+-----------------------+---------------------------+-----------------------+
1 begin (xid=10)  ----> |
2 insert t1 (10,1) ---> |
                        | 3 write wal
                        |   [10, insert '10,1'] --> |           |
                        |                           | <-        | 4 read wal
                                                    |           |   [10, insert '10,1']
                                                    |           | 5 decode wal
                                                                | 6 put to list (xid=10)
3 begin (xid=11) ------>| （待继续补充）
```

# 4 逻辑复制源码

## 4.2 关键设计

### 一、流复制

```python
# 发布端 @ pg-17
WalSndLoop
    for (;;) # 持续读取、解码、发送 xlog
        XLogSendLogical
            pq_sendbyte(&output_message, 'w');

            XLogReadRecord # 读取1条record，放入logical_decoding_ctx
                ReadPageInternal
                DecodeXLogRecord
            LogicalDecodingProcessRecord # 开始解码
                ReorderBufferAssignChild
                rmgr.rm_decode
                    # hook: RmgrTable [heap_decode, xact_decode]
                        heap_decode
                            ReorderBufferProcessXid
                                ReorderBufferTXNByXid # 为事务申请链表
                            if XLOG_HEAP_INSERT:
                                DecodeInsert
                                    ReorderBufferGetChange # 申请一个node
                                    DecodeXLogTuple
                                    ReorderBufferQueueChange # 将node放入list
                                        ReorderBufferTXNByXid
                                        dlist_push_tail
                                        ReorderBufferProcessPartialChange # 流复制
                                            ReorderBufferStreamTXN
                                                ReorderBufferProcessTXN # 发送数据
                                                    ReorderBufferIterTXNNext
                                                    stream_start
                                                        stream_start_cb_wrapper
                                                            stream_start_cb
                                                                pgoutput_stream_start
                                                                    logicalrep_write_stream_start
                                                                        'LOGICAL_REP_MSG_STREAM_START xid is_first_sedment'
                                                                    OutputPluginWrite
                                                                        write
                                                                            WalSndWriteData
                                                                                pq_flush_if_writable
                                                    ReorderBufferApplyChange
                                                        stream_change
                                                            stream_change_cb_wrapper
                                                                stream_change_cb
                                                                    pgoutput_change
                                                                        OutputPluginPrepareWrite # 数据头
                                                                            prepare_write
                                                                                WalSndPrepareWrite
                                                                                    pq_sendbyte(ctx->out, 'w')
                                                                        pgoutput_send_begin # 消息头 + 消息
                                                                            logicalrep_write_begin
                                                                                'LOGICAL_REP_MSG_BEGIN final_lsn commit_time xid'
                                                                        if REORDER_BUFFER_CHANGE_INSERT:
                                                                            logicalrep_write_insert
                                                                                'LOGICAL_REP_MSG_INSERT xid relid N nattr len value'
                                                                        if REORDER_BUFFER_CHANGE_DELETE
                                                                            logicalrep_write_delete
                                                                        OutputPluginWrite
                                                                            (WalSndWriteDataHelper)
                                                                            write
                                                    ReorderBufferIterTXNFinish
                                                    stream_stop
                                                        stream_stop_cb_wrapper
                                                            stream_stop_cb
                                                                pgoutput_stream_stop
                                                                    logicalrep_write_stream_stop
                                                                        'LOGICAL_REP_MSG_STREAM_STOP'
                                                                    OutputPluginWrite
                                                                        write
                                                    ReorderBufferSaveTXNSnapshot
                                                UpdateDecodingStats
                                        ReorderBufferCheckMemoryLimit
                            elif XLOG_HEAP_DELETE:
                                DecodeDelete
                                    ReorderBufferGetChange
                                    DecodeXLogTuple
                                    ReorderBufferQueueChange
                        xact_decode
                            if XLOG_XACT_COMMIT:
                                DecodeCommit
                                    SnapBuildCommitTxn
                                    ReorderBufferCommit
                                        ReorderBufferTXNByXid
                                        ReorderBufferReplay
                                            ReorderBufferStreamCommit
                                                ReorderBufferStreamTXN
                                                    stream_commit
                                                        pgoutput_stream_commit
                                                            logicalrep_write_stream_commit
                                                            OutputPluginWrite
                                    UpdateDecodingStats

# 订阅端 @ pg-17
ApplyWorkerMain
    SetupApplyOrSyncWorker
        GetSubscription
    run_apply_worker
        walrcv_connect
        walrcv_identify_system
        walrcv_startstreaming
        start_apply
            LogicalRepApplyLoop
                for (;;)
                    walrcv_receive
                        for (;;)
                            if 'w'
                                apply_dispatch
                                    if LOGICAL_REP_MSG_STREAM_START: 'S'
                                        apply_handle_stream_start
                                            logicalrep_read_stream_start
                                            pa_allocate_worker
                                            get_transaction_apply_action
                                            if TRANS_LEADER_SEND_TO_PARALLEL:
                                                pa_send_data
                                    elif LOGICAL_REP_MSG_INSERT: 'I'
                                        apply_handle_insert
                                            handle_streamed_transaction
                                                get_transaction_apply_action
                                                    pa_find_worker
                                                if TRANS_LEADER_SEND_TO_PARALLEL:
                                                    pa_send_data
                                                        shm_mq_send
                                    elif LOGICAL_REP_MSG_STREAM_STOP: 'E'
                                        apply_handle_stream_stop
                                            get_transaction_apply_action
                                                pa_find_worker
                                    elif LOGICAL_REP_MSG_COMMIT: 'C'
                                        apply_handle_commit
                            walrcv_receive
                walrcv_endstreaming

# 订阅端 parallel-worker
pa_allocate_worker
    pa_launch_parallel_worker

ParallelApplyWorkerMain
    logicalrep_worker_attach
    LogicalParallelApplyLoop
        for (;;)
            shm_mq_receive
                apply_dispatch
                    if LOGICAL_REP_MSG_INSERT:
                        begin_replication_step
                        logicalrep_read_insert
                        logicalrep_rel_open
                        apply_handle_insert_internal
```

## 4.1 完整流程

```python
# 前置
ReplicationSlotCreate

# Postmaster进程
StartupXLOG
    StartupReplicationSlots
        RestoreSlotFromDisk # 读取slot文件
            OpenTransientFile
            memcpy(ReplicationSlotCtl)

# postgres进程  INSERT
heap_insert
    XLogInsert
        XLogRecordAssemble
        XLogInsertRecord
            CopyXLogRecordTowal

# 订阅端 apply-worker
@pg.14
# postmaster进程
PostmasterMain
    checkDatadir
    checkControlFile
    ApplyLauncherRegister
        RegisterBackgroundWorker('ApplyLauncherMain')
            slist_push_head # 加入全局list BackgroundWorkerList
    reset_shared
    SysLogger_Start
    maybe_start_bgworkers
        do_start_bgworker
            # 暂时不启动
    ServerLoop
        for ;;
            ConnCreate
            BackendStartup
                BackendRun
                    PostgresMain
            maybe_start_bgworkers
                do_start_bgworker
                    InitPostmasterChild
                        fork # fork 新进程
                            StartBackgroundWorker
                                LookupBackgroundWorkerFunction
                                    # 获取回调函数 ApplyLauncherMain
                                entrypt -> ApplyLauncherMain # 新进程主函数：ApplyLauncherMain

# apply-launch进程
ApplyLauncherMain
    for (;;)
        get_subscription_list # 从系统表中，获取所有subscription
            table_beginscan_catalog('pg_subscription')
            heap_getnext
        foreach
            logicalrep_worker_find
            logicalrep_worker_launch
                RegisterDynamicBackgroundWorker('ApplyWorkerMain')
                    # 加入全局BackgroundWorkerData，postmaster进程在ServerLoop中检查该结构体
                WaitForReplicationWorkerAttach
                    # 等待postmaster进程fork apply-worker进程
                    # fork成功，自动调用 entrypt -> ApplyWorkerMain

# 订阅端 CREATE SUBSCRIPTION
CreateSubscription
    CatalogTupleInsert('pg_subscription')
    replorigin_create
        CatalogTupleInsert('pg_replication_origin')
    check_publications # 与发布端通信，检查publication状态
    check_publications_origin
    fetch_table_list   # 读取发布端表基本信息
    AddSubscriptionRelState
        CatalogTupleInsert('pg_subscription') # 系统表srsubstate= (copy_data ? 'i' : 'r')
    ApplyLauncherWakeupAtCommit # 启动apply-worker

process_syncing_tables
    process_syncing_tables_for_apply
        process_syncing_tables_for_apply
            wait_for_relation_state_change
                GetSubscriptionRelState # 获取系统表 srsubstate
                logicalrep_worker_find # 查找与等待 sync 进程

apply-launch 只启动apply-worker类型进程

# apply-worker进程
ApplyWorkerMain
    GetSubscription
        SearchSysCache1('pg_subscription')
    if am_tablesync_worker
        LogicalRepSyncTableStart # 追赶？
            GetSubscriptionRelState
                SearchSysCache1('pg_subscription' and 'pg_subscription_rel')
    LogicalRepApplyLoop
        for (;;)
            walrcv_receive # 接收发布端数据
                for (;;)
                    pq_getmsgbyte
                    if 'w':
                       apply_dispatch # 回放数据
                            pq_getmsgbyte
                            if LOGICAL_REP_MSG_BEGIN:
                                apply_handle_begin
                            if LOGICAL_REP_MSG_COMMIT:
                                apply_handle_commit
                            if LOGICAL_REP_MSG_INSERT:
                                apply_handle_insert
                                    logicalrep_read_insert
                                    logicalrep_rel_open
                                    create_edata_for_relation
                                    slot_store_data
                                    apply_handle_insert_internal
                                        ExecOpenIndices
                                        ExecSimpleRelationInsert
                                            simple_table_tuple_insert
                                                table_tuple_insert
                                                    hook: tuple_insert
                                                        heapam_tuple_insert
                                                            heap_insert
                                                                heap_prepare_insert
                                                                RelationGetBufferForTuple
                                                                RelationPutHeapTuple
                                                                XLogInsert
                                            ExecInsertIndexTuples
                                        ExecCloseIndices
                    elif 'k':
                        send_feedback
                    walrcv_receive
                send_feedback
                maybe_reread_subscription
        walrcv_endstreaming

# 并行apply
apply_dispatch(LOGICAL_REP_MSG_STREAM_START)
    apply_handle_stream_start
        pa_allocate_worker
            pa_launch_parallel_worker
                logicalrep_worker_launch
                    if TRANS_LEADER_SEND_TO_PARALLEL
                        pa_send_data
                            shm_mq_send

# 发布端（由订阅端触发）
@pg.14
PostmasterMain
    ServerLoop
        BackendStartup
            BackendInitialize # 处理连接参数
                ProcessStartupPacket
                    if conn is 'replication':
                        am_walsender = true
            BackendRun        # 处理SQL语句
                PostgresMain
                    for (;;)
                        ReadCommand
                        if am_walsender:
                            if exec_replication_command
                                StartLogicalReplication
                                    CreateDecodingContext # 创建全局变量 logical_decoding_ctx，包括reader和re-order
                                        StartupDecodingContext
                                            hook: reorder.begin = begin_cb_wrapper
                                            hook: reorder.apply_change = change_cb_wrapper
                                            hook: write = WalSndWriteData
                                    WalSndLoop
                                        for (;;) # 持续读取、解码、发送 xlog
                                            XLogSendLogical
                                                XLogReadRecord # 读取1条record，放入logical_decoding_ctx
                                                    ReadPageInternal
                                                    DecodeXLogRecord
                                                LogicalDecodingProcessRecord # 开始解码
                                                    DecodeHeapOp
                                                        DecodeInsert
                                                            XLogRecGetBlockData
                                                            DecodeXLogTuple
                                                            ReorderBufferQueueChange
                                                                ReorderBufferTXNByXid # 根据xid，获取buffer
                                                                dlist_push_tail
                                                    DecodeXactOp
                                                        DecodeCommit
                                                            ReorderBufferCommit
                                                                ReorderBufferTXNByXid
                                                                ReorderBufferReplay
                                                                    ReorderBufferProcessTXN
                                                                        while ReorderBufferIterTXNNext # 处理 INSERT
                                                                            ReorderBufferApplyChange
                                                                                hook: apply_change
                                                                                    change_cb_wrapper
                                                                                        hook: change_cb
                                                                                            pgoutput_change # 暂存，不发送
                                                                                                logicalrep_write_insert
                                                                                                    logicalrep_write_tuple
                                                                                                OutputPluginWrite
                                                                                                    hook: write
                                                                                                        WalSndWriteData
                                                                                                            pq_flush_if_writable
                                                                                                                socket_flush_if_writable
                                                                                                                    ..
                                                                                                                        send # 系统调用 send
                                                                        hook: commit        # 处理 COMMIT
                                                                            commit_cb_wrapper
                                                                                hook: commit_cb
                                                                                    pgoutput_commit_txn # 一起发送
                                                                                        logicalrep_write_commit
                                                                                        OutputPluginWrite
                                                                                            ..
                                                                                                send
            else:
                exec_simple_query
        else:
            exec_simple_query

# 发布端：流式复制
ReorderBufferReplay
    ReorderBufferStreamCommit
        ReorderBufferStreamTXN
            ReorderBufferProcessTXN
                stream_start_cb_wrapper
                    hook: stream_start_cb
                        _PG_output_plugin_init
                            pgoutput_stream_start
                                logicalrep_write_stream_start
                                    pq_sendbyte(LOGICAL_REP_MSG_STREAM_START)
```

## 4.3 并行解码

```python
# @reader
# read wal
LogicalReadRecordMain
    while (true)
        XLogReadRecord # read record
        ParseProcessRecord # parse record
            ParseXactOp # parse xact
                if 'XLOG_XACT_COMMIT':
                    ParseCommitXlog
                        ParallelReorderBufferGetChange # alloc a change-item
                        PutChangeQueue # send change-item
            ParseHeapOp # parse heap
                if 'XLOG_HEAP_INSERT':
                    ParseInsertXlog
                        ParallelReorderBufferGetChange # alloc a change-item
                        DecodeXLogTuple # fill change-item (wal -> change-itme)
                        PutChangeQueue  # send change-item
                            LogicalQueuePut(decoder[x]->changeQueue)
                elif 'XLOG_HEAP_DELETE':
                    ParseDeleteXlog

# @decoder
# decode change
ParallelDecodeWorkerMain
    while (true)
        LogicalQueueTop # recv change-item
        ParallelDecodeChange # decode change-item
            if 'PARALLEL_REORDER_BUFFER_CHANGE_COMMIT':
                ParallelDecodeCommitOrAbort
                    GetLogicalLog
            if 'PARALLEL_REORDER_BUFFER_CHANGE_INSERT':
                getIUDLogicalLog # make log (change-item -> log)
        LogicalQueuePut(decoder->LogicalLogQueue) # put log to log-queue
        LogicalQueuePop # pop change-item, it's finished

# @sender
# send log
WalSndLoop
    for (;;)
        XLogSendParallelLogical
            for (;; decoder.id++) # get decoder one by one
                LogicalQueueTop   # recv log from current decoder
                LogicalLogHandle #
                    if 'LOGICAL_LOG_DML':
                        ParallelReorderBufferQueueChange
                            ParallelReorderBufferTXNByXid # find txn-list from txn-pool
                            dlist_push_tail # push log to txn-list
                            ParallelReorderBufferUpdateMemory # check memory
                    elif 'LOGICAL_LOG_COMMIT':
                        LogicalLogHandleAbortOrCommit
                            ParallelReorderBufferTXNByXid # find txn-list from txn-pool
                            ParallelReorderBufferCommit # send all log in txn-list
                                ParallelOutputBegin
                                ParallelHandleBatch
                                while (ParallelReorderBufferIterTXNNext) # get log one by one
                                    ParallelOutputBegin
                                    ParallelHandleBatch
                                ParallelOutputCommit
                                ParallelReorderBufferCleanupTXN # clean txn-list
                LogicalQueuePop # remove log
```

# 参考资料

-   逻辑复制架构：[https://www.cnblogs.com/wy123/p/18946661](https://www.cnblogs.com/wy123/p/18946661)
-   GaussDB并行逻辑解码：[https://developer.huawei.com/consumer/cn/forum/topic/0201165508224221138](https://developer.huawei.com/consumer/cn/forum/topic/0201165508224221138)
-   pg16并行回放：[https://www.webkt.com/article/7715](https://www.webkt.com/article/7715)
-   openGauss并行解码测试：[https://www.cnblogs.com/jerrywang1983/articles/18375212](https://www.cnblogs.com/jerrywang1983/articles/18375212)
