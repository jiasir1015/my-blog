+++
title = '海量 5 设计 G100审计'
date = '2025-09-01T18:00:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['审计', '设计文档']
weight = 500
ShowToc = true
TocOpen = true
+++
# G100审计功能重构

# 1 功能简述

在需求文档中，已详细介绍需求背景，此处不在重复介绍。  
G100 309之前版本，审计特性存在较多问题，因此，在本版本，将重新设计与实现审计特性，解决功能、性能、易用性、可维护性、可扩展性等问题，使审计特性达到大规模商用的标准。

# 2 实现方案

## 一、审计架构

审计特性，核心子功能如下：

1.  配置审计：通过GUC参数，配置审计参数：日志目录、目录大小、日志文件淘汰策略等
2.  设置范围：通过SQL语法，设置审计策略，控制哪些事件需审计。在策略中，可按用户、操作、对象、操作结果等过滤事件
3.  收集事件：在代码关键节点，收集事件
4.  过滤事件：根据审计策略，过滤无需审计的事件
5.  生成日志：提取事件关键信息，生成日志
6.  传输日志：工作线程，通过共享内存，传输日志给审计线程
7.  存储日志：审计线程，组织日志，并将其存储至文件中。文件存放在单独的日志目录
8.  查询日志：通过内置FUNCTION，在线查询日志，通过TOOL，离线查询日志

> **其中，设置范围、过滤事件子功能相对独立，可单独设计与实现，所以，拆分到另一个的设计文档中。**

审计特性整体架构图如下：

![1-st](/images/ProjectDocs/5-design-g100-audit-refactor/1-st.png)

## 二、工作流程

收集事件的主体、操作、客体等信息时，因为需收集操作结果，即操作成功或失败，所以，很多场景中，收集事件需分为2个阶段：

-   执行操作前：收集事件基本信息，包括操作类型等
-   执行操作后：收集事件的操作结果。对于出现ERROR的场景，则在异常处理函数中收集操作结果。

在所有事件中，DML语句的事件稍复杂一点，此处主要以该类语句为例，梳理整体执行流程：

![2-fl](/images/ProjectDocs/5-design-g100-audit-refactor/2-fl.png)

## 三、详细流程

### 阶段1 配置审计（进程启动）

首先，用户通过GUC参数，配置审计文件管理等功能。然后，在系统启动阶段，审计模块将根据配置，初始化的各类关键资源，包括：

1.  日志文件：日志存储目录，初始日志文件等
2.  审计内存：日志缓存区，内存上下文等
3.  审计线程：信号处理函数等
4.  事件收集节点：hook函数注册等

详细启动过程如下：

```python
main    # 1. 启动vastbase进程
    knl_instance_init
    MemoryContextInit
    PostmasterMain      # 2. 启动postmaster线程
        SelectConfigFiles       # 3. 加载GUC参数
        checkDataDir
        'audit_dir_init'        # 4. 创建审计日志文件目录
        'audit_hook_init'       # 5. 注册审计回调函数：身份认证等
        load_hba
        reset_shared
            CreateSharedMemoryAndSemaphores # （日志缓冲区不是共享内存，后文阶段6详细介绍）
        GlobalSysDBCache::Init
        CreateLocalSysDBCache
        InitRoleIdHashTable
        'audit_comm_init'       # 6. 初始化审计内存上下文、日志缓存区，创建审计日志文件
        'initialize_util_thread(AUDIT_WRITER)'  # 7. 启动audit-writer 线程，持续读取日志缓冲区，等待接收与存储日志
            initialize_thread
                ..
                    # ===== audit-writer 线程 ==============
                    GaussDbThreadMain
                        InitShmemAccess
                        InitAuxiliaryProcess
                        CreateSharedMemoryAndSemaphores
                            GaussDBAuxiliaryThreadMain
                                BaseInit
                                'adt_writer_main'
                    # ===== audit-writer 线程 ==============
        ServerLoop
            for (;;)
                comm_select
                ConnCreate  # 9. 接收客户端连接
                BackendStartup
                    initialize_util_thread(WORKER)
                        initialize_thread
                            ..
                                # ===== postgres 线程 ==============
                                GaussDbThreadMain
                                    knl_thread_init
                                    InitializeGUCOptions
                                    CreateLocalSysDBCache
                                    'audit_hook_init' # 10. 注册事件收集回调函数：计划执行、函数执行等回调点
                                    BackendInitialize
                                    BackendRun
                                        PostgresMain
                                # ===== postgres 线程 ==============
                'initialize_util_thread(AUDIT_WRITER)' # 11. 检查audit-writer 线程状态与自动重启
```

