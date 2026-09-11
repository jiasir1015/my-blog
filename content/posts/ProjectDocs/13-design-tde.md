+++
title = '海量 透明加密 设计'
date = '2026-03-23T20:52:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['加密', '设计文档']
weight = 1300
ShowToc = true
TocOpen = true
+++
# 1 透明加密

## 1.1 功能简述

关于透明加密的基本概念，请看需求文档。  
用户使用透明加密的示例如下：

```sql
CREATE TABLE t1 (c1 TEXT, c2 TEXT);

CREATE ENCRYPTION KEY tde_key WITH (source=local, password='pass.123');
CREATE ENCRYPTION POLICY ep1 FRO t1 KEY tde_key;

INSERT INTO t1 VALUES ('data1', 'data2');
INSERT INTO t1 VALUES ('data1', 'data2');
SELECT * FROM t1;
```

## 1.2 实现方案

### 1.2.1 整体架构

透明加密的核心目标，是通过数据加密方案，解决攻击者绕过数据库安全机制，直接从磁盘窃取数据的问题。  
在加密数据后，需要确保不影响内核在数据上进行计算。因此，需要在存储层底层，对数据进行加密。另外，为确保存储底层能够识别哪些数据加密，哪些数据不加密，以及使用什么算法加密等，上层需传递加密信息。透明加密逻辑架构如下：

![1-struct](/images/ProjectDocs/13-design-tde/1-struct.png)

### 1.2.2 工作流程

为适配存储底层设计，同时兼顾加密性能，以Page为粒度进行加密，并且，在Page中，存储加密信息。

![2-flow](/images/ProjectDocs/13-design-tde/2-flow.png)

### 1.2.3 详细流程

#### 一、启动进程

在启动进程阶段，故障恢复时，如果回放到属于加密表的xlog，涉及到解密Page，因此，需在故障恢复前加载密钥。

```python
main # 1. 启动数据库进程（基于pg-16代码）
    PostmasterMain # 2. 启动postmaster进程
        SelectConfigFiles # 3. 读取GUC文件
        'tde_load_encryption_key' # 4. 读取密钥文件（后文介绍密钥如何生成）
        SysLogger_Start
        StartupDataBase # 5. 开始故障恢复
            StartupProcessMain
                StartupXLOG
                    ReadControlFile
                    PerformWalRecovery
                        for loop:
                            ReadRecord # 6. 读取xlog
                            ApplyWalRecord # 7. 重放xlog
                                GetRmgr.rm_redo
                                    ...
                                        heap_xlog_insert
                                            XLogReadBufferForRedo
                                                XLogReadBufferForRedoExtended
                                                    XLogReadBufferExtended
                                                        ReadBufferWithoutRelcache
                                                            ReadBuffer_common
                                                                smgrread  # 8. 读取数据文件
                                                                    # 需解密，后文统一介绍
        ServerLoop
            for loop:
                ConnCreate
                BackendStartup
                    BackendRun
                        PostgresMain # 9. 启动postgres进程
                StartCheckpointer
                StartBackgroundWriter
                    StartChildProcess
                        AuxiliaryProcessMain
                            BackgroundWriterMain # 10. 启动bgwriter进程
```

#### 二、生成密钥

当前版本，所有表，使用同一个数据密钥。因此，暂时无需新增系统表，存储密钥对象。

```python
PostgresMain # 1. 启动postgres进程
    for loop:
        exec_simple_query('CREATE ENCRYPTION KEY ..') # 2. 接收创建密钥的SQL
            pg_parse_query # 3. 语法解析
            PortalRun
                PortalRunUtility
                    ProcessUtility
                        standard_ProcessUtility
                            'CreateEncryptionKey(password)' # 4. 执行DDL
                                'master_key = generate_master_key' # 5. 随机生成主密钥
                                    'RAND_bytes'
                                'data_key = generate_data_key(password)' # 6. 基于password派生数据密钥
                                    'PBKDF2'
                                'write_key(master_key, data_key)' # 7. 存储主密钥、数据密钥
                                'XlogInsert(master_key, data_key)' # 8. 生成xlog
```

