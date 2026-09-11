+++
title = '海量 9 设计 E100审计'
date = '2025-07-22T14:28:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['审计', '设计文档']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 E100审计功能

## 1.1 功能简述

【审计功能】  
审计是重要的安全特性，核心功能是收集数据库内的事件，例如：登录用户、创建对象、查询数据等，根据事件生成与审计日志，存储审计日志，向用户提供日志查询接口。使用方式请看需求文档。

【审计架构】  
审计整体架构如下图所示：（**“线程“替换为“进程”**，原图不小心弄丢了，不好修改了，将就看）

![adt-1](/images/ProjectDocs/9-design-e100-audit/adt-1.png)

【审计流程】

![adt-2](/images/ProjectDocs/9-design-e100-audit/adt-2.png)

## 1.2 实现方案

### 一、启动审计进程

```bash
1. 启动postmaster进程    # PostmasterMain
    2. 加载GUC参数      # SelectConfigFiles
        2.1 '---加载审计GUC---'
    3. 创建共享内存和信号量     # reset_shared -> CreateSharedMemoryAndSemaphores
        3.1 计算共享内存总大小
            '计算审计共享内存大小：根据GUC配置'
        3.2 创建共享内存  # PGSharedMemoryCreate
        3.3 创建LwLock   # CreateLWLocks
        3.4 初始化wal-buffer共享内存 # XLOGShmemInit
        3.5 初始化share-buffer共享内存 # InitBufferPool
        3.6 '如果开启审计：初始化审计共享内存：划分共享内存，包括audit-buffer'
    4. 启动sys-log进程 # SysLogger_Start
    5. '如果开启审计：初始化审计模块'
        5.1 '日志目录：检验与创建审计日志目录'
        5.2 '日志文件：每次重启，使用新的日志文件，方便用户单个删除日志文件'
        5.3 '内存上下文：创建审计全局内存上下文'
        5.4 '审计缓存区：初始化audit-buffer'
        5.5 '审计文件：初始化审计文件（并发write, read, delete日志）'
        5.6 '回调函数：在执行DDL、计划、函数等关键函数中，注册生成审计事件、日志的回调函数' # 后面详细介绍
    6. '如果开启审计：启动审计进程'
        6.1 '信号：注册信号处理函数：sighup, sigquit, sigusr1'
        6.2 '显示：设置ps命令显示的进程信息'
        6.3 主循环
            6.4 '等待事件：关键是timeout'
            6.5 '存储日志：读取audit-buffer中待落盘的日志，并存储' # 后面详细介绍
            6.6 '调整速率：按照每次落盘数据的长度，动态调整timeout'
                连续多次为0，timeout依次变为1ms, 100ms, 1s
                单次落盘长度大于16m，timeout=0
    7. '主循环' # ServerLoop
        7.1 接收客户端连接       # select
        7.2 创建postgres进程    # BackendStartup -> BackendRun -> PostgresMain
        7.3 检查与重启sys-log进程 # SysLogger_Start
        7.4 '检查与重启审计进程'
        7.5 检查与重启checkpointer进程 # StartCheckpointer
        7.6 检查与重启wal-writer进程   # StartWalWriter
```

### 二、收集审计事件

目前，只有以下2类进程，会生成审计事件：

-   postmaster：启动集群、停止集群
-   postgres：登录用户、登出用户、执行SQL

#### postmaster进程

对于postmaster进程，事件类型为：启动、停止集群。收集事件的流程如下：

```bash
1. 启动postmaster进程 # PostmasterMain
    2. 加载GUC参数 # InitializeGucOptions
    3. 检查数据库目录 # CheckDataDir
    audit_dir_init
    3. 创建共享内存和信号量 # reset_shared
        3.x '如果开启审计：初始化审计共享内存：划分共享内存，包括audit-buffer'
    4. 启动sys-log进程 # SysLogger_Start
    5. '如果开启审计：初始化审计模块'
        5.x '如果开启审计：基于PG已有的hook框架，注册审计回调函数（身份认证、执行DDL、执行DML等）'
    6. '如果开启审计：启动审计进程'
        6.1 '生成审计事件：启动系统'
    7. '主循环' # ServerLoop
```

#### postgres进程

对于postgres进程，事件类型为：登录用户、执行DDL、执行DML、执行函数、执行其他语句、登出用户。收集的事件的流程如下：