### 阶段2 设置范围

向用户提供SQL接口，用于创建审计策略。（见另一个设计文档）

### 阶段3 收集事件

数据库中，产生的事件类型较多，按触发方式，可将事件分为以下3类：

-   系统事件：直接触发或异常导致的事件。启动、停止集群，登录、登出集群
-   SQL事件：SQL触发的事件
    -   DML
    -   DDL/DQL/MNG/..
    -   FUNC
-   内部事件：非用户直接触发的事件

#### 一、系统事件

共4种事件，包括：启动、停止集群，登录、登出集群。各事件需注意的点如下：

-   启动集群：初始化审计模块后，postmaster线程才生成启动集群事件，并传输到audit-writer线程。
-   停止集群：audit-writer线程收到shutdown相关信号后，生成停止集群事件并落盘。如果由postmaster线程生成停止集群事件，需在将shutdown信号传输给audit-writer前，以及清理LWLock等资源前，传输审计事件给audit-writer，适配点较多
-   登录集群：无法直接使用内核已有hook框架，因为代码流程中的hook点靠后，在hook点前出现的部分登录失败场景，无法走到hook点
-   登出集群：清理postgres线程时，产生登出集群事件，需确保在清理共享内存前产生事件，因为发送日志需依赖共享内存中的LWLock

完整流程如下：

```python
PostmasterMain
    audit_dir_init
    audit_worker_init     # 1. 注册回调函数：身份认证
    audit_comm_init       # 2. 初始化审计内存上下文、日志缓存区，创建审计日志文件
        'audit_system_startup'  # 3. 收集事件：启动集群
    initialize_util_thread(AUDIT_WRITER)
        initialize_thread
            ..
                # ===== audit-writer 线程 ==============
                adt_writer_main
                    for (;;)
                        if SIGTERM:
                            'audit_system_shutdown' # 4. 收集事件：停止集群
                # ===== audit-writer 线程 ==============
    ServerLoop
        for (;;)
            BackendStartup
                initialize_util_thread(WORKER) # 5. 启动 postgres线程
                    ..
                        # ===== postgres 线程 ==============
                        GaussDbThreadMain
                            BackendInitialize
                            BackendRun
                                PostgresMain
                                    BaseInit
                                    on_shmem_exit('audit_logout_system') # 6. 注册线程退出回调函数：登出集群
                                    PostgresInitializer::InitBackendWorker # 7. 初始化连接
                                        if not thread_pool:
                                            PostgresInitializer::InitSession
                                                InitSysCache
                                                CheckAuthentication
                                                    PerformAuthentication
                                                        ClientAuthentication
                                                            'audit_login_system' # 8. 收集事件：登录集群
                                                            recv_and_check_password_packet # 9. 身份认证
                                                            'audit_send_all_log'  # 10. 发送日志
                                                LoadSysCache
                                    for (;;)
                                        if thread_pool:
                                            while True:
                                                ThreadPoolWorker::AttachSessionToThread
                                                    InitSession
                                                        PostgresInitializer::InitSession
                                        ReadCommand
                                proc_exit # 8. 退出线程
                                    proc_exit_prepare
                                        shmem_exit
                                            ..
                                                'audit_logout_system' # 11. 收集事件：登出集群
                        # ===== postgres 线程 ==============
                if SIGTERM or SIGINT:
                    pmdie
                        signal_child
                        PostmasterStateMachine
                elif SIGQUIT:
                    killGraceThreads
                        signal_child
                    ExitPostmaster
```

#### 二、SQL事件

SQL种类较多，根据hook点不同，可分为以下几类：

1.  DDL类：CREATE, DROP等。其他DCL类、MNG类等，例如GRANT、VACUUM等，也可划到DDL大类中。
2.  DQL：SELECT
3.  FUNC：执行FUNCTION

上文提到，为收集事件中操作的结果，收集点如下：

