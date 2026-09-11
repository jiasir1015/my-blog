+++
title = '数据库安全 3 安全审计'
date = '2025-01-22T14:22:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['审计']
weight = 403
ShowToc = true
TocOpen = true
+++
> **摘要**：从5个方面，介绍openGauss审计特性：背景、原理、使用、设计、实现

# 1 审计的背景

## 1.1 审计的原理

在使用数据库存取数据的大部分场景中，数据库具有以下特点：

1.  对象多：一个数据库集群中有多个database对象，1个database对象中有多个schema对象，1个schema对象中有多个table、index等对象
2.  用户多：一个数据库中，有多个用户，每个用户可访问的数据库对象不同
3.  应用多：多个应用将数据存储在同一数据库集群中，并同时访问数据库集群
4.  操作多：数据库提供丰富的功能，包括DDL、DML、DCL、运维等
5.  运行久：一个数据库集群，可能会保持数十年运行

审计的主要目的，使记录数据运行过程中发生了哪些事件。审计的3要素是：

-   **主体**：一般指数据库用户
-   **客体**：一般指数据库对象，包括：集群、用户、连接、数据对象（database、schema、table、index、function等）
-   **操作**：主体对客体的操作，比如某个用户访问了某个表

## 1.2 审计的目的

审计具有以下重要意义：

1.  攻击检测：通过检查审计日志，可判断是否发生网络安全攻击事件
2.  例行维护：通过检查审计日志，可跟踪对某个对象的访问信息
3.  故障检测：当数据库出现故障是，协助快速定位问题
4.  合法合规：《网络安全法》等法律法规与表中中，要求应用具备审计功能
5.  …

## 1.3 审计的功能

审计功能包含以下3个部分：

1.  设置审计范围：通过数据库配置参数，或者数据库语法，定义哪些对象需要被审计
2.  设置审计存储：通过数据库配置参数，定义审计日志如何存储
3.  生成审计日志：数据库运行过程中，访问某个对象时，记录访问信息
4.  管理审计日志：查询，删除，归档审计日志

## 1.4 oracle审计

oracle审计的发展：  
\- oracle 8i及更早：支持传统审计  
\- oracle 12c：新增支持统一审计  
\- oracle 23ai：不支持传统审计，仅支持统一审计

oracle统一审计的使用：

```sql
-- 1 创建审计策略
CREATE AUDIT POLICY ap1
    PRIVILEGES CREATE TABLE, ALTER USER -- privilege 子句，记录所有使用CreateTable, AlterUser权限的操作
    ACTIONS SELECT,INSERT,UPDATE ON t1 -- aciton 子句，记录所有对表t1执行SELECT,INSERT,UPDATE的操作
    ROLES r1; -- role 子句，记录所有使用r1角色的操作

-- 2 启用审计策略
AUDIT POLICY ap1;

-- 3 查看审计日志
SELECT * FROM UNIFIED_AUDIT_TRAIL;
-- DBA_COMMON_AUDIT_TRAIL, DBA_AUDIT_SESSION, DBA_AUDIT_OBJECT, DBA_FGA_AUDIT_TRAIL
SELECT * FROM DBA_AUDIT_TRAIL;
os_username | username | userhost | terminal | timestamp | owner | obj_name | action | action_name |
------------+----------+----------+----------+-----------+-------+----------+--------+-------------+

| new_owner | new_name | obj_privilege | sys_privilege | admin_option | grantee | audit_option | ses_actions |
+----------+----------+---------------+---------------+--------------+---------+--------------+-------------+

logoff_time | logoff_lread | logoff_pwrite | logoff_dlock | comment_text | sessionid | entryid | statementid | returncode |
+-----------+--------------+---------------+--------------+--------------+-----------+---------+-------------+------------+

| priv_used | client_id | econtext_id | session_cpu | extended_timestamp | proxy_sessionid | global_uid | instance_number |
+-----------+-----------+-------------+-------------+--------------------+-----------------+------------+-----------------+

os_process | transactionid | scn | sql_bind | sql_text | obj_edition_name | dbid | rls_info | current_user |
+----------+---------------+-----+----------+----------+------------------+------+----------+--------------+
```

其中，可设置的权限、操作等范围如下：

```sql
-- 所有的 PRIVILEGES
SELECT NAME FROM SYSTEM_PRIVILEGE_MAP;

-- 所有的 ACTION
        object           |       actions
    ---------------------+--------------------------------------------------------------------------------------------------
    Directory            | AUDIT, GRANT, READ
    Function             | AUDIT, EXECUTE, GRANT
    Java schema objects  | AUDIT, EXECUTE, GRANT
    Library              | EXECUTE, GRANT
    Materialized views   | ALTER, AUDIT, COMMENT, DELETE, INDEX, INSERT, LOCK, SELECT, UPDATE
    Mining Model         | AUDIT, COMMENT, GRANT, RENAME, SELECT
    Object type          | ALTER, AUDIT, GRANT
    Package              | AUDIT, EXECUTE, GRANT
    Procedure, triggers  | AUDIT, EXECUTE, GRANT
    Sequence             | ALTER, AUDIT, GRANT, SELECT
    Table                | ALTER, AUDIT, COMMENT, DELETE, FLASHBACK, GRANT, INDEX, INSERT, LOCK, MERGE, RENAME, SELECT, UPDATE
    Table or view column | ALL, ALTER, AUDIT, COMMENT, DELETE, GRANT, INDEX, INSERT, SELECT, UPDATE
    View                 | AUDIT, COMMENT, DELETE, FLASHBACK, GRANT, INSERT, LOCK, MERGE, RENAME, SELECT, UPDATE

-- 完整的 CREATE AUDIT POLICY 语法
CREATE AUDIT POLICY policy_name
    {     {privilege_audit_clause [action_audit_clause ] [role_audit_clause ]}
        | { action_audit_clause   [role_audit_clause ] }
        | { role_audit_clause }
    }
    [WHEN audit_condition EVALUATE PER {STATEMENT|SESSION|INSTANCE}]
    [ONLY TOPLEVEL]
    [CONTAINER = {CURRENT | ALL}];
```

