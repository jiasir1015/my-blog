+++
title = '分享编写需求/设计文档的个人经验'
date = '2025-07-15T10:54:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['需求文档', '设计文档']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 简介

## 1.1 分享的主题

分享一些编写需求、设计文档经验

## 1.2 分享的背景

-   背景：我写的需求文档，（相对）还算详细，所以有此次分享

    -   308.1，profile功能的需求文档：[https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001007196](https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001007196)
-   根因：前公司流程繁重，被迫养成这种习惯。

-   分享的内容：可分享的干货不多，我觉得，在写文档的过程中，大部分人想的很详细，只是没有编写到文档中，毕竟每个人都有自己的编写风格。所以，本文的重点，是介绍前公司流程与要求，并以我做过的需求为例，为大家提供一点参考。

-   分享人经历：交过10+个不算小的需求，完整写过10+次需求与设计文档，格式与海量的接近。

-   分享的局限：交付的需求，主要是安全方向，也涉及SQL、存储等多个模块，所以，本文主要以安全需求的角度写，其他模块的需求不一定适用。

![scope](/images/ProjectDocs/writing-requirement-and-design-docs/scope.png)

## 1.3 前公司的流程

与海量相比，前公司的交付流程，几乎一样：

1.  客户：提出需求
2.  产品、项目、测试、架构等：审核需求
3.  开发：撰写需求/设计文档
4.  各角色：评审需求/设计文档
5.  开发：编写代码
6.  …

其中，在`4.评审需求/设计文档`环节，前公司区别较大：

-   一、评审人员多

    | 编号 | 角色 | 评审人 | 目的 |
    | --- | --- | --- | --- |
    | 1 | 开发 | 安全组、SQL组、存储组、运维组、.. | 避免影响其他模块，协助发现风险 |
    | 2 | 测试 | 测试人、测试组长 | 学习新需求，识别测试重点 |
    | 3 | 架构 | 架构设计 | 避免影响其他模块，确保后向兼容 |
    | 4 | 资料 | 资料优化、资料审核 | 学习新需求 |
    | 5 | 用例 | 用例审核 | 确保各种check可看护功能 |
    | 6 | 其他 | 流程提升 | \- |

-   二、评审通过难
    1.  组内评审
    2.  线上评审：上述所有角色会上评审，不过，一般很多人会议冲突，关键靠线下评审
    3.  线下评审（关键流程）：各类角色共10+必选评审人，通过在线需求文档、设计文档了解需求，提出疑问，提出意见。开发分析解决后，找提出人确认意见，才算闭环。最后，所有必选评审人评审通过，才算完成流程。

在这种流程中，需求与设计文档，要满足很多要求：

1.  普适：考虑到其他组开发、测试、资料等角色，不熟悉本领域的基础知识，所以，需要详细介绍相关原理，很多原理需要从头介绍
2.  完整：要充分例举所有可能涉及风险，否则，评审人会认为未考虑到

    > 举例：做了1个需求，可以为表设置加密属性，需要考虑：系统表、用户表（atore表、ustore表、分区表、临时表、toast表、unlogged表、segment表、hashbuckent表、物化视图…）

# 2 需求文档写作思路

## 2.1 分析过程

首先，客户提出需求，很多需求不够清晰。

> 示例：
>
> -   profile原始需求：
>     -   目前对于数据库用户的管理方式不够便捷，无法像Oracle为用户赋予一组安全策略。一些属性如密码有效期、密码过期天数、密码尝试次数等也只能全局设定，无法指定用户配置。

然后，以我的个人习惯，分析需求的流程如下：

1.  分析需求属于哪个模块
    -   举例：profile需求，分析关键词：密码、登录等，可确定需求属于身份认证模块
2.  熟悉需求涉及的模块

    -   举例：我熟悉身份认证的习惯

    1.  熟悉身份认证原理（产品文档、AI、网上博客等）
    2.  熟悉vastbase身份认证原理（产品文档、AI、网上博客）

        > 1.  为什么需要这个模块
        > 2.  如何配置：GUC参数等
        > 3.  如何触发：连接参数、SQL语句等
        > 4.  如何存储元数据：系统表、文件
        > 5.  非核心功能有哪些：修改密码、删除密码、…

    3.  按自己理解，划分vastbase身份认证子模块/流程：

        > 1.  配置参数
        > 2.  创建用户：设置密码
        > 3.  登录用户：提供密码
        > 4.  校验用户：检查密码，检查登录次数等
        > 5.  修改密码
        > 6.  xxx

3.  识别需求属于哪个子模块（熟悉客户核心需要的东西）
    -   示例：profile需求，分析关键词：配置策略、全局设定、指定用户设置，可确定涉及的子模块：

        > 1.  配置参数：可配置密码有效期等参数，以前是集群级GUC参数，客户想要用户级配置参数