-   执行操作前：收集事件基本信息
-   执行操作后：未清理执行资源前，例如内存上下文等，收集事件的操作结果：操作成功，并发送日志。
-   执行操作中：如果发生错误，调用ereport触发的长调转，在异常处理的最早期阶段，收集事件的操作结果：操作失败，并发送日志。

内核执行SQL时，在初始化plan，执行plan，执行plan结束等多个阶段，都提供hook点，但是，部分hook点无法满足收集操作结果的需求，因此，本需求将新增几个hook点：

-   DML事件
    -   现状：在初始化plan阶段，内核访问控制框架会遍历所有的操作信息{操作，对象}，并检查权限。检查后，有个hook点
    -   问题：如果检查过程中，发现权限问题，会直接报错，无法走到hook点
    -   修改：在检查权限之间，新增hook点，收集事件基本信息
-   FUNC事件
    -   现在：postgresql在所有执行function的地方，都有hook点
    -   问题：openGauss与G100，将function的hook点全都删了，因为其他功能用不上
    -   修改：新增执行function的hook点，参考postgresql加回来

当前的收集框架，存在一点小缺陷：

-   问题：对于DML类事件，在语法解析、语义分析阶段，如果发生ERROR，例如操作不存在的表等，无法收集事件
-   原因：在初始化plan阶段，才收集DML类事件，事件中包括操作类型、客体类型、客体名称等。在语义分析大部分阶段，未完整获取操作类型、客体类型等信息。
-   解释：最关键的因权限导致的ERROR，可以收集事件，因为在初始化plan阶段才检查DML权限

完整流程如下：

```python
PostgresMain
    InitProcess
    if sigsetjmp:
        'audit_send_all_log(FAILED)' # 收集事件结果：操作失败
    for ;;
        ReadCommand
        reload_configfile
        case 'Q':
            exec_simple_query
                parse_query_auto_gram
                pg_analyze_and_rewrite
                pg_plan_queries
                PortalStart
                    if 'SELECT':
                        ExecutorStart
                            # hook
                            standard_ExecutorStart
                                InitPlan
                                    ExecCheckRTPerms
                                        '新增 prev_hook'    # 收集事件：DQL
                                        ExecCheckRTEPerms
                                        # hook
                                    ExecInitNode
                PortalRun
                    if 'SELECT':
                        PortalRunSelect
                            ExecutorRun
                    elif 'INSERT/UPDATE/DELETE' or 'DDL':
                        PortalRunMulti
                            if 'DML':
                                ProcessQuery
                                    if 'INSERT/UPDATE/DELETE':
                                        ExecutorStart
                                            # 已有hook
                                            standard_ExecutorStart
                                                InitPlan
                                                    ExecCheckRTPerms
                                                        '新增 prev_hook'    # 收集事件：DML
                                                        ExecCheckRTEPerms
                                                        # 已有hook
                                    ExecutorRun
                                        # 已有hook
                                        standard_ExecutorRun
                                            ExecutePlan
                                    ExecutorFinish
                                        # 已有hook
                                            'audit_send_all_log(FAILED)' # 收集事件结果：操作成功
                                        standard_ExecutorFinish
                                            ExecPostrocessPlan
                                    ExecutorEnd
                                        # 已有hook
                                        standard_ExecutorEnd
                                            ExecEndPlan
                                                ExecEndNode
                                                heap_close
                                            FreeExecutorState
                                                # delete query mem cxt
                            elif 'DDL':
                                PortalRunUtility
                                    ProcessUtility
                                        # 已有hook                       # 收集事件：DDL
                                        standard_ProcessUtility
                                        'audit_send_all_log(FAILED)'    # 收集事件结果：执行成功
                PortalDrop
                    PortalCleanup
                        if 'SELECT':
                            ExecutorFinish
                                # hook                                  # 收集事件结果：操作成功
                                standard_ExecutorFinish
                            ExecutorEnd
                                # hook
                                standard_ExecutorEnd
                finish_xact_command
                    CommitTransaction
                        RecordTransactionCommit
        case 'P':
            exec_parse_message
        case 'B':
            exec_bind_message
        case 'E':
            exec_execute_message
```

#### 三、内部事件