#### 三、为表设置加密属性

```python
PostgresMain # 1. 启动postgres进程
    for loop:
        exec_simple_query('CREATE ENCRYPTION POLICY FOR t1 ..') # 2. 接收为表设置加密属性的SQL
            pg_parse_query # 3. 语法解析
            PortalRun
                PortalRunUtility
                    ProcessUtility
                        standard_ProcessUtility
                            'CreateEncryptionPolicy'
                                'heap_open(vb_encryption_policy)'
                                'simple_heap_insert' # 4. 向vb_encryption_policy系统表中，存储加密策略：加密算法、MAC算法、密钥轮次
                                'heap_open(vb_secure_class)'
                                'simple_heap_insert' # 5. 向vb_secure_class系统表中，存储加密对象：对象类型、对象oid、对象name、对象加密策略
```

#### 四、存储数据

-   阶段一：组织数据

    ```python
    PostgresMain # 1. 启动postgres进程
        for loop:
            exec_simple_query('INSERT INTO t1 VALUES('data')') # 2. 接收为表设置加密属性的SQL
                pg_parse_query # 3. 语法解析
                PortalRun
                    PortalRunMulti
                        ProcessQuery
                            ExecutorStart
                                standard_ExecutorStart
                                    InitPlan # 4. 初始化计划
                                        ExecInitNode
                                            ExecInitModifyTable
                                                ExecInitResultRelation
                                                    ExecGetRangeTableRelation # 5. 初始化relation结构体
                                                        table_open
                                                            relation_open
                                                                RelationIdGetRelation
                                                                    RelationBuildDesc
                                                                        ScanPgRelation # 6. 从pg_class系统表中获取表元数据
                                                                            systable_beginscan(pg_class)
                                                                        'read_relation_encryption_policy' # 7. 从vb_secure_class系统表中判断表是否需要加密
                                                                            'systable_beginscan(vb_secure_class)'
                                                                        'read_encryption_policy' # 8. 从vb_encryption_policy系统表中获取加密信息：加密算法等
                                                                            'systable_beginscan(vb_encryption_policy)'
                            ExecutorRun
                                standard_ExecutorRun
                                    ExecutePlan
                                        ExecProcNode
                                            ExecModifyTable
                                                ExecInsert
                                                    table_tuple_insert
                                                        heap_insert(relation) # 9. 调用存储接口，存储数据
                                                            RelationGetBufferForTuple # 10. 读取用于存放数据的Page
                                                                ReadBufferBI
                                                                    ReadBuffer
                                                                        ReadBufferExtended
                                                                            ReadBuffer_common
                                                                                smgread # 11. 情况1：从磁盘读取已有Page
                                                                                    '解密Page：下文介绍'
                                                                BufferGetPage
                                                                if PageIsNew: # 12. 情况2：需要初始化新的Page
                                                                    'if reltaion->encrypt:'
                                                                        'generate_page_tail' # 13. 格式化relation结构体中的加密信息，用于写入Page尾部
                                                                    PageInit # 14. 初始化Page
                                                                        'set_page_tail' # 15. 在Page尾部写入加密信息
                                                                        'page_set_encrypt_flag'  # 16. 在Page头部标记Page需加密
                                                            RelationPutHeapTuple
                                                            MarkBufferDirty
                                                            XLogInsert(XLOG_HEAP_INIT_PAGE) # 17. 生成xlog
                                                                XLogRecordAssemble # 18. 封装xlog
                                                                    if 'XLOG_HEAP_INIT_PAGE' and 'page_set_encrypt_flag':
                                                                        'copy_page_tail_to_wal' # 19. 如果Page是新生成的，且有加密标记，在xlog中携带加密信息
                                                                XLogInsertRecord
    ```

其中，Page的格式设计如下：

![3-page](/images/ProjectDocs/13-design-tde/3-page.png)

由于存在密钥轮转的场景，表中不同的page，可能使用不同轮次的密钥。每个page额外存储一份密钥，虽然占用空间，但是，可以避免密钥轮转时旧密钥被清理，导致无法解密的情况。