```bash
1. 启动postgres进程 # PostgresMain
    2. 加载GUC参数 # SelectConfigFiles
    3. 初始化共享内存和信号量 # BaseInit->InitCommunication
    4. 初始化postgres进程 # InitPostgres
        4.1 初始化缓存 # InitCatalogCache
        4.2 '注册进程结束回调函数：用户登出账号'
        4.3 注册注册进程结束回调函数：清理事务、清理锁 # ShutdownPostgres
        4.4 进行身份认证 # PerformAuthentication->ClientAuthentication
            4.4.1 校验密码
            4.4.2 '执行回调函数：身份认证'
                4.4.2.1 '执行审计回调函数：身份认证'
    6. 主循环
        7. 接收客户端数据 # ReadCommand
        8. 重载SIGHUP级GUC参数 # ProcessConfigFile
        9. 执行SQL # exec_simple_query
            10. '记录当前原始SQL语句'
            11. 语法解析 # pg_parse_query
            12. 语义分析和查询重写 # pg_analyze_and_rewrite
            13. 计划生成 # pg_plan_queries
                13.1 预处理函数 # pg_plan_query->planner->..->preprocess_expression
                    13.2 替换函数 # ExecInitFunc
                    13.3 '执行审计回调函数：执行函数' # RunFunctionExecuteHook
                        13.3.1 '执行审计回调函数：执行函数'
            14. 执行 # PobtrtalRun->PortalRunMulti
                15. 执行DDL/DCL/等 # PortalRunUtility->ProcessUtility
                    15.1 执行回调函数：处理DDL/DCL/等非DML # ProcessUtility_hook
                        15.1.1 '执行审计回调函数：处理DDL/DCL/等非DML'
                            switch (nodeTag(parsetree)) {
                                case T_CreatedbStmt:
                                case T_DropStmt:
                                case T_ExecuteStmt:
                                case T_DoStmt:
                                ...
                                '工作量：识别所有DDL中的主体、操作、客体等信息'
                            }
                    15.2 执行标准函数：处理DDL/DCL/等非DML # standard_ProcessUtility
                16. 执行DML等 # ProcessQuery
                    17. 初始化计划 # ExecutorStart->InitPlan
                        17.1 检查对象访问权限 # ExecCheckRTPerms
                        17.2 执行回调函数：检查对象访问权限
                            17.2.1 '执行审计回调函数：检查对象访问权限，入参为{操作、对象}的列表'
                            （基于访问控制框架）
                        17.3 初始化算子 # ExecInitNode
                            17.3.1 初始化算子中的函数 # ExecInitFunc
                                17.3.2 执行回调函数：执行函数 # InvokeFunctionExecuteHook
                                    17.3.2.1 '执行审计回调函数：执行函数'
                    18. 执行计划  # ExecutorRun->ExecutePlan
                        18.1 执行算子
                            18.2 执行qual/project中的函数 # FunctionCallInvoke
                            18.3 执行回调函数：执行函数 # InvokeFunctionExecuteHook
                                18.3.1 '执行审计回调函数：执行函数'
                            18.4 调用heapam等接口
                                18.4.1 访问share-buffer
                                18.4.2 生成xlog
                                18.4.3 访问wal-buffer
                    19. 清理计划 # ExecutorEnd
            20. 提交事务 # finish_xact_command->CommitTransactionCommand->CommitTransaction
                21. 等待xlog落盘 # XLogFlush
                22. '以后版本计划：审计同步落盘：等待审计日志落盘'
```

### 三、发送审计日志

审计缓冲区的模型如下：

![adt-3](/images/ProjectDocs/9-design-e100-audit/adt-3.png)

工作进程，发送日志的流程如下：

```python
1. 工作进程：发送审计日志，长度为x
    2. 加锁：audit-buffer读锁
        2. 加锁：预留空间自旋锁
            3. 申请的预留位置 = '预留空间指针'
            3. '预留空间指针' += x
        2. 解锁：预留空间自旋锁

        3. 写入审计日志到audit-buffer
        4. '已写入指针' += x
    3. 解锁：audit-buffer读锁

审计进程：
    1. 申请audit-buffer写锁，需等待工作进程
    2. 获取audit-buffer写锁时，一定满足'预留空间指针 == 已写入指针'
        (极低概率异常：'预留空间指针 != 已写入指针'，触发异常处理：检查日志，如果发现异常的，则丢弃异常之后的整段日志)
```

并发场景，工作流程如下：  
（假设：3个工作进程，并发发送日志，日志长度分为为a,b,c）