除系统事件、SQL事件外，内核还会产生一些内部事件，这些事件不是用户直接触发的。此类事件需要过滤。

-   2p-cleaner线程  
    平均间隔1秒左右，与数据库建立连接，并发送与执行SQL语句。此类连接，内核可识别到，客户端类型为gs_clean。审计模块将直接过滤’application_name=gs_clean’的事件。

    ```python
    TwoPhaseCleanerMain
        for (;;)
            DropTempNamespace
            LoginDatabase
                PQconnectdbParams
                DropTempSchema
                    'DROP SCHEMA pg_toast_temp_xx CASCADE'
    ```

-   vsql  
    vsql每次与内核建立连接时，都会自动发送与执行6条SQL，以获取兼容性等信息。审计模块将过滤’application_name=vsql’的前6条SQL。

    ```python
    vsql -h xxx -p xxx -U xxx -W xxx

    main
        ..
        PQconnectdbParams       # 1. 与server端建立连接
        PQexec('SELECT VB_VERSION()')       # 2. 检查版本
        PQexec('select setting from pg_catalog.pg_settings ..') # 3. 检查兼容性
        # 4. ...
    ```

#### 其他信息

对于每个事件，除主体、操作、客体相关的核心信息外，还需在一些关键节点，收集以下信息：

1.  SQL语句
2.  客户端信息：客户端类型、客户端IP、客户端主机名、客户端端口
3.  客体详细属性：客体所属Database，客体所属Schema
4.  其他信息：事务ID，XLOG ID，会话ID，线程ID等

上述信息，均可从session级的全局变量上获取。

### 阶段4 过滤事件

收集事件后，需根据用户配置的审计策略，判断事件是否需被审计。（见另一个设计文档）

### 阶段5 生成日志

对于所有事件，都生成统一格式的日志。每条日志中的所有内容如下：

-   日志字段

    ```sql
    | 字段      |  内容                         解释
    ------------+-----------------------------------
    optime      | 2025-09-21 12:00:01.400009+08 -- 操作时间
    apolicy     | ap1                           -- 策略名称：生成本条日志的策略
    scope       | ddl                           -- 操作分类：例如ddl,dml,dql等
    subjname    | shenkun                       -- 操作用户
    optype      | create                        -- 操作类型
    objtype     | table                         -- 客体类型
    objname     | t2                            -- 客体名称
    cliip       | 10.44.136.83                  -- 客户端IP或HOST
    cliport     | 39850                         -- 客户端端口
    cliapp      | vsql                          -- 客户端类型：即连接参数applicatiion_name
    opresult    | succeed                       -- 操作结果：成功或失败
    objdb       | vastbase                      -- 客体所属database
    objnsp      | public                        -- 客体所属schema
    opxid       | 0                             -- 操作的xlog id
    optid       | 0                             -- 操作的事务id
    opthreadid  | 489                           -- 操作的线程id
    opsessid    | 1986                          -- 操作的会话id
    sql         | CREATE TABLE t2 AS SELECT * FROM t1; -- 原始SQL语句
    extra       |                                      -- 其他信息：例如报错信息
    ```

-   物理格式
    -   压缩存储：将大部分text类内容，使用枚举型压缩存储。例如，针对对象类型，将database存储为1，schema存储为2等
    -   后向兼容：日志存储在Page中，每个Page的PageHeader中，有版本号等信息

        ```c
        typedef struct {
            /* basic info: 4 bytes, must in the same page */
            uint16 loglen;
            uint16 logtype;
            uint32 logcrc;
            AuditTime optime;
            uint16 flags;
            uint32 scope;
            uint32 cliport;
            /* operate info */
            uint16 optype;
            uint16 objtype; /* to align the structure, we place it here */
            uint16 opresult;
            uint16 sqlid;
            uint64 opxid;
            uint32 optid;
            uint32 oppid;
            /* client info */
            uint16cliipoff;
            uint16 cliappoff;
            /* subject info */
            uint16 subjoff;
            /* object info */
            uint16 objoff;
            uint16 objdboff;
            uint16 objnspoff;
            /* the details */
            uint16 sqloff;
            uint16 extraoff;
            /* all text are stored below */
            char textbuf[0];
            /* +------+------+------+----+------+
            *  | text | text | text | .. | text |
            *  +------+------+------+----+------+
            */
        }
        ```