-   阶段二：存储数据

    ```python
    BackgroundWriterMain # 1. 启动bgworker进程
        for loop:
            BgBufferSync # 2. 扫描shared buffer
                StrategySyncStart
                SyncOneBuffer # 3. 存储Page
                    FlushBuffer
                        smgrwrite # 4. 将Page写入磁盘
                            if 'page_set_encrypt_flag'
                                'encrypt_page' # 5. 如果Page头部有加密标记，则加密Page
                                    'read_encrypt_info_from_page_tail'
    ```

#### 五、读取数据

```python
PostgresMain # 1. 启动postgres进程
    for loop:
        exec_simple_query('SELECT * FROM t1') # 2. 接收为表设置加密属性的SQL
            pg_parse_query # 3. 语法解析
            PortalRun
            ExecSeqScan
                PortalRunSelect
                    ExecutorRun
                        standard_ExecutorRun
                            ExecutePlan
                                ExecProcNode
                                    ExecScan # 4. 扫描数据
                                        ExecScanFetch
                                            SeqNext
                                                heap_beginscan
                                                heap_getnext
                                                    heapgettup
                                                        heapgetpage # 5. 读取Page
                                                            ReadBufferExtended
                                                                ReadBuffer_common
                                                                    smgread # 6. 从磁盘读取Page
                                                                        'if page_set_encrypt_flag:'
                                                                            'decrypt_page' # 7. 如果Page头部有加密标记，则解密Page
                                                                                'read_encrypt_info_from_page_tail'
```

## 1.3 接口说明

1.  新增密钥管理语法

    ```sql
    CREATE ENCRYPTION KEY $key_name (source = local, password = $password)
    ALTER ENCRYPTION KEY $key_nam ROTATION;
    DROP ENCRYPTION KEY $key_name;
    ```

2.  新增加密策略语法

    ```sql
    CREATE ENCRYPTION POLICY $pollicy_name
        [FOR [TABLE] $table_name [, $table_name ...]]
        KEY $key_name
        [ALGORITHEM {aes_256_ct | aes_256_gcm | aes_256_cbc} ] -- 默认：aes_256_ct
        [MAC ALGORITHM {sha256}] -- 默认：空

    ALTER ENCRYPTION POLICY $pollicy_name
        [ADD [TABLE] $table_name [, $table_name ...]]
        [REMOVE [TABLE] $table_name [, $table_name ...]]
        [ALGORITHEM {aes_256_ct | aes_256_gcm | aes_256_cbc} ]

    DROP ENCRYPTION POLICY $pollicy_name;
    ```

3.  新增系统表vb_encryption_key

    ```sql
    -- 表结构：
    keyoid | keyname | keyinfo
    -------+---------+---------
    ```

4.  新增系统表vb_encryption_policy

    ```sql
    -- 表结构：
    polname  | polkey  | polalgo    | polmacalgo
    ---------+---------+------------+------------
    ```

5.  新增系统表vb_secure_class

    ```sql
    -- 表结构：
    relid | relname | encryption_policy | access_policy
    ------+---------+-------------------+---------------
    ```

## 1.4 内存管理

新增全局内存上下文，用于存放密钥明文等信息，当前版本，密钥只有1个，占用内存空间可忽略。  
加密Page、解密Page时，在Page上原地加密，无需额外的内存。

## 1.5 安全

使用ENCRYPTION KEY、ENCRYPTION POLICY语法时，需特权用户，例如superuser，sysadmin等，三权分立场景，需安全管理员  
ENCRYPTION KEY、ENCRYPTION POLICY语法作为通用DDL审计

## 1.6 性能

只有在存储、读取加密表的Page时，才需加密与解密，与IO相比，加密、解密开销占比低。加密集群中所有用户表，使用aes_256_ctr算法，整体性能劣化低于5%。

## 1.7 专利

本版本无  
未来，加密wal日志，可参考分组密码ctr加密模式的设计原理，让加密wal日志性能劣化极低。

## 1.8 升级管理

新增系统表，新增wal类型，无其他变更

## 1.9 其他说明

无