| 时刻 | 工作进程1 | 工作进程2 | 工作进程3 | 工作线程4 | 审计进程 |
| --- | --- | --- | --- | --- | --- |
| 1 | 发送日志 | - | - | - | - |
| 2 | - | 发送日志 | - | - | - |
| 3 | - |  | 发送日志 | - | - |
| 4 | 获取读锁 | - | - | - | - |
| 5 | - | 获取读锁 | - | - | - |
| 6 | - | - | 获取读锁 | - | - |
| 7 | 预留空间指针 + a | - | - | - | - |
| 8 | - | 预留空间指针 + b | - | - | - |
| 9 | - | - | 预留空间指针 + c | - | - |
| 10 | - | - | - | - | 申请写锁 |
| 11 | 已发送指针 + a | - | - | - | - |
| 12 | - | 已发送指针 + b | - | - | - |
| 13 | - | - | 已发送指针 + c | - | - |
| 14 | 释放读锁 | - | - | - | - |
| 15 | - | - | - | 申请读锁 | - |
| 16 | - | 释放读锁 | - | - | - |
| 17 | - | - | 释放读锁 | - | - |
| 18 | - | - | - | - | 获取写锁 |
| 19 | - | - | - | - | 获取待落盘长度 a + b + c |
| 20 | - | - | - | - | 落盘 a + b + c |
| 21 | - | - | - | - | 已落盘指针 + a + b + c |
| 22 | - | - | - | - | 释放写锁 |
| 23 | - | - | - | 获取读锁 | - |

### 五、组织审计日志

-   AuditFile：1个AuditFile，由多个AuditPage组成。大小固定为64M
-   AuditPage：1个AuditPage，大小固定为4k，存储多条AuditLog。引入AuditPage的作用如下：
    1.  内容校验：CRC校验的粒度
    2.  并发控制：并发写日志、读日志、删日志时，判断是否需加锁保护
    3.  完整性保护：发生断电等异常时，避免只写入半条日志等特殊情况（1条日志跨越2个物理block）
    4.  快速查找：根据页面头部的时间信息，快速找打符合条件的日志
    5.  –>以后版本：哈希、加密、区块链的粒度
    6.  –>以后版本：方便从后往前读日志
-   AuditLog：1条审计日志。

![adt-4](/images/ProjectDocs/9-design-e100-audit/adt-4.png)

### 六、读取审计日志

（这块并发管理写的不是很好，需再优化）  
以下3种场景，读日志存在并发冲突：

-   审计进程：写日志，单进程
    -   读到(正在写的文件，正在写的Page)，等待写锁
-   工作进程：读日志，多进程
    -   并发读
-   工作进程：删日志，单进程
    -   如果存在任意一个删进程，等待删锁

```python
1. 工作进程执行pg_audit_log(begin_time, end_time)
    2. 获取指定的最早和最晚时间
    3. 如果为指定最晚时间，则最晚时间为当前时间
    4. '初始化TupleStore' # 由PG提供，具有自动物化的功能
    5. 扫描文件：查找日志目录所有文件，按文件名过滤不符合时间的文件
    6. 排序文件：按文件名中的时间排序日志文件
    7. 循环：
        8. 读取日志：
            8.1 打开文件：按顺序从头打开、读取文件
            8.2 '并发控制：如果读取审计进程正在写的文件和AuditPage，则获取文件读锁'
                '提示：审计进程写日志时，获取文件写锁，不读日志时，无人竞争写锁'
            8.3 读取AuditPage：1次读取1个AuditPage
            8.4 获取AuditLog：1次获取1个AuditLog
        9. '缓存日志：将日志缓存在TupleStore中，必要时自动物化'
        10. '保护机制：如果日志条数 > 10000，则中止，并提示用户：'
            日志数量过多，缩小begin_time和end_time的区间
```

### 七、删除审计日志

以下3种场景，删日志存在并发冲突：

-   审计进程：写日志，单进程
    -   删到（正在写的文件），等待写锁
-   工作进程：读日志，多进程
    -   竞争删锁
-   工作进程：删日志，单进程
    -   如果存在任意一个删进程，报错，只允许1个删进程

```python
1. 工作进程执行pg_delete_audit_log(begin_time, end_time)
    2. 同一时刻，只能有1个进程删除日志，否则报错
    3. 如果为指定最晚时间，则最晚时间为当前时间
    4. 扫描文件：查找日志目录所有文件，按文件名过滤不符合时间的文件
    5. 排序文件：按文件名中的时间排序日志文件
    6. 循环：
        7. '并发控制：如果涉及审计进程在写的文件，则获取文件写锁，删除文件中符合条件的日志，更新审计进程write偏移'
        8. 快速删除：根据文件名，获取文件中最早日志。读取文件最后1个Page，获取文件中最晚日志。可判断是否直接删除整个文件
        9. 其他删除逻辑较简单，此处不再介绍
```

### 八、审计测试工具

release版本，audit_tool支持功能如下：

-   解析日志文件
-   打印日志文件（复用内置函数pg_audit_log()的代码）

debug版本，audit_tool额外支持