### 阶段6 传输日志

开启审计时，postgres等线程生成日志后，需将日志发送到日志缓存区，由audit-writer线程写至磁盘。  
关闭审计时，对于强制审计类事件，例如启动、停止集群，登录、登出用户，执行CREATE USER等DCL，产生事件的线程直接将日志写至磁盘。

#### 开启审计时

通过日志缓存区传输日志：

-   传输场景  
    通常，应用场景中，用户并发执行SQL，可能同时存在100+个worker线程执行SQL，产生并传输日志。在本版本，只有1个audit-writer线程负责存储日志
-   传输介质  
    普通堆内存传输日志
-   传输设计
    -   并发传输：多个worker线程，可并发传输日志
    -   高效传输：合理设计锁，减少线程阻塞
-   传输模型 ![3-sl](/images/ProjectDocs/5-design-g100-audit-refactor/3-sl.png)
-   传输流程  
    假设：3个工作进程，并发发送日志，日志长度分为为a,b,c

    | 时刻 | 工作进程1 | 工作进程2 | 工作进程3 | 工作线程4 | 审计进程 |
    | --- | --- | --- | --- | --- | --- |
    | 1 | 发送日志 | \- | \- | \- | \- |
    | 2 | \- | 发送日志 | \- | \- | \- |
    | 3 | \- |  | 发送日志 | \- | \- |
    | 4 | 获取读锁 | \- | \- | \- | \- |
    | 5 | \- | 获取读锁 | \- | \- | \- |
    | 6 | \- | \- | 获取读锁 | \- | \- |
    | 7 | 预留空间指针 + a | \- | \- | \- | \- |
    | 8 | \- | 预留空间指针 + b | \- | \- | \- |
    | 9 | \- | \- | 预留空间指针 + c | \- | \- |
    | 10 | \- | \- | \- | \- | 申请写锁 |
    | 11 | 已发送指针 + a | \- | \- | \- | \- |
    | 12 | \- | 已发送指针 + b | \- | \- | \- |
    | 13 | \- | \- | 已发送指针 + c | \- | \- |
    | 14 | 释放读锁 | \- | \- | \- | \- |
    | 15 | \- | \- | \- | 申请读锁 | \- |
    | 16 | \- | 释放读锁 | \- | \- | \- |
    | 17 | \- | \- | 释放读锁 | \- | \- |
    | 18 | \- | \- | \- | \- | 获取写锁 |
    | 19 | \- | \- | \- | \- | 获取待落盘长度 a + b + c |
    | 20 | \- | \- | \- | \- | 落盘 a + b + c |
    | 21 | \- | \- | \- | \- | 已落盘指针 + a + b + c |
    | 22 | \- | \- | \- | \- | 释放写锁 |
    | 23 | \- | \- | \- | 获取读锁 | \- |

#### 关闭审计时

postmaster线程，postgres线程，直接将日志暂存在1个大小为4k的公共的writer-buffer，当writer-buffer大小达到4k或间隔达到1秒，产生事件的线程直接将writer-buffer写至磁盘。

### 阶段7 存储日志

audit-writer将日志存储至磁盘，在磁盘中，日志的存储结构如下图所示：

![4-lf](/images/ProjectDocs/5-design-g100-audit-refactor/4-lf.png)

其中，PageHeader格式如下：

```c
typedef struct {
    uint16 version; /* version 1: the relative starting time of 'pagetime' is '2020.1.1 ee:0o:eo' */
    uint16 flags;
    uint16 datastart;
    uinti6 remainlen
    AuditTime pagetime;
    uint32 crc;
    uint32 noused;
} AuditPageHeader;
```

### 阶段8 查询日志

审计特性，不提供在线删除日志功能。

-   读写场景：对日志的访问，只有2种访问场景，postgres线程查询日志，audit-writer线程写入日志
-   读写冲突：对于日志文件，只有并发查询、追加写操作，二者可以完全不冲突。查询前，获取写入位置，类似快照的机制。查询时，查询到写入位置即结束，不往后继续查询。

# 3 接口说明

需求文档中，已详细介绍各接口，本文档不再重复介绍。