> -   oracle 23官方文档审计功能: [https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/introduction-to-auditing.html#GUID-94381464-53A3-421B-8F13-BD171C867405](https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/introduction-to-auditing.html#GUID-94381464-53A3-421B-8F13-BD171C867405)  
>     [https://docs.oracle.com/en/database/oracle/oracle-database/23/refrn/UNIFIED_AUDIT_TRAIL.html](https://docs.oracle.com/en/database/oracle/oracle-database/23/refrn/UNIFIED_AUDIT_TRAIL.html)

## 1.5 openGauss审计

opengauss审计的分类：  
按照审计粒度，可将openGauss的审计功能分为以下两类：

-   传统审计：记录对某类客体的操作。在GUC参数中，可设置是否审计某一类对象。
-   统一审计：记录对某个客体的操作。通过SQL语法，定义是否审计某一个客体（表、角色、列）

opengauss传统审计：

opengauss统一审计：

# 3 传统审计

## 3.1 传统审计的用法

### 一、设置审计范围

1.  开启传统审计功能  
    默认情况下，传统审计功能是开启状态

    ```sql
    show audit_enable;
    ```

2.  查看传统审计范围  
    通过以下SQL语句，可查询是否开启对某类对象的审计功能：

    ```sql
    SELECT name,setting FROM pg_settings WHERE name LIKE '%audit%';
    -- 默认输出：
                name             | setting
    -----------------------------+----------
    audit_copy_exec             | 1
    audit_data_format           | binary
    audit_database_process      | 1
    audit_directory             | pg_audit
    audit_dml_state             | 0
    audit_dml_state_select      | 0
    audit_enabled               | on
    audit_file_remain_threshold | 1048576
    audit_file_remain_time      | 90
    audit_function_exec         | 0
    audit_grant_revoke          | 1
    audit_login_logout          | 7
    audit_resource_policy       | on
    audit_rotation_interval     | 1440
    audit_rotation_size         | 10240
    audit_set_parameter         | 0
    audit_space_limit           | 1048576
    audit_system_function_exec  | 0
    audit_system_object         | 67121159
    audit_thread_num            | 1
    audit_user_locked           | 1
    audit_user_violation        | 0
    audit_xid_info              | 0
    full_audit_users            |
    no_audit_client             |
    (25 rows)
    ```

    上述列表中，审计相关配置参数较多，可分为2类：

    -   管理审计日志文件：比如文件目录、生成新文件的条件等
    -   管理审计对象范围：比如是否审计某一类对象

    上述表中，与审计对象类相关的参数，功能如下：

    | 参数名 | 主体 | 客体 | 操作 |
    | --- | --- | --- | --- |
    | audit_login_logout | 用户 | 集群 | 登录、退出 |
    | audit_database_process | 用户 | 集群 | 启动、停止、恢复、切换 |
    | audit_user_locked | 用户 | 用户 | 锁定、解锁 |
    | audit_user_violation | 用户 | 多种对象 | 越权访问 |
    | audit_grant_revoke | 用户 | 用户 | 授权、收权 |
    | full_audit_users | 用户 | 用户 | 各类操作 |
    | no_audit_client | \- | \- | 不审计的客户端名单 |
    | audit_system_object | 用户 | DATABASE / SCHEMA / USER / DATA SOURCE / SQL PATCH | CREATE / ALTER / DROP |
    | audit_dml_state | 用户 | TABLE | INSERT / UPDATE / DELETE |
    | audit_dml_state_select | 用户 | TABLE | SELECT |
    | audit_copy_exec | 用户 | TABLE | COPY |
    | audit_function_exec | 用户 | FUNCTION | EXECUTE |
    | audit_system_function_exec | \- | \- | 不审计的系统函数名单 |
    | audit_set_parameter | 用户 | SET | 各种操作 |
    | audit_xid_info | 用户 | XID | 申请 |

    与审计对象类相关的参数，参数的取值是数字，是一个整数，整数有点抽象，将整数转换为2进制后，上述数字的值如下表：

    | 10进制 | 2进制 |
    | --- | --- |
    | 7 | 111 |
    | 1440 | 10110100000 |
    | 10240 | 10100000000000 |
    | 67121159 | 100000000000011000000000111 |

    参数取值解释为，在一个对象上有很多操作，比如，对与表而言，有INSERT / UPDATE / DELETE等操作，2进制中1个bit代表1种操作，针对不同对象，每个bit代表的操作类型也不同，具体某个参数的某个bit表示什么操作，还得查看参数的具体解释。bit=0，表示不审计该操作，bit=1，表示要审计该操作。

### 二、设置审计存储

设置审计日志存储策略

```sql
SELECT name,setting FROM pg_settings WHERE name IN (
    'audit_directory',
    'audit_resource_policy',
    'audit_space_limit',
    'audit_file_remain_time',
    'audit_file_remain_threshold');
-- 默认结果
            name            | setting
----------------------------+----------
audit_directory             | pg_audit  -- 数据库运行日志的相对路径
audit_file_remain_threshold | 1048576   -- 单位：个文件
audit_file_remain_time      | 90        -- 单位：天
audit_resource_policy       | on
audit_space_limit           | 1048576   -- 单位：M
(5 rows)
```

查看审计日志的存储路径：

```sql
SELECT setting  FROM pg_settings WHERE name in ('data_directory', 'audit_directory');
-- 示例
          setting
-----------------------------
 pg_audit
 /home/shenkun/install/data1
```

查看审计文件：

```bash
cd /home/shenkun/install/data1
ls
# 输出 0_adt  1_adt  2_adt  done  index_table_new
```

其中，`0_adt，1_adt, ..`为审计日志文件，`index_table_new`为审计索引文件，后文介绍文件结构

### 三、生成审计日志

当数据库中某些事件发生时：<主体><操作><客体>，比如发生事件：<用户><登录><集群>，如果audit_login_logout参数取值为1，此时，数据库会自动记录审计日志至审计文件中

### 四、管理审计日志

1.  查询审计日志

    ```sql
    -- 查询某个时间段内的日志
    SELECT pg_query_audit('2024-07-12 08:00:00','2024-07-12 17:00:00');

    -- 查询过去10秒的日志
    SELECT pg_query_audit(NOW() - INTERVAL '10 seconds', NOW());
    ```

    查询结果示例：

    ```sql
    -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
    ("2025-02-11 12:17:12+08",login_failed,failed,24576,u1,postgres,[unknown]@[local],postgres,"login db(postgres)failed,authentication for user(u1)failed, SSL=off",node1,139628213434112@792562632014514,5432,null,2dae83e745323eeb280879f49a81cc9ed930009408681c43dfe12f56d7a33831,t)
    ("2025-01-22 18:31:21+08",login_success,ok,10,shenkun,postgres,gs_clean@127.0.0.1,postgres,"login db(postgres) success,the current user is:shenkun SSL=off",node1,139735762728704@790857081014516,5432,41322,cabcf2afc91702332a0dfad789948020ec9a382efdcb2d13b5f2cea9d826f777,t)
    ```

2.  删除审计日志

    ```sql
    SELECT pg_delete_audit('2024-07-12 08:00:00','2024-07-12 17:00:00');
    ```

## 3.2 传统审计的架构

传统审计的线程架构，可简单分为3个：

-   主线程：即Postmaster线程，负责启动工作线与审计线程
-   工作线程：处理用户的请求，如果处理过程中涉及关键资源，比如关键数据库对象，则生成审计日志
-   审计线程：收集工作线程的审计日志，并将审计日志存储到磁盘

工作线程与应用建立连接后，会进行身份认证，紧接着接收并执行用户的执行请求，在这整个过程中，多个阶段都会产生审计日志。整体架构如下：

![1](/images/Security/4-3-audit/1.png)

传统审计的工作流程如下：

1.  **配置审计参数**：用户通过GUC参数，配置以下功能：
    -   是否开启传统审计功能
    -   审计线程的数据
    -   审计文件的目录、名称、轮换策略等
2.  **读取审计参数**：Postmaster线程，从GUC参数中读取所有与审计相关的参数
3.  **启动审计线程**：Postmaster线程，在接收应用的请求之前，启动多个审计线程
4.  **等待审计日志**：审计线程，启动后，等待工作线程发送审计日志
5.  **处理应用请求**：工作线程，接收用户请求，比如各类SQL语句、运维操作等，处理应用请求
6.  **生成审计日志**：工作线程，处理应用请求后，会根据请求类型、处理结果等生成审计日志
7.  **发送审计日志**：工作线程，工作线程封装审计日志，并通过管道将其发送给审计线程
8.  **接收审计日志**：审计线程，接收工作线程发送的审计日志
9.  **存储审计日志**：审计线程，将审计日志存储至磁盘

## 3.3 传统审计的源码

本章先从功能实现的角度梳理审计日志生成到存储的流程。

### 一、主线程：启动审计线程

```python
PostmasterMain
    # 阶段一、从配置文件中读取所有GUC参数
    InitializeGUCOptions
        # 读取包括audit_enable， audit_thread_num等所有审计相关的GUC参数

    # 阶段二、在接收应用的SQL请求之前，先启动多个审计线程
    if '开启GUC audit_enable'
        pgaudit_start_all # 依次启动多个审计线程
            for '识别GUC audit_thread_num'
                pgaudit_start # 启动1个审计线程
                    initialize_util_thread(AUDITOR)
                        initialize_thread
                            gs_thread_create_ex
                                InternalThreadFunc
                                    GetThreadEntry
                                        GaussdbThreadGate
                                            GaussDbThreadMain(AUDITOR)
                                                PgAuditorMain # 审计线程开始运行
                                                    for ():
                                                        WaitLatchOrSocket
                                                        read(pipe) # 不停通过管道接收 其他线程发送的审计日志
                                                        fwrite # 不停落盘 接收的审计日志

    ServerLoop
        # 阶段三、接收并处理应用发送的SQL语句
```

### 二、工作线程：收集审计事件

上文提到，openGauss会审计多种事件，比如用户登录集群，用户操作数据对象等。在每个事件发生的地方，需记录审计日志，事件相关代码较分散，因此，审计相关的代码也会较分散。审计的代码，没有统一的命名规律，不容易一次性找到全部审计代码。

通过审计事件类型，查找审计代码较方便，审计事件有40种类型。

-   根据审计事件分类：

    ```bash
    # 用户操作集群
    AUDIT_LOGIN_SUCCESS, AUDIT_LOGIN_FAILED, AUDIT_USER_LOGOUT, AUDIT_SYSTEM_START, AUDIT_SYSTEM_STOP, AUDIT_SYSTEM_RECOVER, AUDIT_SYSTEM_SWITCH

    # 用户操作用户
    AUDIT_LOCK_USER, AUDIT_UNLOCK_USER, AUDIT_GRANT_ROLE, UDIT_REVOKE_ROLE, UDIT_USER_VIOLATION

    # 用户操作对象（DDL类）
    AUDIT_DDL_DATABASE, AUDIT_DDL_DIRECTORY, AUDIT_DDL_TABLESPACE, AUDIT_DDL_SCHEMA, AUDIT_DDL_USER, AUDIT_DDL_TABLE, AUDIT_DDL_INDEX, AUDIT_DDL_VIEW
    AUDIT_DDL_TRIGGER, AUDIT_DDL_FUNCTION
    AUDIT_DDL_RESOURCEPOOL, AUDIT_DDL_WORKLOAD, AUDIT_DDL_SERVERFORHADOOP, AUDIT_DDL_DATASOURCE, AUDIT_DDL_NODEGROUP
    AUDIT_DDL_SYNONYM, AUDIT_DDL_TYPE, AUDIT_DDL_TEXTSEARCH，AUDIT_DDL_SEQUENCE, AUDIT_DDL_PACKAGE, AUDIT_DDL_MODEL, AUDIT_DDL_PUBLICATION_SUBSCRIPTION, AUDIT_DDL_FOREIGN_DATA_WRAPPER, AUDIT_DDL_SQL_PATCH, AUDIT_DDL_EVENT
    AUDIT_POLICY_EVENT, MASKING_POLICY_EVENT, AUDIT_DDL_ROWLEVELSECURITY,AUDIT_DDL_KEY

    # 用户操作对象（DML类）
    AUDIT_DML_ACTION, AUDIT_DML_ACTION_SELECT,
    AUDIT_FUNCTION_EXEC, AUDIT_SYSTEM_FUNCTION_EXEC
    AUDIT_COPY_TO, AUDIT_COPY_FROM

    # 审计线程内部事件
    AUDIT_INTERNAL_EVENT

    # 用户配置参数
    AUDIT_SET_PARAMETER, AUDIT_DDL_GLOBALCONFIG

    # 其他
    SECURITY_EVENT
    ```

但是，审计事件类型也很多，按照执行流程，还可继续分为以下3类，其中，DDL和DML类的大部分审计日志收集点比较集中：

-   根据功能分类
    -   DDL类
    -   DML类
    -   集群管理类

在代码中，审计事件较多，梳理工作量大，意义小，因此，此处仅介绍几个经典收集点：

-   用户操作集群（集群管理类）

    ```python
    # 记录 <用户操作集群> 事件的代码有好多处，此处为比较经典的调用栈
    # user: gsql -h {host} -p {port} -d {database} -U {user} -W {password}
    PostgresMain
        InitBackendWorker
            InitSession
                CheckAuthentication
                    PerformAuthentication
                        fn_authenticate
                            ClientAuthentication
                                recv_and_check_password_packet
                                    recv_password_packet
                                    # 首先，进行身份认证
                                    crypt_verify
                                    # 然后，记录身份认证结果
                                    pgaudit_user_login
                                        audit_report('audit type') # 入参为 AUDIT_LOGIN_SUCCESS 或 AUDIT_LOGIN_FAILED
                                            # 该函数内部逻辑后面介绍
    ```

-   用户操作对象（DDL类）

    ```python
    # 记录 <用户操作对象> 事件的代码也很多，此处选择比较经典的调用栈 <用户CREATE TABLE>
    exec_simple_query("CREATE TABLE ... / ...")
        PortalRun
            PortalRunMulti
                PortalRunUtility # 执行 DDL 的主函数
                        ProcessUtility
                            ProcessUtility_hook
                                pgaudit_ProcessUtility
                                    # 首先，进行标准的DDL处理
                                    standard_ProcessUtility
                                    # 然后，在收集DDL类型、DDL执行结果等内容
                                    pgaudit_ddl_table
                                        pgaudit_ddl_database_object('audit type') # 入参为 AUDIT_DDL_TABLE
                                            pgaudit_ddl_database_object
                                                pgaudit_store_auditstat
                                                    audit_report('audit type')
    ```

-   用户操作对象（DML类）

    ```python
    exec_simple_query("INSERT INTO t1 VALUES ... / UPDATE ... / ...")
        PortalRun
            PortalRunMulti
                ProcessQuery # 执行 DML 的主函数
                    # 首先，进行标准的DML执行
                    ExecutorRun
                    ExecutorEnd
                        ExecutorEnd_hook
                            pgaudit_ExecutorEnd
                                # 然后，在执行结束时，收集DML类型、DML执行结果等内容
                                pgaudit_dml_table
                                    pgaudit_store_auditstat('audit type') # 入参为 AUDIT_DML_ACTION
                                        audit_report('audit type')
                                standard_ExecutorEnd
    ```

由此可见，收集日志的线程，通常是各个业务线程。

### 三、工作线程：发送审计日志

上文提到，业务线程收集审计日志后，统一调用audit_report处理，audit_report函数将审计日志发送审计线程，函数执行流程如下：

```python
... # 业务线程 业务代码
    audit_report # 只封装、发送传统审计日志
        # 检查日志内容
        audit_status_check_ok
        audit_type_validcheck
        audit_get_clientinfo
        audit_check_client_blacklist

        # 封装日志内容
        initStringInfo
        appendStringField
        appendStringField
        ...

        # 发送日志内容
        write_pipe_chunks # 通过管道，发送传统审计日志给其他线程
            write(pipe, '审计日志')
        elif .. # 仅记录由审计线程本身产生的审计日志
            pgaudit_write_file
                fwrite('audit file') # 文件目录：GUC参数 audit_directory 的值
                fflush
        elif .. # 不知道干嘛
            pgaudit_write_policy_audit_file
                fwrite('policy audit file') # 文件目录：GUC参数 audit_directory 的值
                fflush
```

### 四、审计线程：接收审计日志

审计线程接收与处理审计日志的逻辑如下：

```python
PgAuditorMain
    for ():
        pgaudit_send_data_to_elastic # 发送日志给 elastic search

        WaitLatchOrSocket # 如果接收到业务线程向管道写数据的行为，则读取审计日志
        read(pipe, '审计日志')

        process_pipe_input
            pgaudit_write_file
                fwrite('audit file')  # 文件目录：GUC参数 audit_directory 的值

        flush_pipe_input
```

## 3.5 传统审计的事件完整列表

```c
auditfile_init
    audit_report(AUDIT_INTERNAL_EVENT, AUDIT_OK)
auditfile_rotate
    audit_report(AUDIT_INTERNAL_EVENT, AUDIT_OK)
pgaudit_cleanup
    audit_report(AUDIT_INTERNAL_EVENT, AUDIT_OK)

plpgsql_exec_error_callback
    audit_report(AUDIT_FUNCTION_EXEC, AUDIT_FAILED)
auditExecPLpgSQLFunction
    audit_report(AUDIT_FUNCTION_EXEC, AUDIT_OK / AUDIT_FAILED)
auditExecAnonymousBlock
    audit_report(AUDIT_FUNCTION_EXEC, AUDIT_OK)
AuditPlpythonFunction
    audit_report(AUDIT_FUNCTION_EXEC, AUDIT_OK / AUDIT_FAILED)
DoCopy
    audit_report(AUDIT_COPY_FROM, AUDIT_OK)
    audit_report(AUDIT_COPY_TO, AUDIT_OK)
inline_function
    audit_report(AUDIT_FUNCTION_EXEC, AUDIT_OK)
pgaudit_system_recovery_ok
    audit_report(AUDIT_SYSTEM_RECOVER, AUDIT_OK)
pgaudit_system_start_ok
    audit_report(AUDIT_SYSTEM_START， AUDIT_OK)
pgaudit_user_login
    audit_report(AUDIT_LOGIN_FAILED, AUDIT_OK / AUDIT_FAILED)
    audit_report(AUDIT_LOGIN_SUCCESS, AUDIT_OK / AUDIT_FAILED)
pgaudit_user_logout
    audit_report(AUDIT_USER_LOGOUT, AUDIT_OK)
pgaudit_system_stop_ok
    audit_report(AUDIT_SYSTEM_STOP, AUDIT_OK)
pgaudit_system_switchover_ok
    audit_report(AUDIT_SYSTEM_SWITCH, AUDIT_OK)
pgaudit_user_no_privileges
    audit_report(AUDIT_USER_VIOLATION, AUDIT_FAILED)
pgaudit_lock_or_unlock_user
    audit_report(AUDIT_LOCK_USER, AUDIT_OK / AUDIT_FAILED)
    audit_report(AUDIT_UNLOCK_USER, AUDIT_OK / AUDIT_FAILED)
pgaudit_process_set_parameter
    audit_report(AUDIT_SET_PARAMETER, AUDIT_OK)
audit_system_function
    audit_report(AUDIT_SYSTEM_FUNCTION_EXEC, AUDIT_OK / AUDIT_FAILED)
auditExecSQLFunction
    audit_report(AUDIT_FUNCTION_EXEC, AUDIT_OK / AUDIT_FAILED)

pgaudit_ddl_database_object(audit_type) // 此处audit_type调用点较多
    pgaudit_store_auditstat
        audit_report(audit_type, AUDIT_OK / AUDIT_FAILED)
```

调用`pgaudit_ddl_database_object`的函数

```c
pgaudit_ddl_table
    pgaudit_ddl_database_object(AUDIT_DDL_TABLE, AUDIT_OK)
pgaudit_ddl_type
    pgaudit_ddl_database_object(AUDIT_DDL_TYPE, AUDIT_OK)
pgaudit_ddl_user
    pgaudit_ddl_database_object(AUDIT_DDL_USER, AUDIT_OK)
pgaudit_ddl_model
    pgaudit_ddl_database_object(AUDIT_DDL_MODEL, AUDIT_OK)
pgaudit_ddl_view
    pgaudit_ddl_database_object(AUDIT_DDL_VIEW, AUDIT_OK)
pgaudit_ddl_event
    pgaudit_ddl_database_object(AUDIT_DDL_EVENT, AUDIT_OK)
pgaudit_ddl_matview
    pgaudit_ddl_database_object(AUDIT_DDL_VIEW, AUDIT_OK)
pgaudit_ddl_database
    pgaudit_ddl_database_object(AUDIT_DDL_DATABASE, AUDIT_OK)
pgaudit_ddl_directory
    pgaudit_ddl_database_object(AUDIT_DDL_DIRECTORY, AUDIT_OK)
pgaudit_ddl_schema
    pgaudit_ddl_database_object(AUDIT_DDL_SCHEMA, AUDIT_OK)
pgaudit_ddl_tablespace
    pgaudit_ddl_database_object(AUDIT_DDL_TABLESPACE, AUDIT_OK)
pgaudit_ddl_index
    pgaudit_ddl_database_object(AUDIT_DDL_INDEX, AUDIT_OK)
pgaudit_ddl_trigger
    pgaudit_ddl_database_object(AUDIT_DDL_TRIGGER, AUDIT_OK)
pgaudit_ddl_sequence
    pgaudit_ddl_database_object(AUDIT_DDL_SEQUENCE, AUDIT_OK)
pgaudit_ddl_function
    pgaudit_ddl_database_object(AUDIT_DDL_FUNCTION, AUDIT_OK)
pgaudit_ddl_package
    pgaudit_ddl_database_object(AUDIT_DDL_PACKAGE, AUDIT_OK)
pgaudit_ddl_resourcepool
    pgaudit_ddl_database_object(AUDIT_DDL_RESOURCEPOOL, AUDIT_OK)
pgaudit_alter_globalconfig
    pgaudit_ddl_database_object(AUDIT_DDL_GLOBALCONFIG, AUDIT_OK)
pgaudit_drop_globalconfig
    pgaudit_ddl_database_object(AUDIT_DDL_GLOBALCONFIG, AUDIT_OK)
pgaudit_ddl_serverforhardoop
    pgaudit_ddl_database_object(AUDIT_DDL_SERVERFORHADOOP, AUDIT_OK)
pgaudit_ddl_weak_password
    pgaudit_ddl_database_object(AUDIT_DDL_TABLE, AUDIT_OK)
pgaudit_ddl_full_encryption_key
    pgaudit_ddl_database_object(AUDIT_DDL_KEY, AUDIT_OK)
pgaudit_ddl_datasource
    pgaudit_ddl_database_object(AUDIT_DDL_DATASOURCE, AUDIT_OK)
pgaudit_ddl_nodegroup
    pgaudit_ddl_database_object(AUDIT_DDL_NODEGROUP, AUDIT_OK)
pgaudit_ddl_rowlevelsecurity
    pgaudit_ddl_database_object(AUDIT_DDL_ROWLEVELSECURITY, AUDIT_OK)
pgaudit_ddl_synonym
    pgaudit_ddl_database_object(AUDIT_DDL_SYNONYM, AUDIT_OK)
pgaudit_ddl_textsearch
    pgaudit_ddl_database_object(AUDIT_DDL_TEXTSEARCH, AUDIT_OK)
pgaudit_ddl_publication_subscription
    pgaudit_ddl_database_object(AUDIT_DDL_PUBLICATION_SUBSCRIPTION, AUDIT_OK)
pgaudit_ddl_fdw
    pgaudit_ddl_database_object(AUDIT_DDL_FOREIGN_DATA_WRAPPER, AUDIT_OK)
pgaudit_ddl_sql_patch
    pgaudit_ddl_database_object(DDL_SQL_PATCH, AUDIT_OK)
pgaudit_process_set_parameter
    pgaudit_ddl_database_object(AUDIT_SET_PARAMETER, AUDIT_OK)
pgaudit_process_drop_objects
    pgaudit_ddl_database_object(xxx, AUDIT_OK)
```

## 3.6 传统审计的日志存储

### 一、审计日志记录格式

-   审计日志格式  
    每条审计日志的标准格式如下：

    ```bash
        # 竖着看
    +-------------------+--------------------+-------------------+
    |                   |                    | char[2] signature |
    |                   |                    | uint16  version   |
    |                   |                    | uint16  fields    |
    |                   |  AuditMsgHdr hdr   | uint16  flags     |
    |                   |                    | pg_time_t time    |
    | AuditData adata   |                    | uint32 size       | # 总长度
    |                   +--------------------+-------------------+
    |                   | AuditType type     |
    |                   | AuditResult result |
    |                   | char varstr        |
    +-------------------+--------------------+
    | char *userid      |
    | char *username    |
    | char *dbname      |
    | char *client_info |
    | char *object_name |
    | char *detail_info |
    | char *nodename    |
    | char *threadid    |
    | char *localport   |
    | char *remoteport  |
    | char *recordsha   |
    +-------------------+
    ```

-   审计日志来源  
    其中，针对不同的审计事件，detail_info的内容也不同：  
    此处，以登录失败场景记录的审计日志为例，介绍如何生成detail_info，以及如何生成其他关键信息：

    ```python
    # 生成审计记录的起点
    recv_and_check_password_packet
        sprintf(details, 'login db({database_name})failed with no password')

        pgaudit_user_login(false, databasename, details)
            sprintf(detail_info, '{details}, SSL=on/off')

            audit_report(AUDIT_LOGIN_FAILED, AUDIT_FAILED, databasename, detail_info) # databasename即object name
                # 获取userid, username, dbname, clientinfo, threadinfo, localport, remoteport等
                # 所有类型的操作，生成的所有日志，都会统一获取这些参数
                # 也就是说是，所有类型的日志，只需调用audit_report传入关键的4条信息即可
                eventinfo = audit_get_clientinfo(AUDIT_LOGIN_FAILED, database)

                # 接下来，将所有元信息封装为一条审计记录即可

                # 最后，将审计记录发送给审计线程
                write_pipe_chunks
    ```

    此处，以登录失败场景记录的审计日志为例，完整的审计日志如下：

    ```sql
    ("2025-02-11 12:17:12+08",login_failed,failed,24576,u1,postgres,[unknown]@[local],postgres,"login db(postgres)failed,authentication for user(u1)failed, SSL=off",node1,139628213434112@792562632014514,5432,null,2dae83e745323eeb280879f49a81cc9ed930009408681c43dfe12f56d7a33831,t)
    ```

### 二、日志文件管理

-   配置审计文件  
    与审计文件相关的GUC参数：

    | 参数 | 含义 | 默认值 |
    | --- | --- | --- |
    | audit_directory | 生成审计文件时，审计文件存放的文件夹 | pg_audit |
    | audit_rotation_interval | 生成新审计文件时，间隔的时间 | 1 day |
    | audit_rotation_size | 生成新审计文件时，旧文件的大小 | 10 MB |
    | audit_resource_policy | 自动删除审计文件时，触发自动删除的策略，达到空间/时间限制时删除 | on (off表示时间) |
    | audit_space_limit | 自动删除审计文件时，空间阈值 | 1GB |
    | audit_file_remain_time | 自动删除审计文件时，时间阈值 | 90 (单位为天) |
    | audit_file_remain_threshold | 生成审计日志文件时，文件最大数量 | 1048576 |

-   审计文件分类  
    在之前的示例中，审计文件分为2种：审计日志文件、审计索引文件

    ```bash
    cd 审计目录 # 可通过 SELECT setting  FROM pg_settings WHERE name in ('data_directory', 'audit_directory'); 查询
    ls # 示例如下：
    0_adt 1_adt 2_adt done index_table_new
    ```

-   审计日志文件生成  
    如果有多个审计线程，每个线程都有独立的审计文件。  
    假设我有5个审计线程，将生成5个审计日志文件：

    ```bash
    0_adt 1_adt 2_adt 3_adt 4_adt done index_table_new
    ```

    审计日志文件名的格式如下，如果有多个审计线程，会同时生成多个审计文件：

    ```c
    "{编号}_adt"
    ```

    审计索引文件只有1个，名称为`index_table_new`，在存在多个审计线程的场景中，该文件中会记录每个审计线程正在写的文件，假设有5个审计线程，开始时，审计索引文件记录的关系是：

    ```bash
    线程1 -> 0_adt
    线程2 -> 1_adt
    线程3 -> 2_adt
    线程4 -> 3_adt
    线程5 -> 4_adt
    ```

    如果审计日志达到轮转条件，会再生成1新的审计文件，假设1_adt文件达到轮转条件，则会生成新的文件`5_adt`，同时，index_table_new中记录的对应关系也将变为：

    ```bash
    线程1 -> 0_adt
    线程2 -> 5_adt
    线程3 -> 2_adt
    线程4 -> 3_adt
    线程5 -> 4_adt
    ```

-   审计索引文件格式  
    审计索引文件的格式如下：

    ```bash
    # 1个AuditIndexTableNew，多个AuditIndexItem
    # 1的AuditIndexItem，记录1个审计文件的基本信息
    +---------------------+
    | AuditIndexTableNew  |
    +---------------------+
    | AuditIndexItem      |
    | AuditIndexItem      |
    | ...                 |
    +---------------------+

    AuditIndexTableNew：
        uint32 maxnum # 审计线程数
        uint32 begidx # 审计线程使用的最小文件编号，上述示例中，是0
        uint32 thread_num
        uint32 latest_idx # 审计线程使用的最大文件编号，上述示例中，是5
        uint32 curidx[MAX_AUDIT_NUM] # 数组长最大为48，上述示例中，是 [0, 5, 2, 3, 4]
        uint32 count
        pg_time_t last_audit_time

    AuditIndexItem # 上述示例中，一共5个审计文件，则有6个AuditIndexItem
        pg_time_t ctime
        uint32 filenum
        uint32 filesize
    ```

    刚开始时，索引文件就非常大。有GUC参数设置审计文件的最大数量，开启审计功能后，便一次性预申请所有的AuditIndexItem的存储空间

# 4 统一审计

## 4.1 统一审计的使用

### 一、设置审计范围

1.  开启资源标签功能  
    首先，查看资源标签功能是否已开启

    ```sql
    show enable_security_policy;
    -- 默认值：off
    ```

    开启资源标签功能

    ```bash
    gs_guc reload -D $GAUSSHOME/data1 -c "enable_security_policy=on"
    ```

2.  创建资源标签

    ```sql
    CREATE TABLE t1 (c1 INT, c2 TEXT);
    CREATE RESOURCE LABEL rl1 ADD TABLE(t1);
    ```

3.  创建审计策略

    ```sql
    CREATE AUDIT POLICY ap1 ACCESS all ON LABEL(rl1);
    ```

### 二、查看审计范围

1.  查看有哪些`AUDIT POLICY`

    ```sql
    SELECT * FROM gs_auditing_policy;
    -- 示例输出：
    polname | polcomments |         modifydate         | polenabled
    --------+-------------+----------------------------+------------
    ap1     |             | 2025-01-22 19:01:57.338895 | t
    ```

2.  查看`AUDIT POLICY`中要审计哪些`RESOURCE LABEL`

    ```sql
    SELECT * FROM gs_auditing_policy_access WHERE labelname = 'rl1';
    -- 示例输出：
    accesstype | labelname | policyoid |         modifydate
    -----------+-----------+-----------+----------------------------
    copy       | rl1       |     16392 | 2025-01-22 19:01:57.343464
    deallocate | rl1       |     16392 | 2025-01-22 19:01:57.3451
    delete     | rl1       |     16392 | 2025-01-22 19:01:57.345217
    execute    | rl1       |     16392 | 2025-01-22 19:01:57.345253
    insert     | rl1       |     16392 | 2025-01-22 19:01:57.345281
    prepare    | rl1       |     16392 | 2025-01-22 19:01:57.345307
    reindex    | rl1       |     16392 | 2025-01-22 19:01:57.345334
    select     | rl1       |     16392 | 2025-01-22 19:01:57.345361
    truncate   | rl1       |     16392 | 2025-01-22 19:01:57.345387
    update     | rl1       |     16392 | 2025-01-22 19:01:57.345414
    ```

3.  查看`RESOURCE LABEL`中有哪些对象

    ```sql
    SELECT * FORM gs_policy_label WHERE labelname = 'rl1';
    -- 示例输出
    labelname | labeltype | fqdnnamespace | fqdnid | relcolumn | fqdntype
    -----------+-----------+---------------+--------+-----------+----------
    rl1       | resource  |          2200 |  16384 |           | table
    rl1       | resource  |          2200 |  16387 |           | table
    ```

### 三、设置审计存储

这一步有点问题，wsl中无法执行成功

```bash
echo 'local0.* /var/log/localmessages' >> /etc/rsyslog.conf
systemctl restart rsyslog
```

### 四、生成审计日志

```sql
INSERT INTO t1 VALUES (1, 'abc');
SELECT * FROM t1;
```

### 五、管理审计日志

由于4.2有问题，无法查看`/var/log/localmessages`中的日志

## 4.2 统计审计的架构

## 4.3 统一审计的源码

### 一、定义审计对象

用户通过固定的DDL语法定义统一审计的对象

```python
# 以下语法的调用栈：
    # CREATE RESOURCE LABEL rl1 ADD TABLE(t1);
        # DDL的处理流程
            standard_ProcessUtility
                CreateResourcePool
                    heap_open('系统表 pg_resource_pool')
                    simple_heap_insert
                    recordDependencyOnRespool

# 以下语法的调用栈：
    # CREATE AUDIT POLICY ap1 ACCESS all ON LABEL(rl1);
        # DDL的处理流程
            standard_ProcessUtility
                create_audit_policy
                    heap_open('系统表 gs_auditing_policy')
                    load_existing_policies # 检查policy是否已存在
                    simple_heap_insert
                    handle_alter_add_update_filter
```

### 二、收集与存储审计日志

由于统一审计只审计特定的对象，只需要在处理SQL语法的流程中，收集审计日志即可，因此，收集点较传统审计少了很多。DDL与DML的处理流程不同，主要收集点有2个：

-   DDL类

    ```python
    # 触发条件：用户执行与特定对象有关的语法
        exec_simple_query
            PortalRun
                PortalRunMulti
                    PortalRunUtility # 执行 DDL 的主函数
                            ProcessUtility
                                ProcessUtility_hook
                                    gsaudit_ProcessUtility_hook
                                        # 第1步，执行DDL前，先生成并暂存审计日志
                                        check_audit_policy_filter
                                        check_access_table # 检查 DDL 是否操作需要记录审计日志的对象
                                            check_audit_policy_access
                                            flush_policy_result
                                                snprintf('审计日志 AUDIT EVENT: ...')
                                                save_access_logs
                                                    Thread.access_logs.push('审计日志 AUDIT EVENT: ...')
                                        # 第2步，执行DDL
                                        standard_ProcessUtility
                                        # 第3步，执行DDL后，将保存的审计日志存至syslog中
                                        flush_access_logs
                                            gs_audit_issue_syslog_message
                                                send_sys_log
                                                    openlog
                                                    syslog(Thread.('审计日志'))
                                                    closelog
                                                gs_elastic_log
    ```

-   DML类

    ```python
    # 触发条件：用户执行与特定对象有关的语法
        exec_simple_query
            PortalRun
                PortalRunMulti
                    ProcessQuery # 执行 DML 的主函数
                        ExecutorStart
                            ExecutorStart_hook
                                gs_audit_executor_start_hook
                                    # 第1步，执行DML前，先生成并暂存审计日志
                                    access_audit_policy_run
                                        check_audit_policy_filter
                                        flush_policy_result
                                            snprintf('审计日志 AUDIT EVENT: ...')
                                        save_access_logs
                                            Thread.access_logs.push('审计日志 AUDIT EVENT: ...')
                                    # 第2步，执行DML
                                    standard_ExecutorStart
                                    # 第3步，执行DML后，将保存的审计日志存至syslog中
                                    flush_access_logs
                                        gs_audit_issue_syslog_message
                                            ...
                                                syslog(Thread.('审计日志'))
    ```

## 4.3 统一审计的日志格式

# 5 重构审计功能

现在：有审计功能，问题多，不好用，性能低

## 5.1

-   配置审计功能：

    ```sql
    SELECT (CASE WHEN alias IS NOT NULL THEN alias ELSE name END) AS adt_guc
    FROM pg_settings WHERE name like '%audit%' or name like 'audit%' GROUP BY adt_guc;
    -- 查询结果：43个
    ```

    -   审计功能

        | 参数 | 功能 |
        | --- | --- |
        | audit_enabled | 是否开启审计功能 |

    -   审计范围
        -   主体

            | 参数 | 功能 |
            | --- | --- |
            | audit_user | 对白名单内的用户进行审计 |
            | full_audit_users | 对白名单内的用户的所有操作进行审计 |
            | no_audit_client | 对黑名单内的IP的用户不审计 |

        -   操作

            | 参数 | 功能 |
            | --- | --- |
            | audit_copy_exec | 是否审计 COPY |
            | audit_dml_state | 是否审计 INSERT、UPDATE、DELETE |
            | audit_dml_state_select | 是否审计 SELECT |
            | audit_set_parameter | 是否审计 SET |

            -   操作结果

                | 参数 | 功能 |
                | --- | --- |
                | audit_user_violation | 是否越权操作 |
                | audit_operation_result | 只记录操作：成功、失败、成功和失败 的日志 |
                | audit_network_error | 是否审计网络连接错误 |
                | audit_query_cancel | 是否审计用户取消SELECT操作 |
                | audit_insufficient_space | 是否记录SPACE：达到限额 |
                | audit_tool_error | 是否审计 vb_dump、vb_dumpall、vb_restore 的异常 |

        -   客体

            | 参数 | 功能 |
            | --- | --- |
            | audit_system_object | 审计OBJECT的范围：DATABASE、SCHEMA、TABLE、…等CREATE、DROP、ALTER操作 |
            | audit_database_process | 是否审计CLUSTER：启动、停止、切换和恢复 |
            | audit_function_exec | 是否审计FUNCTION：执行 |
            | audit_systerm_function_exec | 是否审计FUNCTION：执行（内核写了一个白名单，共61个，例如pg_stat_activity，pg_switch_xlog等） |
            | audit_sequence_enabled | 是否审计语句序列 |
            | audit_crypt_func | 是否审计FUNCION （密码运算函数） |
            | audit_security_policy | 是否审计POLICY |
            | audit_transcation | 是否审计TANSCATITON：提交、回滚 |
            | audit_login_logout | 审计CLUSTER：{登录、注销} x {成功、失败} |
            | audit_user_locked | 是否审计USER：锁定、解锁 |
            | audit_grant_revoke | 是否审计USER：赋权、收权 |

    -   审计线程

        | 参数 | 功能 |
        | --- | --- |
        | audit_thread_num | 写日志的线程数 |
        | audit_buffer_size | 日志缓存大小 |
        | audit_buffer_fflush_interval | 日志缓存刷盘间隔 |

    -   日志格式

        | 参数 | 功能 |
        | --- | --- |
        | audit_data_format | 日志格式，仅支持二进制 |
        | audit_hash_enabled | 日志中是否记录哈希值 |
        | get_acl_for_audit | 是否从系统表中，获取当前操作对象的ACL信息 |
        | audit_xid_info | 日志中是否记录xid |

    -   日志文件

        | 参数 | 功能 |
        | --- | --- |
        | audit_space_limit | 文件总空间 |
        | audit_directory | 文件目录 |
        | audit_dump_directory | 文件复制目录 |
        | audit_backup_directory | 文件备份目录 |
        | audit_file_remain_threshold | 文件数量最大值（问题大） |
        | audit_file_remain_time | 日志保留时间 |
        | audit_rotation_interval | 生成新文件的时间间隔 |
        | audit_stop_policy | 文件大小或时间达到阈值时，删除旧日志，还是停止写新日志 |
        | audit_resource_policy | 文件阈值类型，大小还是时间 |
        | audit_rotation_size | 生成新文件的文件大小阈值 |
        | vb_audit_space_alarm_threshold | 是否对文件大小达到阈值时告警 |
        | get_auditindex_file_lock | 读取索引文件时，不加锁（只是为了测性能时不加锁） |

subtype | operate | objtype | audit | subgroup | opresult | objgroup |  
——–+———+———-+——–+————–+—————–+—————+  
user | create | database | on | all | all | all |  
user | drop | database | on | all | all | all |  
user | create | table | off | user_group_1 | succeed, failed | table_group_1 |  
user | drop | table | off | all | succeed | table_group_1 |

2025/03/28.19:00:00 shenkun create db1 succeed none 10.44.136.83  
2025/03/28.19:00:00 shenkun drop db1 failed permission_deny 10.44.136.83

{user_name,user_oid,user_ip,operate_type,operate_time,operate_result,error_type,object_type}

-   user
    -   user_name
    -   user_ip
-   operate
    -   operate_type: {create, drop, insert, select, connect, execute}
    -   operate_time:
    -   operate_result: succeed, failed
    -   error_type:
-   object
    -   object_type: {cluster, database, table, function}

## 5.1 审计关键问题

1.  功能问题（现有问题，预估在30+）
    1.  审计文件：文件数量存在上限、文件数量受审计线程数影响
    2.  审计线程：线程数量变化影响资源初始化
2.  性能问题
    1.  存储日志慢：前公司测试结果：
        -   不开审计，tpmc 40w
        -   开启审计，日志不加密，tpmc 2-4w
    2.  查询日志慢
3.  易用性问题
    1.  通过GUC配置审计范围、审计日志文件管理

        ```sql
        SELECT count(1) FROM pg_settings WHERE name like '%audit%';
            count
            -------
            60
        ```

    2.  通过int类型配置审计范围

        | 参数 | 功能 | 取值范围 | 默认值 | 取值含义 |
        | --- | --- | --- | --- | --- |
        | audit_system_object | 审计对象范围：DATABASE、SCHEMA、TABLE等 | 0～134217727 | 12295 | 二进制第0位表示是否审计DATABAE、第1位表示SCHEMA、第…、第28位表示EVENT |

        至少10+GUC参数，取值类型为int，取值范围{0, 1}，表示{关闭，开启}
    3.  审计文件命名为：1_adt, 2_adt, 3_adt, ..
    4.  传统审计、统一审计功能重复
4.  代码质量问题
    -   过度封装

        ```c
        static void pgaudit_ddl_table(const char *objectname, const char *cmdtext)
        {
            AuditType audit_type = AUDIT_DDL_TABLE;
            AuditResult audit_result = AUDIT_OK;
            if (!CHECK_AUDIT_DDL(DDL_TABLE)) {
                return;
            }
            pg_audit_ddl_database_object(audit_type, audit_result, objectname, cmdtext);
            return;
        }

        /* pgaudit_ddl_table类函数，实际代码不到4行，共37个
         * 比如：pgaudit_ddl_database、pgaudit_ddl_schema、...
         */
        ```

    -   可维护性

## 5.2 审计问题分析

### 一、功能问题

1.  审计文件
    -   旧版本文件

        ```bash
        index_table_new

        1_adt
        2_adt
        3_adt
        ...
        ```

    -   新版本文件

        ```bash
        adt_desc.meta
            file_size:
            oldest_file:
            newest_file:

        adt_2025-03-25_12-00-13.log # 年 月 日 时 分 秒
        adt_2025-03-25_12-00-13.log
        adt_2025-03-25_12-00-13.log
        ...
        ```

    -   新增参数

        ```bash
        audit_log_directory =
        audit_log_remain_size =
        audit_log_remain_days =

        create group group1 type user
        ```

2.  审计线程：1个线程

### 二、性能问题

1.  线程通信机制：
2.  日志存储机制：
3.  日志哈希机制：
4.  日志加密机制：
5.  文件命名机制：

## 5.3 审计重构方案

audit_group

| group | type | name | oid |
| --- | --- | --- | --- |
| all_user | user | pg_authid.rolname | pg_authid.oid |
| all_table | table | pg_class.relname | pg_class.oid |
| all_database | database |  |  |
| all_index | index |  |  |
| all_function | function |  |  |
| all_column_key | column_key |  |  |

```bash
CREATE AUDIT_GROUP user_gro1 TYPE user MEMBERS a,b,c;

CREATE GROUP all_user TYPE user MEMBERS a,b,c;

CREATE GROUP all_user TYPE user MEMBERS a,b,c;
```

audit_map

| id | subject_type | operate_type | object_type | status | subject_group | object_group |  
| -| -| -| -| -|  
| 1 | login_cluster | user | login | cluster | on | all_user | all |  
| 2 | logout_cluster | user | logout | cluster | off | all_user | all |  
| 3 | start_clust | user | start | cluster | on |  
| 4 | stop_cluster | user | stop | cluster | |

```bash
AUDIT CREATE GROUP user_gro1 TYPE user MEMBERS a,b,c;
AUDIT DROP GROUP user_gro1;
AUDIT SET POLICY login_cluster TO object = all_user, subject = all_table;
```

```sql
SET AUDIT POLICY BY "UPDATE vd_audit_policy SET audit = 1";
```

# 6 PostgreSQL 审计

1.  设置审计参数

    ```sql
    SET logging_collector = on;

    SET log_destination = 'stderr';
    SET log_directory = 'pg_log';
    SET log_filename = 'postgresql-%U-%m-%d_%H%M%S.log';
    SET log_rotation_size = '10MB';
    SET log_rotation_age = '1d';

    SET log_connections = off;
    SET log_disconnections = off;
    SET log_statement = none; -- none, ddl, mod(ddl+insert/delete/update/..), all
    ```

2.  收集审计日志

    ```c
    PostmasterMain
        ServerLoop
            BackendStartup
                BackendInitialize
                    if (Log_connections) /* log_connections */
                        ereport(LOG, errmsg("connection received: host.."))
                BackendRun
                    PostgresMain
                        exec_simple_query
                            pg_parse_query
                            check_log_statement(parsetree):
                                GetCommandLogLevel(parsetree)
                            if () /* log_statement */
                                ereport(LOG, errmsg("statement .."))
    ```

# 参考

-   openGauss审计功能的介绍：[https://docs.opengauss.org/zh/docs/6.0.0/docs/DatabaseAdministrationGuide/%E8%AE%BE%E7%BD%AE%E6%95%B0%E6%8D%AE%E5%BA%93%E5%AE%A1%E8%AE%A1.html](https://docs.opengauss.org/zh/docs/6.0.0/docs/DatabaseAdministrationGuide/%E8%AE%BE%E7%BD%AE%E6%95%B0%E6%8D%AE%E5%BA%93%E5%AE%A1%E8%AE%A1.html)
-   vastbase审计GUC参数： [https://docs.vastdata.com.cn/zh_CN/VastbaseG100/V3.0.8/1/30bab6de005143258e28a0825bc6cb83](https://docs.vastdata.com.cn/zh_CN/VastbaseG100/V3.0.8/1/30bab6de005143258e28a0825bc6cb83)

# 其他

-   一、设置审计备份目录

    ```bash
    gs_guc set -D $GAUSSHOME/data -c "audit_backup_directory='$GAUSSHOME/data/abackup'"
    vrestart
    ```

    ```python
    pgaudit_write_file
        auditfile_close
            file_copy(Audit_backup_directory)

    PgAuditorMain
        audit_buffer_init
        auditfile_init
        for loop:
            if rotate:
                auditfile_rotate
                    auditfile_close
                        file_copy(Audit_backup_directory)
    ```

-   二、审计文件

1.  文件命名：

    ```bash
    # 旧
    1_adt
    2_adt
    3_adt
    ```

    ```bash
    # 新
    file_desc.alog
    audit.id

    adt_2025-03-12_12-00-13.alog
    2025-03-12-12-00-13.alog
    2025-03-12-12-00-13.alog
    ```

2.  文件查询：

3.  日志格式

    ```c
    typedef struct {
        uint64 aln; /* audit log number */
        uint8 al_version;
        uint8 al_flags;
        uint8 al_len;

        uint8 subj_id;
        unit8 op_id;
        uint8 obj_id;

        uint8 op_result;
        uint64 op_time;

        uint64 subj_ip;

        uint64 op_errcode;
    } AdtLogHdr;

    '1122 | 1 0 68 | shenkun create table | succeed 2025.03.13-10:13 | 192.168.0.1 |  -                '
    '1122 | 1 0 68 | user1   create table | failed  2025.03.13-10:13 | 192.168.0.1 | perrmisson denied '

    'shenkun '
    ```

-   三、关键问题

-   功能问题

    -   并发高：日志线程可调整，
    -   数据多
-   性能

    -   问题
        -   存储日志：
            -   线程模型：200+业务线程，1个审计线程（默认1个，最大32个）
            -   通信方式：管道，阻塞（1次管道通信开销、1次IO开销）
        -   加密日志
            -   1条日志生成1条sha256值
            -   1条日志生成
        -   查询日志
    -   优化点
        -   线程通信：自选锁 + 普通堆内存，实现线程通信
        -   异步IO：提交或回滚事务时，检查日志是否落盘
        -   哈希优化：
        -   加密优化：
    -   其他问题
        -   存储完整性
-   代码质量

-   易用性
