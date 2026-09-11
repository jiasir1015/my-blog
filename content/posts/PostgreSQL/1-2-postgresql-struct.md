+++
title = 'PostgreSQL 1-2 进程架构'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL']
weight = 102
ShowToc = true
TocOpen = true
+++
1.  [1 进程架构](#1-%E8%BF%9B%E7%A8%8B%E6%9E%B6%E6%9E%84)
    1.  [1.1 进程架构](#1-1-%E8%BF%9B%E7%A8%8B%E6%9E%B6%E6%9E%84)
    2.  [1.2 进程启动](#1-2-%E8%BF%9B%E7%A8%8B%E5%90%AF%E5%8A%A8)
    3.  [1.3 进程通信](#1-3-%E8%BF%9B%E7%A8%8B%E9%80%9A%E4%BF%A1)
2.  [2 进程功能](#2-%E8%BF%9B%E7%A8%8B%E5%8A%9F%E8%83%BD)
    1.  [2.1 postgres线程](#2-1-postgres%E7%BA%BF%E7%A8%8B)
        1.  [1.2.1 postmaster进程](#1-2-1-postmaster%E8%BF%9B%E7%A8%8B)
        2.  [1.2.2 postgres进程](#1-2-2-postgres%E8%BF%9B%E7%A8%8B)
        3.  [1.2.3 wal writer进程](#1-2-3-wal-writer%E8%BF%9B%E7%A8%8B)
        4.  [1.2.4 background writer进程](#1-2-4-background-writer%E8%BF%9B%E7%A8%8B)
        5.  [1.2.5 checkpointer进程](#1-2-5-checkpointer%E8%BF%9B%E7%A8%8B)
        6.  [1.2.6 autovacuum进程](#1-2-6-autovacuum%E8%BF%9B%E7%A8%8B)
        7.  [1.2.7 statistics collector进程](#1-2-7-statistics-collector%E8%BF%9B%E7%A8%8B)
        8.  [1.2.8 archiver进程](#1-2-8-archiver%E8%BF%9B%E7%A8%8B)
        9.  [1.2.9 logging collertor进程](#1-2-9-logging-collertor%E8%BF%9B%E7%A8%8B)
    2.  [1.3 进程通信](#1-3-%E8%BF%9B%E7%A8%8B%E9%80%9A%E4%BF%A1-1)
3.  [3 进程控制](#3-%E8%BF%9B%E7%A8%8B%E6%8E%A7%E5%88%B6)

# 1 进程架构

## 1.1 进程架构

postgresql 采用1+n+7的进程架构，包括：

-   1个postmaster进程
-   n个postgres进程
-   7个辅助进程：包括：
    1.  bg writer进程：
    2.  checkpointer进程：
    3.  walwriter进程：
    4.  autovacuum进程：
    5.  archiver进程：
    6.  statistics collector进程：
    7.  log collectoer进程：

进程架构图如下图所示：

![pg-all-process](/images/PostgreSQL/1-2-postgresql-struct/pg-all-process.png)

## 1.2 进程启动

先启动postmaster进程，再由poastermaster启动n+7进程。  
在postmaster主函数中，进程启动顺序如下：

```python
main() # [主进程] 启动postmaster进程
    PostmasterMain()
        pqsignal(SIGUSR1, sigusr1_handler); # 注册信号
        SysLogger_Start()   # [进程7] 启动log collector进程
        StartupDataBase() -> StartupProcessMain() # 进行故障恢复

        ServerLoop()
            BackendStartup()
            SysLogger_Start() # [进程n] 启动posters进程
            StartCheckpointer() -> CheckpointerMain() # [进程2] 启动heckpointer进程
            StartBackgroundWriter() -> BackgroundWriterMain() # [进程1] 启动bg writer进程
            StartWalWriter() -> InitXLOGAccess() WalWriterMain() # [进程3] 启动walwriter进程
            StartAutoVacLauncher() # [进程4] 启动autovacuum进程
            pgstat_start() # [进程6] 启动 statistics collector进程
            pgarch_start() # [进程5] 启动归档进程
            maybe_start_bgworker()
```

## 1.3 进程通信

# 2 进程功能

本章介绍各进程的主要功能。

## 2.1 postgres线程

### 1.2.1 postmaster进程

```c
// 部分辅助进程启动方法
#define StartupDataBase()		StartChildProcess(StartupProcess)
#define StartBackgroundWriter() StartChildProcess(BgWriterProcess)
#define StartCheckpointer()		StartChildProcess(CheckpointerProcess)
#define StartWalWriter()		StartChildProcess(WalWriterProcess)
#define StartWalReceiver()		StartChildProcess(WalReceiverProcess)

StartChildProcess()
    AuxiliaryProcessMain()
        WalWriterMain()
        ...

// 总入口
main() // [进程1]
    PostmasterMain() // 主要功能：进入loop，启动辅助线程，监听应用连接
        pqsignal(SIGUSR1, sigusr1_handler); // 注册wal接受进程信号量
        SysLogger_Start()
        StartupDataBase() -> StartupProcessMain() // 启动进程：故障恢复
        ServerLoop()
            BackendStartup()
            SysLogger_Start()
            StartCheckpointer() -> CheckpointerMain() // [进程5] 检查点进程
            StartBackgroundWriter() -> BackgroundWriterMain() // [进程4] 数据写进程
            StartWalWriter() -> InitXLOGAccess() WalWriterMain() // [进程3] wal写进程
            StartAutoVacLauncher() // [进程6] 清理进程
            pgstat_start() // [进程7]  统计信息进程
            pgarch_start() // [进程8] 归档进程
            maybe_start_bgworker()

// 其中，
sigusr1_handler(PMSIGNAL_START_WALRECEIVER)
    StartWalReceiver()
WaitForWALToBecomeAvailable()
    RequestXLogStreaming()
        SendPostmasterSignal(PMSIGNAL_START_WALRECEIVER)
```

1.  从control中，找到checkpoint位置，开始重放xlog

    ```c
    StartupProcessMain()
        StartupXLOG()
            ReadControlFile()
                read(ControlFile)
            readRecoveryCommandFile() // 读取恢复控制文件recovery.conf
            if {

            } else {// 根据control中的checkpoint开始恢复
                ReadCheckpointRecord(ControlFile->checkPoint)
                RelationCacheInitFileRemove()
                    unlink_initfile("pg_internal.init")

                MultiXactSetNextMXact()
                SetTransactionIdLimit()
                SetMultiXactIdLimit()
                SetCommitTsLimit()

                StartupReplicationSlots()
                StartupReorderBuffer()
                StartupMultiXact()
                StartupCommitTs()
                StartupReplicationOrigin()

                InRecovery = true
            }

            UpdateControlFile()
            pgstat_reset_all()
            CheckRequiredParameterValues()
            ResetUnloggedRelations()
            DeleteAllExportedSnapshotFiles()

            ProcArrayInitRecovery()
            StartupCLOG()
            StartupSUBTRANS()

            for (rmid <= RM_MAX_ID): // 启动资源管理器
                RmgrTable[rmid].rm_startup()

            PublishStartupProcessInformation()
            SendPostmasterSignal(PMSIGNAL_RECOVERY_STARTED)

            CheckRecoveryConsistency()
            record = ReadRecord(checkPoint.redo) // 从检查点找到第一条xlog记录
            do {
                /* 资源管理器redo xlog记录 */
                RmgrTable[record->xl_rmid].rm_redo(xlogreader)
                record = ReadRecord(InvalidXLogRecPtr)
            } while (record != NULL)

            for ():
                RmgrTable[rmid].rm_cleanup();

            ShutdownWalRcv()

            ...

            TrimCLOG()
            TrimMultiXact()
            LocalSetXLogInsertAllowed()
            XLogReportParameters()
            CompleteCommitTsInitialization()
            WalSndWakeup()
    ```

```c
typedef struct {
    ...
    DBState state;
    pg_time_t time; // 上次更新control文件的时间
    XLogRecPtr checkPoint; // 上次更新时的checkpoint点
    XLogRecPtr prevCheckPoint;

	XLogRecPtr	minRecoveryPoint;
	TimeLineID	minRecoveryPointTLI;
	XLogRecPtr	backupStartPoint;
	XLogRecPtr	backupEndPoint;
    ...
} ControlFileData;
```

```c
// 全部资源管理器
RmgrData RmgrTable[#include "access/rmgrlist.h"] // 9.5共20种

// 资源管理器功能
typedef RmgrData {
	const char *rm_name;
	void (*rm_redo) (XLogReaderState *record);
	void (*rm_desc) (StringInfo buf, XLogReaderState *record);
	const char *(*rm_identify) (uint8 info);
	void (*rm_startup) (void);
	void (*rm_cleanup) (void);
} RmgrData;

// 资源管理器类型
RM_XLOG_ID xlog_redo
RM_XACT_ID xact_redo
RM_SMGR_ID smgr_redo // CREATE/TRUNCATE TABLE
RM_CLOG_ID clog_redo

RM_DBASE_ID dbase_redo
RM_TBLSPC_ID tblspc_redo
RM_MULTIXACT_ID multixact_redo

RM_HEAP2_ID heap2_redo // REWRITE/VACUUM/FREEZE_PAGE/VISIBLE/MULTI_INSERT/LOCK_UPDATE/NEW_CID
RM_HEAP_ID heap_redo // INSERT/DELETE/UPDATE/TRUNCATE/HOT_UPDATE/CONFIRM/LOCK/INPLACE/INIT_PAGE

RM_BTREE_ID btree_redo
RM_HASH_ID hash_redo
RM_GIN_ID gin_redo
RM_GIST_ID gist_redo
RM_SEQ_ID seq_redo
...

// xlog插入方法
XLogBeginInsert() /* 检查受否在故障恢复 */
XLogRegisterData(data, datasz) /*  */
XLogRecPtr XLogInsert(RmgrId rmid, uint8 info)
XLogFlush(XLogRecPtr record)

// xlog插入时机 XLogInsert(RM_HEAP_ID
|- heap_insert()
|- heap_delete()
|- heap_update()
|- heap_lock_tuple()
|- heap_finish_speculative()
|- heap_abort_speculative()
|- heap_inplace_update()
|- log_heap_update()
    XLogInsert(RM_HEAP_ID)
...

// xlog重放时机
PostmasterMain()
    StartupProcessMain()
        StartupXLOG()

// xlog重放操作
heap_redo()
    switch(info):
        XLOG_HEAP_INSERT:
            heap_xlog_insert()
                if XLOG_HEAP_INIT_PAGE:
                    XLogInitBufferForRedo()
                    PageInit()
                else:
                    XLogReadBufferForRedo()
                        XLogReadBufferForRedoExtended() // 从磁盘读page
                            XLogReadBufferExtended()
                        MarkBufferDirty()
        XLOG_HEAP_DELETE()
            heap_xlog_delete()
        ...
```

### 1.2.2 postgres进程

进程启动：

```c
ServerLoop()
    BackendStartup()
        BackendRun()
            PostgresMain()
                InitPostgres()
                exec_simple_query()

exec_simple_query()
    PortalRun()
        PortalRunMulti()
            ProcessQuery()
                ExecutorRun()
                    standard_ExecutorRun()
                        ExecutePlan()
                            ExecProcNode()
                                ExecModifyTable() /* INSERT/UPDATE/DELETE */
                                    ExecInsert()
                                        heap_insert()
```

### 1.2.3 wal writer进程

```c
main()
    PostmasterMain()
        ServerLoop()
            StartWalWriter() // 主要功能：进入loop，睡眠，满足时被唤醒，将wal写入磁盘
                InitXLOGAccess()
                    GetRedoRecPtr()
                        RedoRecPtr = XLogCtl->RedoRecPtr
                    InitXLogInsert() // 初始化内存
                WalWriterMain()
                    for (;;)
                        XLogBackgroundFlush()
                            LWLockAcquire(WALWriteLock)
                            XLogWrite()
                                curridx = XLogRecPtrToBufIdx(LogwrtResult.Write) // 找到上一次xlog点
                                while (LogwrtResult.Write < WriteRqst.Write) // 计算长度，计算完成后才开始写入
                                    XLogRecPtr EndPtr = XLogCtl->xlblocks[curridx];
                                    LogwrtResult.Write = EndPtr; // 实时更新落盘位置
                                    startidx = curridx;
                                    npage++;
                                    from = XLogCtl->pages + startidx * (Size) XLOG_BLCKSZ; // 计算落盘长度，BLKCZ可配置，1k到6m
                                    if WriteRqst.Write <= LogwrtResult.Write:
                                        write(from, npages * (Size) XLOG_BLCKSZ)
                                        WalSndWakeupRequest()
                                        XLogArchiveNotifySeg()
                                        if (XLogCheckpointNeeded):
                                            RequestCheckpoint(CHECKPOINT_CAUSE_XLOG)
                                curridx = NextBufIdx(curridx)
                            WalSndWakeupProcessRequests()
                                WalSndWakeup()
                            AdvanceXLInsertBuffer() // 扩张wal
                        WaitLatch(WalWriterDelay)
                            WaitLatchOrSocket()
                                select() /* sleep */
```

### 1.2.4 background writer进程

```c
main()
    PostmasterMain()
        ServerLoop()
            StartBackgroundWriter() -> BackgroundWriterMain()
                for (;;) {
                    ResetLatch()

                    BgBufferSync()
                        StrategySyncStart()
                        while () {
                            SyncOneBuffer()
                        }
                    pgstat_send_bgwriter()

                    WaitLatch()
                }
```

bgwritere与checkpoint的区别：  
目的不同，执行频率不同

1.  checkpoint定期执行，除共享缓冲区中的数据页外，还会落盘事务日志等信息，并向xlog日志checkpoint检查点
2.  bgwriter定期执行，刷写部分脏页，同时执行缓存替换算法，保证缓冲区管理器页面充足，降低postgres进程等待缓冲区空闲的概率

bgwriter设置参数：

-   bgwriter_delay：定期执行刷盘操作
-   bgwriter_lru_multiplier (M)：两次bgwriter刷盘之间申请的page页数为N，系统最多写出M x N个脏页
-   bgwriter_lru_maxpages：写出脏页最大数

postgres会做时钟扫描算法，bgwriter要跟上时钟扫描算法

启动流程：

```c
ServerLoop()
    StartBackgroundWriter()
        StartChildProcess()
            AuxiliaryProcessMain()
                BackgroundWriterMain()
```

整体步骤：

1.  初始化内存上下文

```c
+------+
| 1    |
| 2    | <- 上次bgwriter位置
| 3    |
| 4    | <- 时钟扫描位置
| 5    |
| 6    | <- 申请的buffer
| ...  |
| 1024 |
+------+
```

```c
BackgroundWriterMain()
    /* 内存上下文 */
    AllocSetContextCreate(TopMemoryContext)

    /* 循环 */
    for (;;) {
        ResetLatch()

       /* 1. 遍历所有脏页，写入磁盘，记录统计信息 */
        BgBufferSync()
            /* 找到时钟扫描受害者位置，计算上次时钟扫描到目前申请的buffer */
            StrategySyncStart()

            while (num_to_scan > 0 && reusable_buffers < upcoming_alloc_est)
                SyncOneBuffer()
                    FlushBuffer(bufHdr, NULL);

        /* 2. 将统计信息发送给pgstat进程 */
        pgstat_send_bgwriter()

        WaitLatch()
            WaitLatchOrSocket()
               select()
   }
```

### 1.2.5 checkpointer进程

```c
// checkpoint时机
#define CHECKPOINT_IS_SHUTDOWN	0x0001	/* Checkpoint is for shutdown */
#define CHECKPOINT_END_OF_RECOVERY	0x0002 /* end of wal end recovery */
#define CHECKPOINT_IMMEDIATE	0x0004	/* Do it without delays */
#define CHECKPOINT_FORCE		0x0008	/* Force even if no activity */
#define CHECKPOINT_FLUSH_ALL	0x0010	/* Flush all pages, including those belonging to unlogged tables */
/* These are important to RequestCheckpoint */
#define CHECKPOINT_WAIT			0x0020	/* Wait for completion */
/* These indicate the cause of a checkpoint request */
#define CHECKPOINT_CAUSE_XLOG	0x0040	/* XLOG consumption */
#define CHECKPOINT_CAUSE_TIME	0x0080	/* Elapsed time */
```

```c
// checkpoint时机
#define CHECKPOINT_IS_SHUTDOWN	0x0001	/* Checkpoint is for shutdown */
#define CHECKPOINT_END_OF_RECOVERY	0x0002 /* end of wal end recovery */
#define CHECKPOINT_IMMEDIATE	0x0004	/* Do it without delays */
#define CHECKPOINT_FORCE		0x0008	/* Force even if no activity */
#define CHECKPOINT_FLUSH_ALL	0x0010	/* Flush all pages, including those belonging to unlogged tables */
/* These are important to RequestCheckpoint */
#define CHECKPOINT_WAIT			0x0020	/* Wait for completion */
/* These indicate the cause of a checkpoint request */
#define CHECKPOINT_CAUSE_XLOG	0x0040	/* XLOG consumption */
#define CHECKPOINT_CAUSE_TIME	0x0080	/* Elapsed time */

// checkpont实现
CheckpointerMain()
    for (;;) {
        ResetLatch()
        GetInsertRecPtr()
        CreateCheckPoint()
            InitXLogInsert()
            smgrpreckpt()
            GetOldestActiveTransactionId()
            WALInsertLockAcquireExclusive()
            WALInsertLockRelease()
            MultiXactGetCheckptMulti()

            // 先落盘
            CheckPointGuts()
                CheckPointCLOG()
                CheckPointCommitTs()
                CheckPointSUBTRANS()
                CheckPointMultiXact()
                CheckPointPredicate()
                CheckPointRelationMap()
                CheckPointReplicationSlots()
                CheckPointSnapBuild()
                CheckPointLogicalRewriteHeap()
                CheckPointBuffers()
                    BufferSync()
                        while() {
                            SyncOneBuffer()
                                FlushBuffer()
                                    XLogFlush()
                                    smgrwrite()
                        }
                    smgrsync()
                CheckPointReplicationOrigin()
                CheckPointTwoPhase()

            // 再写xlog记录
            XLogBeginInsert()
            XLogRegisterData()
            XLogInsert(RM_XLOG_ID)
            XLogFlush()
            // 最后更新控制文件
            UpdateControlFile()
            smgrpostckpt()

        smgrcloseall()

        CheckArchiveTimeout()
        pgstat_send_bgwriter()
        WaitLatch()
    }

// BufferSync
```

```c
main()
    PostmasterMain()
        ServerLoop()
            StartCheckpointer() -> CheckpointerMain() // 主要功能：进入loop，睡眠，满足条件时被唤醒，将各资源管理器中的内容写入磁盘
                for (;;) {
                    ResetLatch()
                    GetInsertRecPtr()
                    CreateCheckPoint()
                        InitXLogInsert()
                        smgrpreckpt()
                        GetOldestActiveTransactionId()
                        WALInsertLockAcquireExclusive()
                        WALInsertLockRelease()
                        MultiXactGetCheckptMulti()

                        // 先落盘
                        CheckPointGuts()
                            CheckPointCLOG()
                            CheckPointCommitTs()
                            CheckPointSUBTRANS()
                            CheckPointMultiXact()
                            CheckPointPredicate()
                            CheckPointRelationMap()
                            CheckPointReplicationSlots()
                            CheckPointSnapBuild()
                            CheckPointLogicalRewriteHeap()
                            CheckPointBuffers()
                                BufferSync()
                                    while() {
                                        SyncOneBuffer()
                                            FlushBuffer()
                                                XLogFlush()
                                                smgrwrite()
                                    }
                                smgrsync()
                            CheckPointReplicationOrigin()
                            CheckPointTwoPhase()

                        // 再写xlog记录
                        XLogBeginInsert()
                        XLogRegisterData()
                        XLogInsert(RM_XLOG_ID)
                        XLogFlush()
                        // 最后更新控制文件
                        UpdateControlFile()
                        smgrpostckpt()

                    smgrcloseall()

                    CheckArchiveTimeout()
                    pgstat_send_bgwriter()
                    WaitLatch()
                }
```

### 1.2.6 autovacuum进程

### 1.2.7 statistics collector进程

### 1.2.8 archiver进程

### 1.2.9 logging collertor进程

## 1.3 进程通信

```c
typedef struct {
    sig_atomic_t is_set;
    bool is_shared;
    int owner_pid;
} Latch;

WaitLatch(Latch *latch, int wakeEvents, long timeout)
    WaitLatchOrSocket(Latch *latch, int wakeEvents, pgsocket sock, long timeout)
https://cloud.tencent.com/developer/article/2000758
```

# 3 进程控制

pg-internal.vonng.com