| 编号 | 接口类型 | 变更 | 数量 | 细节 |
| --- | --- | --- | --- | --- |
| 1 | GUC | 新增 | 6 | enable_audit,audit_directory_size,audit_flush_policy等 |
| 2 | SQL | 变更 | 3 | CREATE/ALTER/DROP AUDIT POLICY |
| 3 | CATALOG | 新增 | 1 | vb_adt_policy |
| 4 | FUNCTION | 新增 | 4 | vb_audit_log(sec/time),vb_audit_buffer_stat等 |
| 5 | VIEW | 新增 | 2 | vb_audit_policy,vb_audit_log |
| 6 | 工具 | 新增 | 1 | vb_audit |
| 7 | 工具 | 修改 | 2 | vb_initdb, vb_dump |
| 8 | 文件夹 | 新增 | 1 | data_directory/vb_audit |
| 9 | 文件 | 新增 | n | data_directory/vb_audit/日志文件 |

# 4 内存管理

-   日志缓存区  
    启动集群时，在postmaster线程启动过程中，创建日志缓存区。退出集群时，才清理日志缓存区。
-   临时内存  
    每次将事件格式化为日志时，临时申请1小块内存存放日志，并立即发送日志，发送后释放临时内存

# 5 安全

-   查询日志  
    以下角色，有权查询日志：
    1.  initial user
    2.  superuser
    3.  sysadmin (未开启三权分立的情况下)
    4.  auditadmin
    5.  vbadmin

# 6 性能

-   性能场景：tpcc，1000仓，300-500并发
-   性能要求：
    -   基准：不开启审计
    -   劣化场景一：开启审计，不创建审计策略，劣化低于1%（注册事件收集点）
    -   劣化场景二：开启审计，创建审计策略，审计所有事件，日志异步落盘，劣化低于10%
    -   劣化场景三：开启审计，创建审计策略，审计所有事件，日志同步落盘，劣化低于15%（为收集执行结果，日志发送时间较晚，待评估）
-   性能设计
    -   线程通信：采用堆内存
    -   并发控制：postgres线程并发发送日志，audit-writer线程存储日志，存在锁排队问题，后续版本继续分析优化

# 7 专利

-   通用性  
    业界大部分关系数据库，都支持细粒度审计功能
    -   Oracle：CREATE AUDIT POLICY
    -   SQL Server: CREATE DATABASE AUDIT SPECIFICATION
    -   GaussDB：CREATE AUDIT POLICY
    -   OceanBase：AUDIT
-   必要性
    -   以tpcc为例，假设1分支执行60万次事务，至少生成60万次事件，约1秒至少产生1万个事件，过滤1万次。审计策略通常有几十条甚至更多。
    -   本设计可提升过滤速度，平均提升10+倍
-   方案概述  
    平均每个事件，可以少匹配几百个节点 ![5-fe](/images/ProjectDocs/5-design-g100-audit-refactor/5-fe.png)

# 8 升级管理

-   升级中：升级过程中，即upgrade_mode=1时，审计功能不记录任何事件。但会记录upgrade_mode取值变更的事件，据此可识别升级事件。
-   升级后：

    | 编号 | 接口类型 | 变更 | 数量 | 细节 |
    | --- | --- | --- | --- | --- |
    | 1 | GUC | 新增 | 4 | enable_audit,audit_directory_size,audit_flush_policy等 |
    | 2 | GUC | 修改 | 2 | audit_buffer_size,audit_thread_num |
    | 3 | GUC | 删除 | 40 | audit_login_logout,audit_dml_state,audit_user,audit_operation_result等 |
    | 4 | SQL | 变更 | 3 | CREATE/ALTER/DROP AUDIT POLICY |
    | 5 | CATALOG | 新增 | 1 | vb_adt_policy |
    | 6 | CATALOG | 删除 | 5 | gs_auditing_policy,gs_auditing_policy_access等 |
    | 7 | FUNCTION | 新增 | 4 | vb_audit_log(sec/time),vb_audit_buffer_stat等 |
    | 8 | FUNCTION | 删除 | 7 | pg_query_audit,pg_delete_audit,pg_query_audit_dump,pg_query_audit_info |
    | 9 | VIEW | 新增 | 2 | vb_audit_policy,vb_audit_log |
    | 10 | VIEW | 删除 | 3 | gs_audting,gs_auditing_access等 |
    | 11 | 工具 | 新增 | 1 | vb_audit |
    | 12 | 工具 | 修改 | 2 | vb_initdb, vb_dump |
    | 13 | 文件夹 | 删除 | 1 | data_directory/pg_audit |
    | 14 | 文件夹 | 新增 | 1 | data_directory/vb_audit |
    | 15 | 文件 | 新增 | n | data_directory/vb_audit/日志文件 |

