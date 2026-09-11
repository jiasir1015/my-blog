+++
title = '海量 5 需求 G100审计'
date = '2025-08-27T15:13:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['审计', '需求文档']
weight = 500
ShowToc = true
TocOpen = true
+++
# 1 简介

## 1.1 目的

审计特性：

-   功能：收集数据库内的关键事件，例如启动集群、创建对象、查询数据等，根据事件生成与存储审计日志，向用户提供审计日志查询接口。
-   必要：从客户角度，使用审计特性，主要目的包括：合法合规、安全监控、事故调查等。从内核角度，为满足信创要求，数据库需达到CC标准，在CC标准中，对审计功能提出多项要求。
-   问题：G100审计特性存在多处设计缺陷，导致功能问题多、性能低、易用性差、可维护性差、可扩展性差等。到目前为止，其中累计识别50+缺陷，仍具有30+未识别缺陷。
-   历史：openGauss早期版本，华为以色列团队开发审计特性，交付标准为基本功能可用，与商用标准差距大。G100早期版本，由openGauss引入审计特性。在之后版本，G100进行多轮迭代。

本需求的目标是重构审计特性，解决功能、性能、易用性、可维护性、可扩展性等问题，使审计特性达到大规模商用的标准。

## 1.2 适用范围

G100 3.0.8 psu5以及之后版本

## 1.3 术语定义、首字母缩写词和缩略语

-   暂无

## 1.3 参考资料

