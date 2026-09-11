+++
title = '数据库安全 1 身份认证'
date = '2025-01-24T18:46:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['身份认证']
weight = 401
ShowToc = true
TocOpen = true
+++
> **摘要**：从5个方面，介绍PostgreSQL身份认证特性：背景、原理、使用、设计、实现

# 1 身份认证概述

## 1.1 非法访问风险

-   数据库进程  
    数据库运行时，本质是一个服务器进程，在特定的主机上，监听特定端口。应用如果知道IP和端口，都可与数据库进程建立TCP连接，并进行数据交互，包括发送SQL语句、接收查询结果等。
-   数据泄露风险  
    为避免非法用户访问数据库，构造特殊数据，造成数据损坏、数据泄露等问题，数据库接收应用建立TCP的请求，并成功建立TCP连接后，需先确认应用的身份是否合法，再接收应用的其他数据，比如接收SQL语句等。

## 1.2 身份认证机制

在信息系统中，身份认证是一种常见的机制，身份认证的概念较成熟，本文不详细介绍相关概念。身份认证分为标识与鉴别两个部分：

-   标识：用户向系统声明自己的身份，系统标识用户
-   鉴别：系统验证用户提供的信息，确认用户是否是已标识的用户

按照认证因素，可将身份认证划分为3类：

-   知识因素：用户知道某些秘密，比如口令、密码等
-   拥有因素：用户拥有某些实物，比如钥匙、证书、令牌等
-   生物因素：用户拥有某些特征，比如指纹、面部、虹膜、签名等

## 1.3 PostgrSQL的身份认证

PostgreSQL的认证方式有很多种，包括：密码认证、Ident认证、Peer认证、证书认证、LDAP认证等。本文仅介绍最常见的方案。

在大部分场景中，PostgreSQL采用以下2层认证机制：

-   主机认证：
    -   标识：在PostgreSQL的配置文件中，配置IP白名单
    -   鉴别：PostgreSQL与应用建立连接后，检查应用的IP是否在白名单内，判断应用是否合法
-   口令认证：
    -   标识：PostgreSQL已存在的用户，创建新用户，为其设置用户信息，以及口令
        -   备注：第一次安装PostgreSQL时，PostgreSQL要求用户创建初始用户
    -   鉴别：在主机认证后，PostgreSQL先要求应用提供用户信息，再要求应用提供对应的口令，判断应用是否合法

# 2 身份认证的使用流程

## 2.1 基本流程

PostgreSQL中，从用户的角度观察，使用身份认证的流程可简单理解为：

1.  用户：已存在的用户使用`CRATE USER {username} .. PASSWORD {password} ..`语法，创建新用户并设置口令
2.  数据库：数据库先对口令进行哈希，再存储口令的哈希值，目前的版本中，默认哈希算法为sha256算法，用户可通过GUC参数配置哈希算法类型
3.  用户：用户与数据建立连接，将`{username}`与`{password}`的哈希值发送给数据库，数据库比较用户发送的哈希值与系统表中的哈希值，判断`{password}`是否合法

具体实现中，第3步的验证过程较为复杂，RFC5 802协议提供了一套安全的交互流程。后文介绍内部实现的详细流程。

# 3 身份认证的实现

## 3.1 基于IP的身份认证

标识：访问者的IP  
鉴别：数据库遍历IP白名单，判断访问者IP是否在白名单中，如果在，则认为访问者合法，允许与数据建立TCP连接。

```c
PostmasterMain
    ServerLoop
        ConnCreate
            StreamConnection
        BackendStartup
            BackendRun
                PostgresMain
                    InitPostgres
                        PerformAuthentication
                            ClientAuthentication
                                hba_getauthmethod /* 从hba文件中，获取指定ip的认证方式 */
                                    check_hba
                                        check_hostname
                                        check_ip
                                        /* 如果指定ip未获取到认证方式，则返回空 */
                                switch hba->auth_method: /* 根据ip采用不同的认证方式 */
                                    case uaReject:
                                    case uaImplicitReject:
                                    case uaGSS:
                                    case uaSSPI:
                                    case uaPeer:
                                    ...
                                    case uaMD5:
                                    case uaPassword:
                                    case uaCert:
                                    case uaTrust:
                                    ...
```

## 3.2 基于证书的身份认证

创建主体的语法示例如下：

```sql
CREATE USER r1 PASSWORD 'r1@12345';
```

主体信息存在2个系统表中，pg_authid中存储了所有主体的oid

```sql
-- 查询系统表
SELECT oid,rolname,rolpassword FROM pg_authid;
oid   | rolename | rolpassword
------+----------+--------------
16384 | r1       | md5.........

-- 查询视图与查询pg_authid结果一致
SELECT * FROM pg_roles;
SELECT * FROM pg_user;
```

# opengauss身份认证

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

SetSessionAuthorization
    SetSessionUserId

SetUserIdAndSecContext
```