# 9 其他说明

## postgresql函数hook

```sql
-- aggregate
CREATE FUNCTION f_add_a_int(state bigint[], val int)
    RETURNS bigint[] LANGUAGE sql AS
    $$ SELECT ARRAY[state[1] + val, state[2] + 1] $$;

CREATE FUNCTION f_avg_final(state bigint[])
    RETURNS numeric LANGUAGE sql AS
    $$ SELECT state[1]::numeric / state[2] $$;

CREATE AGGREGATE a_int_avg(int) (
  SFUNC    = f_add_a_int,
  STYPE    = bigint[],
  FINALFUNC = f_avg_final,
  INITCOND = '{0,0}'
);

SELECT a_int_avg(v) FROM generate_series(1,6) v;
-- bug: should audit a_int_avg

DROP AGGREGATE a_int_avg(int);
DROP FUNCTION f_add_a_int;
DROP FUNCTION f_avg_final;

-- function
CREATE TABLE t1(c1 INT);
CREATE FUNCTION f1() RETURNS INT AS $$ SELECT count(*)::INT FROM t1 $$ LANGUAGE sql;
SELECT f1();
INSERT INTO t1 VALUES(f1());
DROP TABLE t1;
DROP FUNCTION f1;
```

```python
# 场景一：
InvokeFunctionExecuteHook
fmgr_info | fmgr_info_cxt
    fmgr_info_cxt_security
        fn_addr =
InitFunctionCallInfoData

# 场景二：aggrage的入口函数
PostgresMain
    InitProcess
    for ;;
        ReadCommand
        case 'Q':
            exec_simple_query
                parse_query_auto_gram
                pg_analyze_and_rewrite
                pg_plan_queries
                PortalStart
                    if 'SELECT':
                        ExecutorStart
                            # hook
                            standard_ExecutorStart
                                InitPlan
                                    ExecCheckRTPerms
                                        '新增 prev_hook'    # 收集事件：DQL
                                        ExecCheckRTEPerms
                                        # hook
                                    ExecInitNode
                PortalRun
                    if 'SELECT':
                        PortalRunSelect
                            ExecutorRun
                    elif 'INSERT/UPDATE/DELETE' or 'DDL':
                        PortalRunMulti
                            if 'DML':
                                ProcessQuery
                                    if 'INSERT/UPDATE/DELETE':
                                        ExecutorStart
                                            # 已有hook
                                            standard_ExecutorStart
                                                InitPlan
                                                    ExecCheckRTPerms
                                                        '新增 prev_hook'    # 收集事件：DML
                                                        ExecCheckRTEPerms
                                                        # 已有hook
                                    ExecutorRun
                                        # 已有hook
                                        standard_ExecutorRun
                                            ExecutePlan
                                    ExecutorFinish
                                        # 已有hook
                                            'audit_send_all_log(FAILED)' # 收集事件结果：操作成功
                                        standard_ExecutorFinish
                                            ExecPostrocessPlan
                                    ExecutorEnd
                                        # 已有hook
                                        standard_ExecutorEnd
                                            ExecEndPlan
                                                ExecEndNode
                                                heap_close
                                            FreeExecutorState
                                                # delete query mem cxt
                            elif 'DDL':
                                PortalRunUtility
                                    ProcessUtility
                                        # 已有hook                       # 收集事件：DDL
                                        standard_ProcessUtility
                                        'audit_send_all_log(FAILED)'    # 收集事件结果：执行成功
                PortalDrop
                    PortalCleanup
                        if 'SELECT':
                            ExecutorFinish
                                # hook                                  # 收集事件结果：操作成功
                                standard_ExecutorFinish
                            ExecutorEnd
                                # hook
                                standard_ExecutorEnd
                finish_xact_command
```