4.  识别可能涉及的子模块：（熟悉本需求的修改范围，修改工作量，需要详细学习的子模块）
    -   示例：本需求涉及很多配置参数，因此，很多流程都会被影响

        > 1.  配置参数
        > 2.  创建用户
        > 3.  登录用户
        > 4.  校验用户：读取配置参数，校验密码有效期、密码过期天数、密码尝试次数
        > 5.  修改密码：读取配置参数，校验密码复用次数
        > 6.  xxx

5.  熟悉友商现状
    -   示例：一般情况，客户提的需求，都能在友商产品中找到，我会先从oralce, sql server, postgresql, mysql等产品文档中，学习相关内容：

        > 1.  熟悉oralcle身份认证模块：oracle profile做的比较好，客户的需求，其实就是想要oracle profile
        > 2.  熟悉oracle身份认证子模块
        > 3.  配置参数（有差异）
        > 4.  创建用户
        > 5.  ..
        >
        > -   oracle资料：[https://docs.oracle.com/en/database/oracle/oracle-database/23/](https://docs.oracle.com/en/database/oracle/oracle-database/23/)
        > -   mysql资料：[https://mysql.net.cn/doc/refman/8.0/en/preface.html](https://mysql.net.cn/doc/refman/8.0/en/preface.html)

6.  设计需求接口（客户怎么使用本需求）
    -   示例：profile需求，参考友商，通过SQL语法，可以达到配置用户级参数的目的

        ```sql
        CREATE PROFILE {参数组名} LIMIT {参数名} {参数值}；
        ALTER USER {用户名} {参数组名};
        ```

7.  梳理代码流程（评估需求接口可行性）
    -   示例：身份认证流程如下:
    -   场景一、创建用户、密码

        ```python
        exec_simple_query('CREATE USER ..')
            ...
                CreateRole
                    AddAuthHistory
                        transform 'password_reuse_time'
                        systable_beginscan('pg_auth_history')
                        if password > 'password_reuse_time' or 'password_reuse_max': # 校验密码复用条件
                            ok
        exec_simple_query('ALTER USER ..')
            AlterRole
                AddAuthHistory
        ```

    -   场景一：登录用户、校验用户

        ```python
        # 此处以未开启线程池为例
        PostgresMain
            # 第一阶段：接受用户的密码，并进行一系列检查
            InitBackendWorker
                InitSession
                    CheckAuthentication
                        PerformAuthentication
                            port->protocol_config->fn_authenticate
                                ClientAuthentication
                                    # 1. 从pg_hba.conf中，读取password校验方式
                                    hba_getauthmethod
                                    sendAuthRequest
                                    # 2. 接收客户端的password，检查password是否正确
                                    recv_and_check_password_packet
                                        crypt_verify
                                    # 3. 从系统表pg_user_status中，获取rolstatus字段，判断用户是否被锁
                                    GetAccountLockedStatus
                                        SearchSysCache1('pg_user_status')
                                    # 4. 无论密码正确与否，更新与锁定账号相关的参数
                                    if role is lock or unlock:
                                        TryUnlockAccount
                                            GetPasswordTimeOfTuple
                                                transform 'password_lock_time'
                                            UpdateUnlockAccountTuples
                                    # 5. 如果密码失败次数较多，锁定账户
                                    if passwrong:
                                        if master:
                                            TryLockAccount
                                                if > 'failed_login_attempts'
                                                    tableam_tops_modify_tuple('pg_user_status')
                                        elif standby:
                                            UpdateFailCountToHashTable
                                            if > 'failed_login_attempts'
                                                lock
            # 6. 如果密码正确，检查密码有效期（仅vastbase有此函数）
            checkPasswordEffect
                getLeftEffectSpan
                    transform 'password_effect_time'
                if leftday < 0:
                    'ERROR: password expired'

            # 第二阶段：循环接收用户的其他数据，比如SQL语句
            for (;;)
                ReadCommand
                    # 此处，每接收一条客户端的消息，都会检查一次 session_timeout
                    # 如果开启profile，此处需要缓存该用户的profile idle_time参数，否则，每次都从profile系统表中读取，对性能影响较大
                    # 理论上，如果无用户更新profile idle_time参数，一个连接缓存一次即可，即一个连接仅需读取一次系统表
                    if > 'session_timeout':
                        'ERROR: timeout'
                exec_simple_query('SQL')
        ```

## 2.2 编写需求文档

以海量的模板为例，需求文档内包含的内容如下：

-   1 简介
    -   1.1 目的  
        （简单介绍需求是什么）
    -   1.2 使用范围
    -   1.3 术语
    -   1.4 参考资料  
        （oracle、mysql、postgreql、…相关产品中关于相关需求的介绍）
-   2 需求名称
    -   2.1 功能简介  
        （需求来源：客户原始诉求）  
        （需求关联：需求属于哪个模块）（示例：profile需求，属于身份认证模块，用于配置身份认证参数）  
        （需求背景：相关模块基本原理、使用流程。模块中，与需求有关的功能的现状）（示例：身份认证的基本原理、使用流程。其中，介绍在旧版本中，如何配置身份认证参数）  
        （友商分析：友商相关模块的基本介绍，关于本需求的介绍）（示例：oracle, mysql等如何配置身份认证参数）  
        （需求实现：简单介绍实现需求需做哪些事情）  
        （需求约束：需求可以做到什么程度）
    -   2.2 功能说明
        -   2.2.1 使用流程（需求文档最重要的部分）
            -   （主成功场景：介绍核心功能。从用户的角度，介绍如何使用需求，如何查看需求相关元数据，如何判断需求是否生效。主要通过对外接口介绍：guc参数、连接参数、环境变量、sql语句、系统表、系统函数、系统视图、文件等）  
                （配置数据库）  
                （连接数据库）  
                （执行相关操作，关键操作包含预期输出，比如，CREATE成功，预期系统表内新增一行记录等）  
                （…）
            -   （扩展场景：1.相关功能: 从内核的角度，介绍该功能可能会对其他模块的影响。2.约束场景：哪些场景无法使用。3.复杂场景：主备场景、物理备份恢复场景等）（示例：相关功能中，假设需求与表相关，可能涉及系统表、用户表，astore表、ustore表、分区表、toast表、临时表、…）
            -   （异常场景：1.异常输入：用户随机使用，无操作等。2.特殊操作：攻击者DOS攻击等）
        -   2.2.2 配置参数和文件
        -   2.2.3 数据先关性
    -   2.3 接口信息
    -   2.4 正反向行为
        -   2.4.1 说明
        -   2.4.1 生效说明
        -   2.4.2 提示信息
        -   2.4.3 约束和依赖
    -   2.5 安全性
        -   2.5.1 权限控制
        -   2.5.2 审计
    -   2.6 影响范围
        -   2.6.1 对已有UDT,UDF, ECPG的影响
        -   2.6.2 对系统函数的影响
        -   2.6.3 对系统CATALOG的影响
        -   2.6.4 对xlog日志格式、数据格式的影响
        -   2.6.5 与其他功能交互时的行为表现
        -   2.6.6 版本兼容性
    -   2.7 指标相关
        -   2.7.1 关键资源指标
        -   2.7.2 系统性指标
        -   2.7.3 性能指标
    -   2.8 测试建议

# 3 设计文档写作思路

## 3.1 设计流程

与海量相比，前公司设计文档的主要区别是：1个模块维护1份设计文档，新增需求时，在原有文档中补充内容。

假设，需求名称是：全密态数据库支持国密算法，设计文档的内容包括：

1.  明确模块最核心的功能
    -   示例：全密态数据库核心功能![full_enc](/images/ProjectDocs/writing-requirement-and-design-docs/full_enc.png)
2.  设计整体架构
    -   示例：全密态数据库整体架构![enc_struct](/images/ProjectDocs/writing-requirement-and-design-docs/enc_struct.png)
3.  设计工作流程
    -   示例：全密态数据库：等值查询流程

        > 解释：
        >
        > 1.  定义主密钥：

        ![enc_equal](/images/ProjectDocs/writing-requirement-and-design-docs/enc_equal.png)
4.  历史需求列表：
    -   示例：全密态数据库

        | 版本 | 变更 | 功能点 |
        | --- | --- | --- |
        | 503.1 | 首次合入，支持密态等值查询 | 支持语法：INSERT, SELECT, UPDATE, .. 数据类型：int, text, xxx; 算法类型：aes_128_cbc, …； 密钥管理类型：hwc_kms, …； .. |
        | 503.2 | 支持函数与存储过程 | 支持语法：新增函数与存储过程，… |
        | 503.3 | 支持国密加密算法 | 算法类型：新增国密算法sm4_cbc，… |

5.  新需求实现思路
6.  新需求流程图

## 3.2 编写设计文档

-   1 需求名称
    -   1.1 功能简述  
        （模块简介、需求简介）  
        （模块架构图）  
        （模块流程图）  
        （需求列表）（示例：- 1.0.0 引入身份认证模块，支持xxx功能； - 2.2.15 身份认证新增xxx功能 - 3.0.8 身份认证新增xxx功能）  
        （历史需求架构图）  
        （历史需求流程图）
    -   1.2 实现方案  
        （需求实现思路）  
        （需求流程图）  
        （需求流程介绍）  
        （文件等详细设计格式）
    -   1.3 接口说明  
        （SQL完整格式）  
        （系统表元数据）
    -   1.4 内存管理
    -   1.5 安全
    -   1.6 性能
    -   1.7 专利
    -   1.8 升级管理
    -   1.9 其他说明