-   原始需求：[https://www.tapd.cn/tapd_fe/60475194/story/detail/1160475194001083526](https://www.tapd.cn/tapd_fe/60475194/story/detail/1160475194001083526)
-   国标查询下载网站： [https://openstd.samr.gov.cn/bzgk/gb/index](https://openstd.samr.gov.cn/bzgk/gb/index)
-   CC标准
    -   《GB/T 20009-2019 信息安全技术 数据库管理系统安全评估准则》
    -   《GB/T 20273-2019 信息安全技术 数据库管理系统安全技术要求》
-   信创标准
    -   《SJ/T 11939-2024 安全可靠 集中式事务型数据库技术要求》
    -   《T/AIA 016—2023信创产品测评 通用要求》
-   等保标准
    -   《GB/T 25070-2019》信息安全技术 网络安全等级保护安全设计技术要求》
-   数据库政府采购标准：[https://jx.mof.gov.cn/xxgk/zhengcefagui/202401/t20240105_3925117.htm](https://jx.mof.gov.cn/xxgk/zhengcefagui/202401/t20240105_3925117.htm)
-   标准原文：微盘：[https://drive.weixin.qq.com/s?k=AHUAfwdSAA87Z01xB](https://drive.weixin.qq.com/s?k=AHUAfwdSAA87Z01xB)
-   G100审计特性：[https://docs.vastdata.com.cn/zh_CN/VastbaseG100/V3.0.8/1/2f4fb0e4adcc49f8b19dd4710f2a6549](https://docs.vastdata.com.cn/zh_CN/VastbaseG100/V3.0.8/1/2f4fb0e4adcc49f8b19dd4710f2a6549)
-   G100审计历史客户需求：[https://www.tapd.cn/tapd_fe/60475194/story/list?sort_name=created&order=&useScene=storyList&groupType=&conf_id=1160475194001046742&queryToken=fe85cdfc29d23bba423905c15d72d127&page=1](https://www.tapd.cn/tapd_fe/60475194/story/list?sort_name=created&order=&useScene=storyList&groupType=&conf_id=1160475194001046742&queryToken=fe85cdfc29d23bba423905c15d72d127&page=1)
-   Oracle审计特性：[https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/part_6.html](https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/part_6.html)
-   开源组件pgaudit：[https://www.modb.pro/db/105894](https://www.modb.pro/db/105894)
-   需求分析与整理文档：语雀：[https://www.yuque.com/u57264336/oav5h4/tkhcgdilcbpuqm09](https://www.yuque.com/u57264336/oav5h4/tkhcgdilcbpuqm09)

# 2 G100审计功能重构

## 2.1 功能简述

### 一、需求背景：审计特性

-   审计目的：记录数据库内的各种事件，事件包括：
    -   启动、恢复、切换、停止集群
    -   登录、注销账号
    -   创建、修改、删除数据库对象，包括：DATABASE、SCHEMA、TABLE等
    -   插入、更新、删除、查询关系表
    -   …
-   描述事件：每个事件中，有3个关键要素：<主体><操作><客体>
    -   主体：一般是数据库用户
    -   客体：集群、账号、DATABASE、SCHEMA、TABLE、FUNCTION等
    -   操作：不同的客体，涉及的操作不一样。比如，对于TABLE，操作有：CREATE, INSERT, SELECT等。
-   审计日志：针对每个事件，收集与主体、操作、客体有关的信息，封装为1条审计日志。通常，1条审计日志中，包括的信息如下：
    -   主体相关：用户名、客户端IP、会话ID等
    -   操作相关：操作的类型、操作的时间、触发操作的SQL语句等
    -   客体相关：客体类型、客体名称、客体属于哪个database、客体属于哪个schema
-   审计特性：为实现审计功能，在数据库内核中，需实现以下功能：
    -   配置范围：对用户提供接口，配置需审计的事件范围
    -   收集事件：在内核关键代码节点，发现事件，例如：登录用户、创建对象、查询数据等，收集主体、操作、客体相关信息
    -   生成日志：按统一格式组织事件信息，生成审计日志
    -   存储日志：将审计日志存储至磁盘
    -   查询日志：对用户提供接口，查询日志

### 二、需求背景：G100审计特性（旧版本）

G100早期版本，引入openGauss审计特性，但是，该特性存在较多问题，包括：

-   功能问题多：已识别50+缺陷，未识别30+缺陷，其中，文件管理，并发管理问题较多
-   性能低：开启审计功能，启动单个审计线程，tpcc劣化90%以上
-   易用性差：审计功能分为传统审计、统一审计子功能，二者大部分功能重复，但大部分设计与代码独立。例如，传统审计通过30+GUC参数设置审计范围。统一审计通过SQL语法设置审计范围。
-   可维护性差：缺少模块化设计。代码多，代码分散，代码易读性差，部分功能设计较复杂
-   可扩展性差：新增审计事件，适配麻烦

此处，详细介绍传统审计、统一审计的差异：

-   传统审计
    -   配置审计功能：可配置：日志存储目录、日志文件轮转策略等
    -   设置审计范围：审计范围控制粒度粗。通过GUC参数控制是否审计某类事件

        ```bash
        # 示例，是否审计所有SELECT语法。
        vb_guc set -D $VBDATA -c "audit_dml_state_select=on"
        ```

        配置参数如下：
        -   按操作类型、客体类型（14个）

            | 参数 | 功能 |
            | --- | --- |
            | audit_copy_exec | 是否审计 COPY |
            | audit_dml_state | 是否审计 INSERT、UPDATE、DELETE |
            | audit_dml_state_select | 是否审计 SELECT |
            | audit_set_parameter | 是否审计 SET |
            | audit_system_object | 审计OBJECT的范围：DATABASE、SCHEMA、TABLE、…等CREATE、DROP、ALTER操作 |
            | audit_database_process | 是否审计CLUSTER：启动、停止、切换和恢复 |
            | audit_function_exec | 是否审计FUNCTION：执行 |
            | audit_systerm_function_exec | 是否审计FUNCTION：执行（内核写了一个白名单，共61个，例如pg_stat_activity，pg_switch_xlog等） |
            | audit_crypt_func | 是否审计FUNCION （密码运算函数） |
            | audit_security_policy | 是否审计POLICY |
            | audit_transcation | 是否审计TANSCATITON：提交、回滚 |
            | audit_login_logout | 审计CLUSTER：{登录、注销} x {成功、失败} |
            | audit_user_locked | 是否审计USER：锁定、解锁 |
            | audit_grant_revoke | 是否审计USER：赋权、收权 |

        -   按主体信息（3个）

            | 参数 | 功能 |
            | --- | --- |
            | audit_user | 对白名单内的用户进行审计 |
            | full_audit_users | 对白名单内的用户的所有操作进行审计 |
            | no_audit_client | 对黑名单内的IP的用户不审计 |

        -   按操作结果（1个）

            | 参数 | 功能 |
            | --- | --- |
            | audit_operation_result | 只记录操作：成功、失败、成功和失败 的日志 |

        -   其他（6个）

            | 参数 | 功能 |
            | --- | --- |
            | audit_user_violation | 是否越权操作 |
            | audit_network_error | 是否审计网络连接错误 |
            | audit_query_cancel | 是否审计用户取消SELECT操作 |
            | audit_insufficient_space | 是否记录SPACE：达到限额 |
            | audit_tool_error | 是否审计 vb_dump、vb_dumpall、vb_restore 的异常 |
            | audit_sequence_enabled | 是否审计语句序列 |

    -   传输审计日志：工作线程生成日志，通过管道，传输日志给审计线程，审计线程存储日志
    -   存储审计日志：将日志组织写入审计文件，审计文件存放在独立的审计目录
-   统一审计：
    -   配置审计功能：无法配置：日志存储目录、日志文件轮转策略等
    -   设置审计范围：通过SQL语法，控制是否审计指定的操作、对象、用户等，审计范围控制粒度细。例如，是否审计用户对表t1的SELECT操作，并过滤用户u1。

        ```sql
        CREATE RESOURCE LABEL rl1 ADD TABLE(t1);
        CREATE AUDIT POLICY ap1 ACCESS select ON LABEL(rl1) FILTER ON roles(u1);
        ```

    -   传输审计日志：工作线程生成日志，直接存储，无审计线程
    -   存储审计日志：工作线程将日志写到syslog  
        （照着Oracle抄，但根本没抄明白）

### 三、需求背景：Oracle审计特性

Oracle审计特性迭代如下：

-   8i以及更早版本：支持传统审计
-   12版本（2013年），新增支持统一审计，建议放弃传统审计，使用统一审计
-   23ai版本（2024年），不再支持传统审计，使用统一审计替代

使用统一审计替代传统审计的思路：

-   传统审计：

    ```bash
    # 示例，是否审计所有SELECT语法。
    vb_guc set -D $VBDATA -c "audit_dml_state_select=on"
    ```

-   统一审计：

    ```sql
    CREATE AUDIT POLICY ap1 ACCESS select; -- 后面不加其他 [用户、表名] 等过滤条件：
    ```

Oracle统一审计语法如下：

```sql
CREATE AUDIT POLICY ap1
    PRIVILEGES privilege [ , privilege ..] -- privilege 子句，内置权限有200多种，示例：CREATE TABLE(可能是其他SQL，但使用到该权限), ALTER USER
    ACTIONS action [ , action ..]          -- aciton 子句，示例：CREATE TABLE, SELECT,ALTER,DROP 。操作+对象组合，共有1900+
        ON object [ , object ..]           -- object 子句
    ROLES role [ , role ..]                -- role 子句
    .. [其他不关键的子句]
```

### 四、需求范围：G100审计特性（新版本）

-   重构目标：新版本审计特性，解决功能、性能、易用性、可维护性、可扩展性等问题，使审计特性达到大规模商用的标准。
-   重构工作：与旧版本相比，90%代码完全重写，采用全新的接口、系统表、架构、文件格式等。同时，将删除部分无用的功能。
-   重构参考：保留的功能，主要参考以下标准。其中，对于一些标准中提及，优先级不高，但实现复杂的功能，本版本只完成设计，由以后版本实现。
    -   CC标准
    -   信创标准
    -   等保标准
    -   政府采购标准
    -   Oracle审计特性
    -   G100审计历史客户需求
-   重构设计：重构后，审计特性的几个关键设计如下：

1.  配置审计：通过GUC参数，配置审计参数：日志目录、目录大小、日志文件淘汰策略等
2.  设置范围：通过SQL语法，设置审计策略，控制哪些事件需审计。可创建1条或多条审计策略，在策略中，可按用户、操作、对象、操作结果、客户端IP等过滤事件。
3.  收集事件：在代码关键节点，收集事件
4.  生成日志：提取事件关键信息，生成日志
5.  传输日志：工作线程，通过共享内存，传输日志给审计线程
6.  存储日志：审计线程，以Page为粒度，组织日志，并存储至文件中。文件存放在单独的日志目录。
7.  查询日志：通过内置FUNCTION，在线查询日志，通过TOOL，离线查询日志。

上述设计中，除实现基本功能外，为满足标准和部分客户的要求，需支持的相关功能如下：

| 编号 | 流程 | 来源 | 描述 | 支持 |
| --- | --- | --- | --- | --- |
| 1 | 1.配置审计 | - | - | - |
| 2 | 2.设置范围 | CC 选择性审计 | 按需审计：用户、主机、操作类型、权限级别（系统、数据库、对象、细粒度权限等）、操作结果 | 支持：权限即对象类型 |
| 3 | 3.收集事件 | CC 审计数据生成 | 事件类型：开启、关闭审计，启动、停止实例，修改GUC，修改对象结构，检查权限失败等 | 支持 |
| 6 | 3.收集事件 | 客户需求：红线要求 | 强制审计：未开启审计，记录启动、停止实例、修改GUC、创建、删除用户 | 支持 |
| 7 | 3.收集事件 | 客户需求 | 敏感事件：修改密码失败、拒绝会话 | 支持 |
| 8 | 3.收集事件 | 客户需求 | 序列审计：1个会话多个操作组成1个日志 | 暂不支持 |
| 4 | 4.生成日志 | CC 审计数据生成 | 日志内容：事件类型、时间、用户、对象、客户端、操作结果 | 支持 |
| 5 | 4.生成日志 | CC 用户身份关联 | 日志内容：数据库会话 | 支持 |
| 9 | 5.传输日志 | 客户需求：性能要求 | 审计性能：性能不能太低 | 支持 |
| 10 | 6.存储日志 | CC 审计事件存储 | 功能失效：存储空间耗尽、失败、受攻击等，功能不失效，措施：忽略新日志、覆盖旧日志 | 支持 |
| 11 | 6.存储日志 | CC 审计事件存储 | 日志防丢：支持审计数据批量传输到另一个系统 | 暂不支持：需对接es |
| 12 | 6.存储日志 | 客户需求 | 日志保护：加密、校验 | 暂不支持 |
| 13 | 6.存储日志 | 客户需求 | 日志转存：转存（即归档）日志 | 暂不支持：疑似想要日志防丢 |
| 14 | 6.存储日志 | 客户需求：网专测试 | 日志保留：日志强制保留180天 | 支持 |
| 15 | 6.存储日志 | 客户需求 | 日志同步：日志同时存储至/var/log/message或/var/log/syslog | 暂不支持 |
| 16 | 6.存储日志 | 内部识别 | 日志脱敏：不记录password等敏感信息 | 支持 |
| 17 | 6.存储日志 | 内部识别 | 同步落盘：提交事务时，等待事务产生的日志落盘（默认异步落盘） | 支持 |
| 18 | 7.查询日志 | CC 审计查阅 | 查询权限：授权用户 | 支持 |
| 19 | 7.查询日志 | CC 审计查阅 | 查询权限：三权分立，防止系统管理员干扰审计日志 | 暂不支持：三权分立设计乱 |
| 20 | 7.查询日志 | CC 审计查阅 | 查询方式：按条件过滤，如时间、用户等，可排序、搜索、筛选 | 支持 |
| 21 | 7.查询日志 | 内部识别 | 日志展示：支持图形化界面vem | 支持 |
| 22 | 7.查询日志 | 内部识别 | 存储视图：查看日志存储空间占比 | 支持 |

部分客户需求如下：

-   日志转存需求：[https://www.tapd.cn/tapd_fe/60475194/story/detail/1160475194001025838](https://www.tapd.cn/tapd_fe/60475194/story/detail/1160475194001025838)

## 2.2 功能说明

### 2.2.1 使用流程

#### 最简场景

从用户角度，执行以下步骤，可快速了解什么是审计。

1.  配置审计

    ```bash
    vb_guc set -D $VBDATA -c "enable_audit=on"
    # 开启审计功能，需重启集群使配置生效
    ```

2.  设置范围

    ```sql
    CREATE AUDIT POLICY ap1
        OPERATE CREATE,DROP; -- 审计所有操作为：CREATE、DROP的事件
    ```

3.  收集事件、生成日志、传输日志、存储日志

    ```sql
    CREATE TABLE t1(c1 INT);
    -- 内核自动识别事件，生成与存储日志
    ```

4.  查询日志

    ```sql
    SELECT * FROM vb_audit_log;
    optime                         | .. | subjname | optype | objtype | objname | ..
    -------------------------------+----+----------+--------+---------+---------+-----
    2025-09-21 12:00:01.400009+08  | .. | shenkun  | create | table   | t1      | ..
    ```

5.  其他操作  
    用户基于审计日志，实现合法合规、安全监控、事故调查等。

#### 场景一、配置审计

功能：通过GUC参数，配置审计参数：日志目录、目录大小、日志文件淘汰策略等。

本需求新增以下6个GUC参数：

| 编号 | 参数名 | 默认值 | 取值范围 | 级别 | 功能 |
| --- | --- | --- | --- | --- | --- |
| 1 | enable_audit | off | on,off | postmaster | 是否开启审计功能 |
| 2 | audit_directory | pg_audit | 绝对路径、相对路径 | postmaster | 审计日志存储目录。如果取值为空，则默认存储于’数据目录/pg_audit’下 |
| 3 | audit_directory_size | 128M | [64M,-] | postmaster | 审计日志目录最大空间 |
| 4 | audit_directory_full_policy | overwrite | overwrite,stopwrite | postmaster | 目录达到最大空间，采取策略：覆盖最旧文件、忽略新日志 |
| 5 | audit_buffer_size | 16M | [1M，1024M] | postmaster | 内存中，审计线程接收工作线程日志时，审计日志缓冲区大小 |
| 6 | audit_flush_policy | asnyc | sync,asnyc | postmaster | 事务提交时，是否等待事务产生的日志落盘 |
| 7 | audit_thread_num (待评估) | 1 | [1, 5] | postmaster | 审计写线程的数量，每个审计写线程，单独写审计文件。取值大于1时，需启动1个异步归并线程 |

1.  开启审计功能

    ```bash
    vb_guc set -D $VBDATA -c "enable_audit=on"
    # 重启生效
    ```

2.  配置审计目录  
    默认存储于数据目录下pg_audit目录，可配置为其他目录

    ```bash
    # 1. 创建目录，假设新目录为 $new_dir

    # 2. 设置目录（以'/'开头，为绝对路径。不以'/'开头，为相对路径，相对于data_directory）
    vb_guc set -D $VBDATA -c "audit_directory='$new_dir'"

    # 3. 重启生效
    # 4. 查看目录
    ll $new_dir
        # 预期结果：有日志文件产生
    ```

3.  重启数据库  
    让GUC生效
4.  配置其他GUC参数  
    audit_directory_size、audit_directory_full_policy、audit_buffer_size、audit_flush_policy、audit_thread_num等，在后续场景详细介绍。

#### 场景二、设置范围

功能：通过SQL语法，设置审计策略，控制哪些事件需审计

1.  了解审计策略语法

    ```sql
    CREATE AUDIT POLICY policy_name
        -- [ROLE   {all | role_lsit}]       -- 1.按角色过滤（暂不支持）
        [USER    { all | user_list }]       -- 2.按用户过滤
        [OPERATE { all | operate_list }]    -- 3.按操作过滤
        [ON      { all | object_list }]     -- 4.按对象过滤
        [IN      { all | in_object_list }]  -- 4.按对象过滤：例如：IN DATABASE db1，表示db1中所有对象
        [CLIENT  { all | client_ip_or_host_list }]  -- 5.按客户端过滤
        [RESULT  { all | { succeed | failed }}]     -- 6.按操作结果过滤
    ```

2.  创建审计策略：按用户过滤

    ```sql
    -- 针对单个用户
    CREATE AUDIT POLICY ap1
        USERS u1;

    -- 针对多个用户
    CREATE AUDIT POLICY ap2
        USERS u1,u2,u3;

    -- 针对所有用户（使用保留关键字ALL）
    CREATE AUDIT POLICY ap3
        USERS all; -- 表示对所有操作都审计

    -- 未主动指定的过滤条件，默认为all，即 OPERATE 默认为 all
    ```

3.  创建审计策略：按操作过滤

    ```sql
    -- 针对操作
    CREATE AUDIT POLICY ap1
        OPERATE CREATE,DROP;

    -- 针对操作大类
    CREATE AUDIT POLICY ap1
        OPERATE ddl,dcl,dml,INSERT,SELECT;

    -- 查看可选操作（此处列出44种，来自E100，G100的待补充）
    SELECT * FROM pg_audit_operate;
        opscope | operates
        --------+--------------------------------------------------------------------------
        dml     | insert select update delete
        func    | execute
        ddl     | create alter drop import refresh lock declare close prepare deallocate listen unlisten notify comment load
        mng     | truncate copy cluster reindex vacuum analzye explain checkpoint discard
        tcl     | begin commit rollback release
        misc    | fetch move
    ```

4.  创建审计策略：按对象过滤

    ```sql
    -- 按 DATABASE 过滤
    CREATE AUDIT POLICY ap2
        ON DATABASE db1,db2;

    -- 按 SCHEMA 过滤，替换 ON 子句为：
        ON SCHEMA s1,s2
    -- 按 TABLE 过滤，替换 ON 子句为：
        ON db1.public.t1
        -- 或者：
        ON t1     -- t1为当前database下，当前schema下的t1

    -- 按 DATABASE 过滤
        IN DATABASE db1,db2;
    -- 按 SCHEMA 过滤
        IN SCHEMA s1,s2

    SELECT * FROM vb_audit_object;
        objid | objtype    | objfilter
        ------+------------+----------
        1     | database   | on,in
        2     | schema     | on,in
        3     | tablespace | on,in
        4     | user       | on
        5     | role       |        -- 该列为空，表示不支持过滤
        6     | group      |
        7     | table      | on
        11    | view       | on
        8     | index      | on
        9     | function   | on
        10    | sequence   |
        10    | matview    |
        12    | trigger    |
        ...   | ..         |
        56    | extension  |

        -- 完整的客体类型（此处列出56种，来自E100，G100的待补充）
            database schema tablespace
            user role group
            -- relation
            table index sequence view matview
            -- function
            function procedure trigger routine event_trigger constraint aggregate
            -- transcation
            transcation savepoint
            -- security
            policy security_lable
            -- others
            query plan
            fdw foreign_server foreign_table foreign_schema user_mapping
            publication subscription
            access_method operator operator_class operator_family
            domain type language largeobject collation conversion cast rule transform channel stats plang
            cursor portal
            ts_dic ts_coonfig ts_parser ts_template
            extension
    ```

5.  创建审计策略：客户端过滤

    ```sql
    CREATE AUDIT POLICY ap4
        CLIENT '192.168.0.10','192.168.0.11','host_1';
    ```

6.  创建审计策略：按操作结果过滤

    ```sql
    CREATE AUDIT POLICY ap5
        RESULT succeed,failed;
    ```

7.  创建审计策略：组合过滤  
    上述过滤条件，可2种或多种随意组合

    ```sql
    CREATE AUDIT POLICY ap5
        USERS u1,u2
        OPERATE INSERT,UPDATE
        ON t1,t2
        CLIENT '192.168.0.10'
        RESULT succeed,failed;
    ```

8.  查看审计策略

    ```sql
    -- 查看系统表
    SELECT * FROM vb_adt_policy;
    -- 示例输出
        polname | polsubjname | poloptype | polopres | polobjtype | polobjname | polcliip | status
        --------+-------------+-----------+----------+------------+------------+----------+---------
         ap1    |             | 1,2       | 0        | 0          |            |          | enable

    /* 解释
        polname: 策略名
        polsubjname: 用户名
        poloptype：操作类型
        polopres: 操作结果
        polobjtype: 客体类型
        polobjname：客体名称
        polcliip：客户端类型
        status: 策略是否启用
     */

    -- 查看视图
    SELECT * FROM pg_audit_policy;
        policy | users  | actions     | objtype | objects  | result  | status
        -------+--------+-------------+---------+----------+---------+--------
        ap1    |        | create,drop | table   | t1,t2    |         | enable
    ```

9.  修改审计策略

    ```sql
    CREATE AUDIT POLICY ap_old
        USERS u1,u2
        OPERATE INSERT,UPDATE
        ON t1,t2;

    ALTER AUDIT POLICY ap_old
        USERS all -- 已有过滤类型：可设置为all
        OPERATE INSERT -- 已有过滤类型：可修改范围
        CLIENT '192.168.0.10'; -- 新增过滤额类型

    -- 已有过滤类型：如果未主动指定，则保持原样，例如 ON t1,t2 保持原样
    ```

10.  停止审计策略

     ```sql
     ALTER AUDIT POLICY ap1 DISABLE;
     ```

11.  启用审计策略

     ```sql
     ALTER AUDIT POLICY ap1 ENABLE;
     ```

12.  删除审计策略  
     一次DROP一个或多个，可设置IF EXISTS参数。

     ```sql
     DROP AUDIT POLICY IF EXISTS ap1,ap2,ap3;
     ```

#### 场景三、收集事件

功能：在代码关键节点，收集事件。此处，需了解什么场景会产生事件。

1.  熟悉事件类型
    -   系统事件  
        系统事件，属于强制审计事件，即使不开启审计时，也会生成审计日志。

        | 编号 | 主体 | 操作 | 客体 | 事件线程 | 收集阶段 | 触发示例 |
        | --- | --- | --- | --- | --- | --- | --- |
        | 1 | 用户 | 启动 | 集群 | postmaster | 线程启动 | vb_ctl start .. |
        | 2 | 用户 | 停止 | 集群 | postmaster | 线程退出 | vb_ctl stop .. |
        | 3 | 用户 | 登录 | 集群 | postgres | 身份认证 | vsql -d database .. |
        | 4 | 用户 | 登出 | 集群 | postgres | 线程退出 | \\q 或 超时等 |
        | 5 | 用户 | 修改 | 配置 | postgres | SQL执行 | alter system set .. |

    -   安全事件  
        安全事件，也属于强制审计事件。大部分由用户执行SQL产生：

        ```sql
        CREATE USER
        ALTER USER
        DROP USER
        GRANT
        REVOKE
        CREATE ROLE
        ALTER ROLE
        DROP ROLE
        ...
        ```

    -   SQL事件  
        由用户执行SQL产生的事件（不包括用户、权限相关的事件，此类事件单独归到安全事件中）。一个事件可描述为：主体、操作、客体。
        -   主体：通常为用户名
        -   操作：操作类型如下：

            ```sql
            -- 参考以下SQL执行结果
            SELECT * FROM vb_audit_operate;
            ```

        -   客体：客体类型如下：

            ```sql
            -- 参考以下SQL执行结果
            SELECT * FROM vb_audit_object;
            ```

2.  熟悉SQL与事件的对应关系（对象级审计）  
    大部分情况下，执行1条SQL，产生1个事件。也有一些情况，执行1条SQL，多个1个事件。

    ```sql
    CREATE TABLE t1(c1 INT);
    -- 操作：create，客体类型：table，客体：t1

    INSERT INTO t1 VALUES(3);
    -- 操作：insert，客体类型：table，客体：t1

    CREATE TABLE t2 AS SELECT * FROM t1;
    -- 操作：create，客体类型：table，客体：t2
    -- 操作：select，客体类型：table，客体：t1

    SELECT * FROM t1 JOIN t2 ON t1.c1 = t2.c1;
    -- 操作：select，客体类型：table，客体：t1
    -- 操作：select，客体类型：table，客体：t2
    ```

#### 场景四、生成日志

功能：提取事件关键信息，生成日志。

1.  查看日志字段

    ```sql
    CREATE TABLE t2 AS SELECT * FROM t1;

    SELECT * FROM vb_audit_log;
    -- 示例输出（共2行）
        ------------+-------------[record 1]
        optime      | 2025-09-21 12:00:01.400009+08 -- 操作时间
        apolicy     | ap1          -- 策略名称：生成本条日志的策略
        scope       | ddl          -- 操作分类：例如ddl,dml,dql等
        subjname    | shenkun      -- 操作用户
        optype      | create       -- 操作类型
        objtype     | table        -- 客体类型
        objname     | t2           -- 客体名称
        cliip       | 10.44.136.83     -- 客户端IP或HOST
        cliport     | 39850            -- 客户端端口
        cliapp      | vsql             -- 客户端类型：即连接参数applicatiion_name
        opresult    | succeed          -- 操作结果：成功或失败
        objdb       | vastbase         -- 客体所属database
        objnsp      | public           -- 客体所属schema
        opxid       | 0                -- 操作的xlog id
        optid       | 0                -- 操作的事务id
        opthreadid  | 489              -- 操作的线程id
        opsessid    | 1986             -- 操作的会话id
        sql         | CREATE TABLE t2 AS SELECT * FROM t1; -- 原始SQL语句
        extra       |                                      -- 其他信息：例如报错信息
        ------------+-------------[record 2]
        optime      | 2025-09-21 12:00:01.639529+08
        apolicy     | ap2
        scope       | dml
        subjname    | shenkun
        optype      | select
        objtype     | table
        objname     | t1
        cliip       | 10.44.136.83
        cliport     | 39850
        cliapp      | vsql
        opresult    | succeed
        objdb       | vastbase
        objnsp      | public
        opxid       | 0
        optid       | 0
        opthreadid  | 489
        opsessid    | 1986
        sql         | (repeat)
        extra       |
    ```

#### 场景五、传输日志

功能：工作线程，通过共享内存，传输日志给审计线程。可通过GUC参数，控制与传输相关的参数。

1.  设置日志缓冲区大小  
    参考机器配置，参考wal_buffer大小设置

    ```bash
    vb_guc set -D $VBDATA -c "audit_buffer_size=16" # 单位为M
    # 预期结果：即使400+工作线程产生日志，audit_buffer_size仅16M，也能正常工作
    ```

2.  设置审计线程数

    ```sql
    vb_guc set -D $VBDATA -c "audit_thread_num=2";
    ```

3.  重启数据库，并生成一些日志
4.  查看审计缓冲区统计信息  
    为提高可维护性，本需求参考xlog，新增1个视图，用于查询审计日志缓存区的信息。

    ```sql
    SELECT * FROM pg_audit_buffer_stat();
    -- 示例输出
        bufid   | buffiled    | value
        --------+-------------+-------------------------------------------------
        0       | writer_tid  | 6891 -- 负责将buffer数据写到磁盘的审计写线程的id
        0       | total_size  | 128M -- buffer总大小
        0       | dirty_size  | 3.1M -- buffer中待写入的大小
        0       | alloc_pos   | 19888998 -- 从启动开始算，buffer已接收的日志总长度
        0       | write_pos   | 19887004 -- 从启动开始算，buffer已落盘的日志总长度
        0       | write_file  | adt_2025_0922_120001_124581_writing_0.blog -- 存储buffer数据的文件
        1       | writer_tid  | 6892
        1       | total_size  | 128M
        1       | dirty_size  | 9.8M
        1       | alloc_pos   | 20016510
        1       | write_pos   | 20064020
        1       | write_file  | adt_2025_0922_120001_124581_writing_1.blog
    ```

#### 场景六：存储日志

1.  查看审计目录

    ```sql
    show audit_directory;
    ```

2.  查看审计文件

    ```sql
    ll $audit_directory
    -- 示例输出（4类文件）：
        adt_2025_0922_120401_424581_writing_1.blog  # 状态1：正在写
        adt_2025_0922_120401_424581_writing_2.blog

        adt_2025_0922_120201_139900_unmerged_1.blog # 状态2：已写完，待归并
        adt_2025_0922_120201_139900_unmerged_2.blog

        adt_2025_0922_120201_139900_merging.blog    # 临时文件：归并中产生的

        adt_2025_0922_120001_980431.blog            # 状态3：已归并
    ```

#### 场景七：查询日志

1.  在线查询审计日志

    ```sql
    -- 查看日志：从最早日志开始，查看最多10000条日志
    SELECT * FROM vb_audit_log;

    -- 查看日志：指定时间区间 vb_audit_log(timestamptz begitime, timestamptz endtime);
    SELECT * FROM vb_audit_log('2020-01-01 12:00:00', NOW());

    -- 查看日志：指定最近几秒内的日志 vb_audit_log(int seconds);
    SELECT * FROM vb_audit_log(3);
    ```

2.  离线查询日志

    ```bash
    vb_audit decode -d $audit_directory -o ./decode_dir
    # 预期输出：decode_dir下，日志文件与$audit_directory数量一致，文件以.log结尾，内容都是解码后的日志，与select pg_audit_log() 查询格式几乎一致
    ```

#### 扩展场景一：收集事件：强制审计

要求：未开启审计，记录启动、停止实例、修改GUC、创建、删除用户

1.  关闭审计

    ```bash
    vb_guc set -D $VBDATA -c "enable_audit=off"
    ```

2.  重启数据库
3.  创建与删除用户

    ```sql
    CREATE USER u1 PASSWORD 'u1.password';
    DROP USER u1;
    ```

4.  修改GUC参数  
    只能识别通过ALTER SYSTEM SET修改GUC，无法识别通过vb_guc set修改GUC。  
    （gaussdb做法：每个工具本身也产生日志，比如vb_guc.log）

    ```sql
    ALTER SYSTEM SET password_effect_time=10;
    ```

5.  查询审计日志

    ```sql
    SELECT optype,objtype,objname FROM vb_audit_log;
    -- 预期输出
        optype   | objtype | objname
        ---------+---------+-----------------------
        startup | system  |
        create  | user    | u1
        drop    | user    | u1
        alter   | system  | password_effect_time
    ```

#### 扩展场景二：收集事件：敏感事件

敏感事件：修改密码失败、拒绝会话

1.  修改密码失败

    ```sql
    CREATE USER u1 PASSWORD 'u1.password';
    CREATE USER u2 PASSWORD 'u2.password';

    -- 场景1：密码不合法
    ALTER USER u1 PASSWORD 'password';

    -- 场景2：无权限修改
    SET ROLE u1 PASSWORD 'u1.password';
    ALTER USER u2 PASSWORD 'u2.ne2pass';
    ```

2.  查看日志

    ```sql
    SELECT optype,objtype,objname,opres FROM vb_audit_log WHERE optype = 'alter';
    -- 预期输出
        optype  | objtype | objname | opres
        --------+---------+---------+-------
        alter   | user    | u1      | failed
        alter   | user    | u1      | failed
    ```

3.  登录失败

    ```bash
    vsql -d vastbase -U u1 -W 'u1.wrongpass'  # 使用错误密码
    ```

4.  查看日志

    ```sql
    SELECT optype,objtype,objname,opres FROM vb_audit_log;
    -- 预期输出
        optype  | objtype | objname | opres
        --------+---------+---------+-------
        login   | user    | u1      | failed
    ```

#### 扩展场景三：传输日志：审计性能

要求：性能不能太低

1.  确定测试方法  
    此处，以标准tpcc为例：
    -   1000仓
    -   300-500并发
2.  性能要求
    -   场景一：不开启审计
    -   场景二：开启ddl审计

        ```sql
        CREATE AUDIT POLICY ap1 OPERATE create,alter,drop,import,refresh; -- 可继续添加其他ddl
        ```

        -   预期：与场景一相比，劣化不高于5%
    -   场景三：开启全审计

        ```sql
        CREATE AUDIT POLICY ap1 OPERATE all;
        ```

        -   预期：与场景一相比，劣化不高于20%
    -   场景四：开启全审计，创建大量策略

        ```sql
        CREATE AUDIT POLICY ap1 OPERATE all;
        -- 创建大量无效策略
        CREATE AUDIT POLICY ap2 USERS u1 OPERATE create;
        CREATE AUDIT POLICY ap3 USERS u2 OPERATE create;
        CREATE AUDIT POLICY ap4 USERS u3 OPERATE create,insert,select;
        -- 省略 .... (自行构造)
        ```

        -   预期：与场景一相比，劣化不高于20%

#### 扩展场景四：存储日志：日志保留

要求：存储空间耗尽、失败、受攻击等，功能不失效，措施：忽略新日志、覆盖旧日志  
要求：日志强制保留180天（从数据库角度，无法强制保留，只能以后版本支持将日志传输到另一系统，让客户自行保留）

1.  设置审计目录最大值

    ```bash
    vb_guc set -D $VBDATA -c "audit_directory_size=10240" # 单位M
    # 预期结果：日志文件总大小，始终不会超过设定值
    ```

2.  设置日志目录写满策略

    ```bash
    vb_guc set -D $VBDATA -c "audit_directory_full_policy='overwrite'" # 覆盖最旧日志
    ```

3.  重启数据库，产生大量日志  
    预期结果：最旧的日志文件被删除，继续生成新日志
4.  设置日志目录写满策略

    ```bash
    vb_guc set -D $VBDATA -c "audit_directory_full_policy='stopwrite'" # 停止写最新日志
    ```

5.  重启数据库，产生大量日志  
    预期结果：最旧的日志文件还在，停止生成新日志

#### 扩展场景六：存储日志：日志脱敏

要求：不记录password等敏感信息

1.  执行敏感操作

    ```sql
    CREATE USER u1 PASSWORD 'u1.password';
    ALTER USER u1 PASSWORD 'u1.newpass';
    SELECT gs_encrypt_aes128('plaindata','i_am_password');
    -- 复用G100已有脱敏机制，支持对多种敏感数据脱敏
    ```

2.  查看审计日志

    ```sql
    SELECT optype,objname,sql FROM vb_audit_log;
    -- 示例输出：
        optype   | objname             | sql
        ---------+---------------------+------------------------------------------------------------
         create  | u1                  | CREATE USER u1 PASSWORD '*********'
         alter   | u1                  | ALTER USER u1 PASSWORD '*********'
         execute | gs_encrypt_aes128   | SELECT gs_encrypt_aes128('plaindata','***********')
    ```

#### 扩展场景七：存储日志：日志落盘

要求：提交事务时，等待事务产生的日志落盘（默认异步落盘）

1.  设置日志同步落盘

    ```bash
    vb_guc set -D $VBDATA -c "audit_flush_policy='sync'"
    ```

2.  重启数据库
3.  连续生成日志，并构造异常

    ```bash
    vsql -d vastbase -c "CREATE TABLE t1(c1 INT)"
    # 连续生成日志（建议用c语言并发执行）
    for i in $(seq 1 10000); do echo "INSERT INTO t1 VALUES($i);"; done | vsql -d vastbase
    # 执行到一半
    # 构造数据库异常
    kill -9 `pidof vastbase`
    ```

4.  查询审计日志

    ```sql
    SELECT * FROM t1;
    SELECT * FROM vb_audit_log(100);
    -- 预期输出：所有t1中能查到的数据，vb_audit_log中均记录了日志
    ```

5.  设置日志异步落盘

    ```bash
    vb_guc set -D $VBDATA -c "audit_flush_policy='async'"
    ```

6.  重启数据库
7.  连续生成日志，并构造异常  
    重复步骤3
8.  查询审计日志

    ```sql
    SELECT * FROM t1;
    SELECT * FROM vb_audit_log(100);
    -- 预期输出：t1中能查到的数据，vb_audit_log中可能存在未记录审计日志的情况
    ```

#### 扩展场景八：查询日志：查询权限

要求：授权用户才可查询日志  
以下角色，有权查询日志：

-   initial user
-   superuser
-   sysadmin (未开启三权分立的情况下)
-   auditadmin

    ```sql
    CREATE USER u1 PASSWORD 'u1.password' AUDITADMIN;
    ```

-   vbadmin

    ```sql
    GRANT vbadmin TO u2;

    set role u2 password 'u2.password';
    GRANT u2 TO u3; -- 继承角色也可以
    ```

#### 扩展场景八：查询日志：日志展示

要求：支持图形化界面vem  
vem需对接，g100旧版本中，vem已对接审计。新版本中，vem需修改查询日志的函数名。

#### 扩展场景九：查询日志：存储视图

要求：存储视图：查看日志存储空间占比

1.  查看审计目录使用情况

    ```sql
    SELECT * FROM pg_audit_directory_stat();
    -- 示例输出
        dirfiled     | value
        -------------+------------
        total_zie    | 100G
        used_size    | 52.8G
        file_num     | 1050
        full_policy  | overwrite
        oldest       | adt_2025_0301_120201_139900.blog
        latest       | adt_2025_0925_113133_589181_writing_0.blog
    ```

#### 交互场景一：vsql \\h

1.  vsql查看 CREATE AUDIT POLICY用法

    ```sql
    \h CREATE AUDIT POLICY
    ```

2.  vsql查看 ALTER AUDIT POLICY用法

    ```sql
    \h ALTER AUDIT POLICY
    ```

3.  vsql查看 DROP AUDIT POLICY用法

    ```sql
    \h DROP AUDIT POLICY
    ```

#### 交互场景二：vb_dumpall

1.  创建审计策略

    ```sql
    CREATE AUDIT POLICY ap1 USERS u1,u2 OPERATE create,drop;
    ```

2.  导出审计策略

    ```bash
    vb_dumpall -p 5432 --audit-only -f adt.sql
    ```

3.  恢复审计策略

    ```bash
    vsql -d vastbase -p 5432 -c "DROP AUDIT POLICY ap1"
    vsql -d vastbase -p 5432 -f adt.sql
    # 预期结果：恢复ap1成功
    ```

#### 交互场景三：其他

-   物理备份恢复：支持备份、恢复AUDIT POLICY，默认支持，无需单独适配。
-   逻辑复制：不支持同步审计策略

#### 异常场景一：语法异常

1.  设置不存在的过滤对象

    ```sql
    CREATE AUDIT POLICY ap1
        USERS u1,u2 -- 假设 u1 不存在，报错
        OPERATE INSERT,UPDATE -- 假设是奇怪的操作类型，比如dump，报错
        ON t1,t2  -- 假设 t1 不存在，报错
        CLIENT '192.168.0.10'
        RESULT succeed,failed;
    ```

#### 异常场景二：配置异常

假设以下异常，会导致数据库无法启动

| 编号 | 参数名 | 默认值 | 取值范围 | 级别 | 功能 |
| --- | --- | --- | --- | --- | --- |
| 1 | enable_audit | off | on,off | postmaster | 是否开启审计功能 |
| 2 | audit_directory | pg_audit | 绝对路径、相对路径 | postmaster | 审计日志存储目录。如果取值为空，则默认存储于’数据目录/pg_audit’下 |
| 3 | audit_directory_size | 128M | [64M,-] | postmaster | 审计日志目录最大空间 |
| 4 | audit_directory_full_policy | overwrite | overwrite,stopwrite | postmaster | 目录达到最大空间，采取策略：覆盖最旧文件、忽略新日志 |
| 5 | audit_buffer_size | 16M | [1M，1024M] | postmaster | 内存中，审计线程接收工作线程日志时，审计日志缓冲区大小 |
| 6 | audit_flush_policy | asnyc | sync,asnyc | postmaster | 事务提交时，是否等待事务产生的日志落盘 |
| 7 | audit_thread_num (待评估) | 1 | [1, 5] | postmaster | 审计写线程的数量，每个审计写线程，单独写审计文件。取值大于1时，需启动1个异步归并线程 |

#### 异常场景三：运行异常

| 异常场景 | 描述 | 预期结果 |
| --- | --- | --- |
| 进程异常 | kill 审计线程 | 自动重启线程，不影响业务，日志不丢失 |
| 文件异常 | audit_direcotry运行时异常 | 审计功能异常，无法记录审计日志，不影响业务 |
| 文件异常 | audit log已写完文件丢失 | 查询日志时，缺少部分日志，影响不大 |
| 文件异常 | audit log正在写文件丢失 | 自动重新创建文件，不影响业务 |

### 2.2.2 配置参数和文件

此次变更接口较多，统一在”2.3接口信息”中介绍。

### 2.2.3 数据相关性

无

## 2.3 接口信息

本需求变更接口较多，以下为变更项统计信息：

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

### 一、GUC

1.  新增4个GUC

    | 编号 | 参数名 | 默认值 | 取值范围 | 级别 | 功能 |
    | --- | --- | --- | --- | --- | --- |
    | 1 | enable_audit | off | on,off | postmaster | 是否开启审计功能 |
    | 2 | audit_directory_size | 128M | [64M,-] | postmaster | 审计日志目录最大空间 |
    | 3 | audit_directory_full_policy | overwrite | overwrite,stopwrite | postmaster | 目录达到最大空间，采取策略：覆盖最旧文件、忽略新日志 |
    | 4 | audit_flush_policy | asnyc | sync,asnyc | postmaster | 事务提交时，是否等待事务产生的日志落盘 |

2.  修改3个GUC含义

    | 编号 | 参数名 | 默认值 | 取值范围 | 级别 | 功能 |
    | --- | --- | --- | --- | --- | --- |
    | 1 | audit_directory | pg_audit | 绝对路径、相对路径 | postmaster | 审计日志存储目录。如果取值为空，则默认存储于’数据目录/pg_audit’下 |
    | 2 | audit_buffer_size | 16M | [1M，1024M] | postmaster | 内存中，审计线程接收工作线程日志时，审计日志缓冲区大小 |
    | 3 | audit_thread_num (待评估) | 1 | [1, 5] | postmaster | 审计写线程的数量，每个审计写线程，单独写审计文件。取值大于1时，需启动1个异步归并线程 |

3.  删除30个GUC
    -   配置审计

        | 编号 | 参数名 | 参数含义 | 变更 |
        | --- | --- | --- | --- |
        | 1 | audit_enabled | 是否开启审计功能 | 删除 |
        | \- | audit_directory | 文件目录 | 保留 |
        | 2 | audit_backup_directory | 文件备份目录 | 删除 |
        | 3 | audit_dump_directory | 文件归档目录 | 删除 |
        | 4 | audit_resource_policy | 什么场景删除旧日志：达到时间限制还是总大小限制 | 删除 |
        | 5 | audit_space_limit | 文件夹总大小 | 删除：由audit_directory_size替代 |
        | 6 | audit_file_remain_time | 日志保留时间 | 删除 |
        | 7 | audit_file_remain_threshold | 初始化索引文件时，文件数量最大值 | 删除 |
        | 8 | audit_rotation_interval | 生成新文件时，时间间隔 | 删除 |
        | 9 | audit_rotation_size | 生成新文件时，文件大小阈值 | 删除：改为固定值 |
        | 10 | audit_stop_policy | 文件大小或时间达到阈值时，删除旧日志，还是停止写新日志 | 删除 |
        | 11 | vb_audit_space_alarm_threshold | 是否对文件大小达到阈值时告警 | 删除 |
        | 12 | get_auditindex_file_lock | 读取索引文件时，不加锁（只是为了测性能时不加锁） | 删除 |
        | 13 | audit_data_format | 日志格式，仅支持二进制 | 删除 |
        | 14 | audit_hash_enabled | 日志中是否记录哈希值 | 删除 |
        | 15 | audit_xid_info | 日志中是否记录xid | 删除 |

    -   配置审计线程

        | 编号 | 参数 | 功能 | 变更 |
        | --- | --- | --- | --- |
        | \- | audit_thread_num | 写日志的线程数 | 保留 |
        | \- | audit_buffer_size | 日志缓存大小 | 保留 |
        | 16 | audit_buffer_fflush_interval | 日志缓存刷盘间隔 | 删除：自动控制 |

    -   配置审计范围
        -   主体

            | 编号 | 参数 | 功能 | 变更 |
            | --- | --- | --- | --- |
            | 17 | audit_user | 对白名单内的用户进行审计 | 删除 |
            | 18 | full_audit_users | 对白名单内的用户的所有操作进行审计 | 删除 |
            | 19 | no_audit_client | 对黑名单内的IP的用户不审计 | 删除 |

        -   操作

            | 编号 | 参数 | 功能 | 变更 |
            | --- | --- | --- | --- |
            | 20 | audit_copy_exec | 是否审计 COPY | 删除 |
            | 21 | audit_dml_state | 是否审计 INSERT、UPDATE、DELETE | 删除 |
            | 22 | audit_dml_state_select | 是否审计 SELECT | 删除 |
            | 23 | audit_set_parameter | 是否审计 SET | 删除 |
            | 24 | audit_user_violation | 是否越权操作 | 删除 |
            | 25 | audit_operation_result | 只记录操作：成功、失败、成功和失败 的日志 | 删除 |
            | 26 | audit_network_error | 是否审计网络连接错误 | 删除 |
            | 27 | audit_query_cancel | 是否审计用户取消SELECT操作 | 删除 |
            | 28 | audit_insufficient_space | 是否记录SPACE：达到限额 | 删除 |
            | 29 | audit_tool_error | 是否审计 vb_dump、vb_dumpall、vb_restore 的异常 | 删除 |

        -   客体

            | 编号 | 参数 | 功能 | 变更 |
            | --- | --- | --- | --- |
            | 30 | audit_system_object | 审计OBJECT的范围：DATABASE、SCHEMA、TABLE、…等CREATE、DROP、ALTER操作 | 删除 |
            | 31 | audit_database_process | 是否审计CLUSTER：启动、停止、切换和恢复 | 删除 |
            | 32 | audit_function_exec | 是否审计FUNCTION：执行 | 删除 |
            | 33 | audit_systerm_function_exec | 是否审计FUNCTION：执行（内核写了一个白名单，共61个，例如pg_stat_activity，pg_switch_xlog等） | 删除 |
            | 34 | audit_sequence_enabled | 是否审计语句序列 | 删除 |
            | 35 | audit_crypt_func | 是否审计FUNCION （密码运算函数） | 删除 |
            | 36 | audit_security_policy | 是否审计POLICY | 删除 |
            | 37 | audit_transcation | 是否审计TANSCATITON：提交、回滚 | 删除 |
            | 38 | audit_login_logout | 审计CLUSTER：{登录、注销} x {成功、失败} | 删除 |
            | 39 | audit_user_locked | 是否审计USER：锁定、解锁 | 删除 |
            | 40 | audit_grant_revoke | 是否审计USER：赋权、收权 | 删除 |

### 2 SQL

1.  变更 CREATE AUDIT POLICY
    -   新版本

        ```sql
        CREATE AUDIT POLICY policy_name
            [USER    { all | user_list }] -- 按用户过滤
            -- [ROLE   {all | role_lsit}] -- 暂不支持：按角色过滤
            [OPERATE { all | operate_list }]  -- 按操作过滤
            [ON      { all | object_list }]               -- 按对象过滤
            [IN      { all | in_object_list }]            -- 按对象过滤：例如：IN DATABASE db1，表示db1中所有对象
            [CLIENT  { all | client_ip_or_host_list }] -- 按客户端过滤
            [RESULT  { all | { succeed | failed }}]     -- 按操作结果过滤

        user_list:
            user_name [, user_name, ..]
        operate_list:
            opereate_or_scope [, opereate_or_scope, ..]
        opereate_or_scope:
            | create
            | drop
            | insert
            | execute
            | ... -- 查看可选的operate：SELECT * FROM vb_audit_operate()
            | { ddl | dcl | dml | dql | func | tcl }
        object_list:
            | table_name [, table_name, ..]
            | TABLE table_name [, table_name, ..]
            | DATABASE database_name  [, database_name, ..]
            | SCHEMA schema_name [, schema_name, ..]
            | FUNCTION function_name [, function_name, ..]
            | DATABASE all
            | SCHEMA all
            | FUNCTION all
        in_object_list:
            | DATABASE database_name  [, database_name, ..]
            | SCHEMA schema_name [, schema_name, ..]
        client_ip_or_host_list:
            ip_or_host [, ip_or_host, ..]
        ```

    -   旧版本

        ```sql
        CREATE AUDIT POLICY [ IF NOT EXISTS ] policy_name {
            | {
                { privilege_audit_clause | access_audit_clause }
                [ filter_group_clause ]
                [ ENABLE | DISABLE ]
                [normally | warning | block]
             }
            | [ sequence_audit_clause ] [normally | warning | block ]
        };

        privilege_audit_clause:
            PRIVILEGES { DDL | ALL } [ ON LABEL ( resource_label_name [, ... ] ) ]
        access_audit_clause:
            ACCESS { DML | ALL } [ ON LABEL ( resource_label_name [, ... ] ) ]
            -- LABLE 由 CREATE RESOURCE LABLE .. resource_type(item,item,..)语法创建
            -- resource_type取值： TABLE | COLUMN | SCHEMA | VIEW | FUNCTION
        filter_group_clause:
            FILTER ON { ( FILTER_TYPE ( filter_value [, ... ] ) ) [, ... ] }
        sequence_audit_clause:
            SEQUENCE BY ['SQL']

        DDL:
            { ( ALTER | ANALYZE | COMMENT | CREATE | DROP | GRANT | REVOKE | SET | SHOW ) }
        DML:
            { ( COPY | DEALLOCATE | DELETE_P | EXECUTE | REINDEX | INSERT | PREPARE | SELECT | TRUNCATE | UPDATE ) }
        FILTER_TYPE:
            { APP | ROLES | IP | TIME_PERIOD }
        ```

### 3 CATALOG

1.  新增1个系统表

    ```sql
    SELECT * FROM vb_adt_policy;
    -- 详细输出：场景二：设置范围
    ```

2.  删除5个系统表

    | 编号 | 名称 | 功能 | 变更 |
    | --- | --- | --- | --- |
    | 1 | gs_auditing_policy | 存储审计策略 | 删除 |
    | 2 | gs_auditing_policy_access | 存储审计策略中的操作 | 删除 |
    | 3 | gs_auditing_policy_privileges | 存储审计策略中的权限 | 删除 |
    | 4 | gs_auditing_policy_filters | 存储审计策略中的用户、客户端等 |  |
    | 5 | gs_auditing_policy_sequence | 存储序列审计 | 删除 |

### 4 FUNCTION

1.  新增4个内置函数

    ```sql
    vb_audit_log(timestamptz begintime, timestamptz endtime);
     -- 详细输出：场景四：生成日志
    vb_audit_log(int seconds);

    pg_audit_buffer_stat();
    -- 详细输出：场景五：传输日志

    pg_audit_directory_stat();
    -- 详细输出：扩展场景九：存储视图
    ```

2.  删除7个内置函数

    | 编号 | 名称 | 功能 | 变更 |
    | --- | --- | --- | --- |
    | 1 | pg_query_audit | 查询审计日志 | 删除 |
    | 2 | pg_query_audit_dump | 查询dump目录（归档目录下）的审计日志 | 删除 |
    | 3 | pg_query_audit_info | \- | 删除 |
    | 4 | login_audit_messages | \- | 删除 |
    | 5 | login_audit_messages_pid | \- | 删除 |
    | 6 | pg_audit_logsize_warning | \- | 删除 |
    | 7 | audit_analyze_offsite_landing | \- | 删除 |

### 5 VIEW

1.  新增2个视图

    ```sql
    CREATE VIEW pg_audit_policy AS SELECT .. FROM vb_adt_policy;
    -- 详细输出：场景二：设置范围

    CREATE VIEW pg_audit_log AS SELECT * FROM pg_audit_log('2020-01-01', NOW());
    ```

2.  删除3个视图

    | 编号 | 名称 | 功能 | 变更 |
    | --- | --- | --- | --- |
    | 1 | gs_auditing | 审计策略 | 删除 |
    | 2 | gs_auditing_access | 存储审计策略中的操作 | 删除 |
    | 3 | gs_audit_privilege | 存储审计策略中的权限 | 删除 |

### 6 TOOL

1.  新增1个工具

    ```bash
    vb_audit -h
        # 输出如下：
        vb_audit is a utility to process audit log.

        usage:
        vb_audit decode [options]
        vb_audit print  [options]

        [options] could be:
        -h,-?, --help                show this help, then exit
        -v, --version                show the version of this tool, then exit
        -d, --direcotry=LOG_DIR      directory of audit logs
        -f, --file=LOG_FILE          audit log file
        -o, --output=DIR_OR_FILE     used with the --direcotry or --file parameter
        -b, --begin-time=BEGIN_TIME  the earliest audit log, format example: '2020/01/01 12:00:00'
        -e, --end-time=END_TIME      the latest audit log
    ```

2.  修改2个工具

    ```bash
    # vb_initdb中，设置审计加密算法、加密密钥的参数，不再生效
    vb_initdb -D ./data --audit_encrypt_algorithm=SM4 --audit_master_key="MTIzNDVhYmNLZEBBQkNERQ==" --audit_encrypt_key="MTIzNDVhYmNLZEBBQkNERQ=="

    # vb_dumpall 新增参数--audit-only，支持导出审计策略
    vb_dumpall -p 5432 --audit-only -f adt.sql
    ```

### 7 FILE

1.  新增1个文件夹

    ```bash
    数据目录/vb_audit # 存储审计日志，可通过GUC参数设置为其他目录
    ```

2.  废弃1个文件夹

    ```bash
    数据目录/vb_audit # 旧版本审计存储审计日志的默认路径
    ```

## 2.4 正反向行为

### 2.4.1 生效说明

### 2.4.2 提示信息

报错

### 2.4.3 约束和依赖

无

## 2.5 安全性

### 2.5.1 权限控制

以下角色，有权查询日志：

1.  initial user
2.  superuser
3.  sysadmin (未开启三权分立的情况下)
4.  auditadmin
5.  vbadmin

### 2.5.2 审计

无

## 2.6 影响范围

### 2.6.1 对已有UDT,UDF, ECPG的影响

无

### 2.6.2 对系统函数的影响

详情见：2.3接口信息章节

### 2.6.3 对系统CATALOG的影响

详情见：2.3接口信息章节

### 2.6.4 对xlog日志格式、数据格式的影响

无

### 2.6.5 与其他功能交互时的行为表现

无

### 2.6.6 版本兼容性

接口变更较多，无法前向兼容

### 2.6.7 用户行为变更

此次变更接口较多，统一在”2.3接口信息”中介绍。

## 2.7 指标相关

### 2.7.1 关键资源指标

-   CPU：最差情况，1条SQL语句，生成1条日志
-   线程：不开启审计功能，未新增线程。开启审计功能，默认启动1个审计写线程。
-   内存：全局内存：审计日志缓存区大小为16M-1G。临时内存：每次生成日志时，需临时申请一段内存，大小一般为100多字节。
-   网络：无
-   磁盘：审计日志文件夹下，会存储大量审计日志。tpcc 1000仓场景，如果审计所有SQL，大小约为600多G

### 2.7.2 系统性指标

无

### 2.7.3 性能指标

详情见：扩展场景：审计性能

## 2.8 测试建议

参考E100审计测试方案。

## 2.9 其他说明

### 审计策略语法

-   新版本
    -   方式一：与oracle一致

        ```sql
        CREATE AUDIT POLICY ap1
            PRIVILEGES privilege [ , privilege ..] -- privilege 子句，内置权限有200多种，示例：CREATE TABLE(可能是其他SQL，但使用到该权限), ALTER USER
            ACTIONS action [ , action ..]          -- aciton 子句，示例：CREATE TABLE, SELECT,ALTER,DROP 。操作+对象组合，共有1900+
                ON object [ , object ..]               -- object 子句
            ROLES role [ , role ..]                -- role 子句
        ```

    -   方式二：与opengauss一致

        ```sql
        CREATE AUDIT POLICY policy_name
            PRIVILEGES { DDL | ALL } -- DDL操作类型
                ON LABEL resource_label_name [, ... ] -- 对象
            ACCESS { DML | ALL }  -- DML操作类型
                ON LABEL resource_label_name [, ... ] -- 对象
            FILTER ON FILTER_TYPE filter_value [, ... ] -- 过滤类型：用户、IP等

        -- DDL: ALTER | ANALYZE | COMMENT | CREATE | DROP | GRANT | REVOKE | SET | SHOW
        -- DML: COPY | DEALLOCATE | DELETE_P | EXECUTE | REINDEX | INSERT | PREPARE | SELECT | TRUNCATE | UPDATE
        -- FILTER_TYPE: APP | ROLES | IP | TIME_PERIOD
        ```

    -   方式三：便于理解版

        ```sql
        CREATE AUDIT POLICY $ap_name
            WHERE subjname = 'u1'
            AND scope = 'ddl'
            AND optype in ('create', 'drop')
            AND objtype = 'table'
            AND objname != ('t1', 't2', 't3');

        -- 优化：创建group
        CREATE GROUP g1 TYPE user MEMBER u1,u2,u3;
        CREATE GROUP g2 TYPE operate MEMBER create,drop;

        CREATE AUDIT POLICY $ap_name
            WHERE subjname = g1
            AND scope = 'ddl'
            AND optype = g2
            AND objtype = 'table'
            AND objname != ('t1', 't2', 't3');

        -- 传统审计：
        CREATE AUDIT POLICY $ap_nam
            WHERE optype in ('create', 'drop');
        ```