-   随机生成日志文件与日志
-   删除审计日志（复用内置函数pg_audit_delete_log()的代码）
-   多进程并发生成、存储审计日志（复用audit-buffer、audit-writer进程的代码）

## 1.3 接口说明

-   用户接口  
    新增4个函数

    ```sql
    -- 查看可选审计范围
    pg_audit_scope()

    -- 查看审计日志
    pg_audig_log()
    pg_audig_log(timestamptz begtime, timestamptz endtime)

    -- 删除审计日志
    pg_audit_delete_log(timestamptz begtime, timestamptz endtime)
    ```

    新增1个视图

    ```sql
    CREATE VIEW pg_audit_log AS SELECT * FROM pg_audig_log();
    ```

    新增1个工具

    ```bash
    audit_tool -h
    # 输出如下：
    audit_tool is a utility to process audit log.

    usage:
    audit_tool decode [options]
    audit_tool print  [options]

    [options] could be:
    -h,-?, --help                show this help, then exit
    -v, --version                show the version of this tool, then exit
    -d, --direcotry=LOG_DIR      directory of audit logs
    -f, --file=LOG_FILE          audit log file
    -o, --output=DIR_OR_FILE     used with the --direcotry or --file parameter
    -b, --begin-time=BEGIN_TIME  the earliest audit log, format example: '2020/01/01 12:00:00'
    -e, --end-time=END_TIME      the latest audit log

    1. command to decode directory:
    audit_tool decode -d LOG_DIR [-o OUTPUT_DIR] [-b BEGIN_TIME] [-e END_TIME]
    2. command to decode file:
    audit_tool decode -f LOG_FILE [-o OUTPUT_FILE] [-b BEGIN_TIME] [-e END_TIME]
    ```

-   代码接口  
    此处仅列举审计模块对外接口：

    ```c
    /* 资源管理 */
    Size audit_shm_size(); /* 计算共享内存总大小 */
    void audit_init_shmem(); /* 划分共享内存 */
    void audit_init();  /* 初始化所有审计资源 */

    /* 进程管理 */
    int audit_writer_start(); /* 启动审计进程 */
    void audit_writer_exit(); /* 退出审计进程 */

    /* 事件管理：无法通过PG内置hook框架获取的事件 */
    void audit_hook_logout_user(int code, Datum arg); /* 审计登出用户 */
    void audit_hook_start_system(); /* 审计启动集群 */
    void audit_hook_exit_system(int code, Datum arg); /* 审计停止集群 */

    /* 事件管理：获取原始SQL语句（在执行器之前，可能生成事件） */
    void audit_event_init(const char *sql); /* 记录原始SQL语句 */

    /* 内置函数 */
    Datum pg_audit_scope(PG_FUNCTION_ARGS);  /* 查询可选审计范围 */
    Datum pg_audit_log(PG_FUNCTION_ARGS); /* 查询审计日志 */
    Datum pg_delete_audit_log(PG_FUNCTION_ARGS); /* 删除审计日志 */
    ```

-   代码文件  
    审计的关键代码都集中在审计文件夹下，以下文件包含审计90%以上的代码。

    ```bash
    | -- e100
        |-- src
            |-- beckend
                |-- audit
                    |-- audit.c # 所有审计的对外接口
                    |-- adt_config.c
                    |-- adt_time.c
                    |-- adt_query.c # 识别每种DML、DDL，收集事件
                    |-- adt_event.c
                    |-- adt_log.c
                    |-- adt_page.c
                    |-- adt_file.c
                    |-- adt_buffer.c
                    |-- adt_writer.c
            |-- bin
                |-- adt_tool
                    |-- adt_tool.c
                    |-- 软链接：adt_config.c adt_event.c adt_log.c等
    ```

## 1.4 内存管理

-   共享内存
-   临时内存
    1.  收集事件
    2.  生成日志：临时申请内存（一般1k以内）
    3.  发送日志：销毁临时内存

## 1.5 安全

在执行以下3个函数时，检查是否具有审计权限：

1.  查询日志：pg_audit_log()
2.  查询日志：pg_audit_log(begin_time, end_time)
3.  删除日志：pg_audit_delete_log(begin_time, end_time)  
    检查方式：
4.  是否是superuser：访问pg_authid系统表，判断rolsuper列
5.  是否是pg_monitor：访问pg_auth_members系统表，查找{roloid， member}符合{pg_monitor, 当前用户}

## 1.6 性能

实现方案中，发送审计日志章节，已介绍性能瓶颈。

## 1.7 专利

无

## 1.8 升级管理

新增5个GUC参数  
新增4个内置函数  
新增1个视图  
（新增1个功能audit_tool，无任何依赖）

## 1.9 其他说明

无
