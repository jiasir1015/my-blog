+++
title = '海量 4 需求 scram-sha256'
date = '2025-04-03T17:41:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['身份认证', '需求文档']
weight = 400
ShowToc = true
TocOpen = true
+++
# 深信服支持pg scram-sha256需求

## 需求目标

本需求的根本目标时，当vastbase server要求使用sha256算法进行身份认证时，postgresql client能与vastbase server建立连接。  
该需求目前仅合入深信服分支

## 需求分析

身份认证的详细流程有点复杂，此处简要概述为2个阶段：

1.  标识：新建用户时，server计算并存储密码哈希值
2.  鉴别：用户登录时，server向client发送计算密码哈希值的关键信息，client计算并向server发送密码哈希值，server校验其是否符合存储的值

vastbase和postgresql对比，server计算密码哈希值的算法不同，server向client发送关键信息也不同。为解决pg-client能够连接vb-server的问题，需解决问题如下：

1.  vb-server计算并存储与pg-server一致的密码哈希值
2.  vb-server向pg-client发送密码哈希值关键信息时，需要pg-server一致

postgreql的标识与鉴别机制，符合标准RFC-5802，涉及的算法与协议，本文统一称为scram-sha256。vastbase涉及的算法与协议，本文统一称为sha256。

## 需求实现

-   密码存储：新建用户时，修改存储用户密码的值
    -   修改前：guc参数password_encrypt_type，取值1时，vb-server存储密码的[sha256, md5]值；取值为2时，存储密码的[sha256]值

        ```sql
        SELECT rolpassword FORM pgauthid; -- 示例：长度为209
            rolpassword
        --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
        sha256af99537f242c661a88acea99ac626a2cf8fe196ac5671db6f02ed6818b420cf84e7ada61d66602c6eb5bf4ced40911d3f51865959784ebc3b0d385ca4c08f3398f05e16268fe9acc95a2d662bf5033b15d53abd1f835c1a3f1e96343a5cbf800ecdfecefade
        ```

    -   修改后：guc参数password_encrypt_type，取值1时，vb-server存储密码的[sha256, md5, scram-sha256]值；取值为2时，存储密码的[sha256, scram-sha256]值

        ```sql
        SELECT rolpassword FORM pgauthid; -- 示例：长度342 (新增长度：133)
            rolpassword
        --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
        sha256af99537f242c661a88acea99ac626a2cf8fe196ac5671db6f02ed6818b420cf84e7ada61d66602c6eb5bf4ced40911d3f51865959784ebc3b0d385ca4c08f3398f05e16268fe9acc95a2d662bf5033b15d53abd1f835c1a3f1e963SCRAM-SHA-256$4096:sp5V1hrLKzLsS4HtQgqTuA==$QO/UVdrXxIypzBEGqEuIWe96A80elghFQs25ZbdPsLg=:J4lPXmXPANtTMOkaHokMjmM19K1Di7fU6WRWuZ5VmS0=
        ```

-   认证协议：用户登录时，修改向客户端发送的密码哈希值关键信息
    -   修改前：

        ```bash
        # 身份认证协议
        1. client <-> server : tcp connect
        2. client --> server : send [消息类型:0, 协议版本:3.51，连接参数:user_name, databse, ...]
        3. server --> client : send [消息类型:R, 哈希算法:10, 系统表存储的密码的算法:2, 计算密码哈希关键信息：salt,token,iteration]
        4. client <-> server : # 省略3次交互
        ```

    -   修改后：

        ```bash
        # 身份认证协议
        1. client <-> server : tcp connect
        2. client --> server : send [消息类型:0, 协议版本:3.51，连接参数:user_name, databse, ...] # postgreql的client，发送的协议版本是3.0，旧版和最新版都是如此
        3. server --> client :
                            if 协议版本 < 3.51:
                                send [消息类型:R, 哈希算法:10, 算法名称:"SCRAM-SHA256"] # scram-sha256协议的内容
                                4. client <-> server # 省略3次交互，省略的交互中，postgresql与vastbase差异也很大
                            if 协议版本 >= 3.51: # opengauss的机制：opengauss的client，都会设置协议版本大于3.50
                                send [消息类型:R, 哈希算法:10, 系统表存储的密码的算法:2, 计算密码哈希关键信息：salt,token,iteration]
                                4. client <-> server : # 省略3次交互
        ```

## 客户使用

1.  设置密码加密类型

    ```bash
    vb_guc set -D $数据目录 -c "password_encryption_type=1" #  取值为1和2都行
    ```

2.  修改已有用户的密码（无需使用postgresql client的无需修改）

    ```sql
    ALTER USER u1 PASSWORD 'old_password';
    ```

3.  配置pg_hba.conf的认证方式为sha256

    ```bash
    vb_guc set -D $数据目录 -h "host all all 0.0.0.0/0 sha256"  # 第1列host表示是远程连接，如果是local表示本机连接。如果改成local，初始用户也要输密码。
    ```

4.  使用postgresql client与数据建立连接，可连接成功

# 测试

```bash
gs_guc reload -D $GAUSSHOME/data -c "password_encryption_type=0"
gsql -d postgres -c "CREATE USER u0 PASSWORD 'u0.password'"

gs_guc reload -D $GAUSSHOME/data -c "password_encryption_type=1"
gsql -d postgres -c "CREATE USER u1 PASSWORD 'u1.password'"

gs_guc reload -D $GAUSSHOME/data -c "password_encryption_type=2"
gsql -d postgres -c "CREATE USER u2 PASSWORD 'u2.password'"

gs_guc reload -D $GAUSSHOME/data -c "password_encryption_type=3"
gsql -d postgres -c "CREATE USER u3 PASSWORD 'u3.password'"

gsql -d postgres -c "SELECT rolname,length(rolpassword),rolpassword FROM pg_authid WHERE rolname in ('u0', 'u1', 'u2', 'u3')"

gs_guc reload -D $GAUSSHOME/data -h "local all all sha256"
gsql -d postgres -U u0 -W 'u0.password' -c "SELECT 1"
gsql -d postgres -U u1 -W 'u1.password' -c "SELECT 1"
gsql -d postgres -U u2 -W 'u2.password' -c "SELECT 1"
gsql -d postgres -U u3 -W 'u3.password' -c "SELECT 1"

psql -d postgres -U u0 -W 'u0.password' -c "SELECT 1"
psql -d postgres -U u1 -W 'u1.password' -c "SELECT 1"
psql -d postgres -U u2 -W 'u2.password' -c "SELECT 1"
psql -d postgres -U u3 -W 'u3.password' -c "SELECT 1"

gs_guc reload -D $GAUSSHOME/data -c "password_encryption_type=2"
gsql -d postgres -c "CREATE USER u0 PASSWORD 'u2.password'"
gsql -d postgres -c "CREATE USER u1 PASSWORD 'u2.password'"
gsql -d postgres -c "CREATE USER u2 PASSWORD 'u2.password'"
gsql -d postgres -c "CREATE USER u3 PASSWORD 'u2.password'"
gsql -d postgres -c "SELECT rolname,length(rolpassword),rolpassword FROM pg_authid WHERE rolname in ('u0', 'u1', 'u2', 'u3')"
```

# 操作流程

当前版本，主要支持的场景是：除了md5认证外，postgresql驱动可通过其他认证方式连接vastbase。为支持该需求，vastbase服务端新增一种认证方式：scram-sha256，该方式与原来的 sha256 存在多个差异，可看做是一种全新的认证方式。

1.  生成 scram-sha256 密码

    -   方式一：通过guc控制

        ```bash
        gs_guc reload -D $PGDATA -c "password_encryption_type=4" # 4 表示使用 scram-sha256 加密，加密结果与原型的 sha256 差异较大
        ```

        ```sql
        CREATE USER u1 PASSWORD 'u1.password';
        ```

    -   方式二：通过语法控制

        ```sql
        CREATE USER u1 PASSWORD 'u1.password' STORED 'scram-sha256';
        ```

        在pg_authid中，u1的密码将使用scram-sha256加密存储。使用vastbase的客户端，无法登录u1用户（暂未适配，如有需求，可适配）。只有postgresql的客户端，才能登录u1用户。

        ```sql
        SELECT rolname,rolpassword FROM pg_authid;
             rolname             |         rolpassword
        -------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------
          sha256_user            | sha256af99537f242c661a88acea99ac626a2cf8fe196ac5671db6f02ed6818b420cf84e7ada61d66602c6eb5bf4ced40911d3f51865959784ebc3b0d385ca4c08f3398f05e16268fe9acc95a2d662bf5033b15d53abd1f835c1a3f1e96343a5cbf800ecdfecefade
          scram_sha256_user      | SCRAM-SHA-256$4096:sp5V1hrLKzLsS4HtQgqTuA==$QO/UVdrXxIypzBEGqEuIWe96A80elghFQs25ZbdPsLg=:J4lPXmXPANtTMOkaHokMjmM19K1Di7fU6WRWuZ5VmS0=
        ```

2.  配置 scram-sha256 认证  
    用户需主动在pg_hba.conf中，配置scram-sha256认证。  
    当有客户端与vastbase建立连接时，vastbase无法识别客户端属于vastbase还是postgresql。因此，只有pg_hba.conf中配置scram-sha256时，客户端才会与指定用户采用scram-sha256认证方式。

    ```bash
    gs_guc reload -D $PGDATA -h "local all u1 scram-sha256"
    ```

3.  使用 scram-sha256 连接  
    使用scram-sha256时，需确保三者保持配套关系：生成的密码类型、pg_hba.conf配置、数据库驱动端类型

    | 服务端类型 | CREET USER 密码类型 | pg_hba.conf 认证类型 | 客户端类型（vsql or psql） | 结果 | 备注 |
    | --- | --- | --- | --- | --- | --- |
    | vastbase | sha256 | sha256 | vastbase | 成功 | 标准场景 |
    | vastbase | scram-sha256 | scram-sha256 | postgresql | 成功 | 新增需求，除了md5算法外，postgresql可连接vastbase |
    | vastbase | sha256 | sha256 | postgresql | 失败 | 客户现状，除了md5算法外，postgresql驱动无法连接vastbase |
    | vastbase | sha256 | scram-sha256 | postgresql | 失败 | 需求约束，客户已有sha256密码，仅配置pg_hba.conf，无法使用postgresql驱动连vastbase |
    | vastbase | scram-sha256 | sha256 | postgresql | 失败 | 需求约束，即使生成scram-sha256密码，未配置pg_hba.conf，vastbase无法自动识别驱动类型 |
    | vastbase | sha256 | scram-sha256 | vastbase | 失败 | 需求约束，vastbase驱动暂未支持scram-sha256算法 |
    | vastbase | scram-sha256 | sha256 | vastbase | 失败 | 需求约束，vastbase驱动暂未支持scram-sha256算法 |
    | vastbase | scram-sha256 | scram-sha256 | vastbase | 失败 | 需求约束，vastbase驱动暂未支持scram-sha256算法（如有需求，可支持） |

-   vastbse 身份认证协议

    ```bash
    client (vastbase libpq)  
    +-------+---------------------+-----------------+---------------------------------------------------------------------------+
    | int 0 | int protocolversion | string user database replication [backend_version] options [connect_timeout] [env] [其他参数]| -->
    +-------+---------------------+---------------------------------------------------------------------------------------------+

                                                                        server (vastbase sha256)：从pg_hba.conf中，选择认证方式
                                                                        +----------+--------+-------+-----------------+-----------------+---------------+
                                                                   <--- | char 'R' | int 10 | int 2 | string(32) salt | string(8) token | int iteration |
                                                                        +----------+--------+-------+-----------------+-----------------+---------------+
                                                                            1          2        3           4
                                                                        - 1
                                                                        - 2：使用的算法类型：10 表示 sha256
                                                                        - 3: 系统表中存储的算法类型：2 表示 sha256
                                                                        - 4
    ```

-   postgresql 身份认证协议

    ```bash
    client (postgresql libpq)
    +-----------------------------+-----------------+----------------------------------------+
    | int 0 | int protocolversion | string user database replication options [env] [其他参数] | -->
    --------+---------------------+----------------------------------------------------------+

                                                                        server (postgresql scram-sha256)：从pg_hba.conf中，选择认证方式
                                                                        +----------+--------+-------------------------+
                                                                   <--- | char 'R' | int 10 | string 'SCRAM-SHA256'   |  
                                                                        +----------+--------+------+------------------+
    ```

# 验证

1.  ```bash
    gs_guc reload -D $GAUSSHOME/data -c "password_encryption_type=2"
    gs_guc reload -D $GAUSSHOME/data -h "local all all sha256"
    ```

2.  ```sql
    CREATE USER u1 PASSWORD 'u1.pass1';
    SELECT rolname,rolpassword FROM pg_authid;
    ```

3.  ```bash
    psql -d postgres -U u1 -W 'u1.pass1'
    ```

# rfc 5802

```bash
# 阶段一：生成密码
client                                server
----------------------------------------+----------------
| 1. send(password)  --->               |
                                        | 2. salt = generate()
                                        | 3. saltpass = sha256(password, salt, iteration=4096)
                                        | 4. clientkey = hmac(saltpass, 'Client Key')
                                        | 5. storedkey = sha256(clientkey)
                                        | 6. serverkey = hmac(saltpass, 'Server Key')
                                        | 7. store(salt, iteration, storedkey, serverkey)
                                        | # 'SCRAM-SHA-256$iteration:base64(salt)$base64(storedkey):serverkey'

# 阶段二：验证密码
client                                                server
--------------------------------------------------------+----------------
| 1. generate(clientnonce)                              |
| 2. send(clientnonce) --->                             |
                                                        | 3. find(salt, iteration, storedkey, serverkey)
                                                        | 4. generate(servernonce)
|            5. <--- send(servernonce, salt, iteration) |
| 6. saltpass = sha256(password, salt, iteration=4096)
| 7. clientkey = hmac(saltpass, 'Client Key')
| 8. storedkey = sha256(clientkey)
| 9. clientsign = hmac(storedkey, clientnonce, servernonce)
| 10. clientproof = xor(clientkey, clientsign)
| 11. send(clientproof) --->                            |
                                                        | 12. clientsign = clientsign = hmac(storedkey, clientnonce, servernonce)
                                                        | 13. _clientkey = xor(clientproof, clientsign)
                                                        | 14. _storedkey = sha256(_clientkey)
                                                        | 15. check(storedkey, _storedkey)
```

# postgresql

## 使用sha256

```bash
password_encryption = 'scram-sha-256'
```

## sha256格式

```python
CreateRole
    encrypt_password
        get_password_type
        pg_be_scram_build_verifier
            pg_saslprep # 1 处理非ascii字符
                pg_is_ascii_string
            pg_backend_random # 生成16字节随机数，作为salt
            scram_build_verifier
                scram_SaltedPassword # 使用sha256(password，salt)，计算hmac，迭代4096次，等于PBKDF2，输出saltpass，
                    scram_HMAC_init
                    scram_HMAC_update
                scram_ClientKey # 使用(saltpass，'Client Key')，计算hmac，输出storedkey
                    scram_HMAC_update
                scram_H # 计算storedkey的sha256，仍输出storedkey
                    pg_sha256_update
                scram_ServerKey # 使用 (saltpass, 'Server Key')，计算hmac，输出serverkey
                    scram_HMAC_update
                # 拼接结果
                # SCRAM-SHA-256${迭代次数}:base64(salt)$base(storedkey):serverkey
```

示例：

```SQL
SELECT rolpassword FROM pg_authid WHERE rolname = 'u1';
                                                   rolpassword
 ---------------------------------------------------------------------------------------------------------------------------------------
 SCRAM-SHA-256$4096:s44zkBNiF7EYfIjemotD3w==$Rl9Pr4CbgF1UkLgJuMKyhmzn3lVaBI6JCfpB8yF9hc4=:GD3dLK/+DpyVxJRLJnUWtbgzl/S2JXkCETSB5pDNF7A=
```

| 类型 | 内容 |
| --- | --- |
| 算法标识 | SCRAM-SHA-256 |
| 拼接符 | $ |
| 迭代次数 | 4096 |
| 拼接符 | : |
| base64格式的salt（16字节随机数） | s44zkBNiF7EYfIjemotD3w== |
| 拼接符 | $ |
| base格式的sha256(hmac(PBKDF2(salt, password, 迭代次数), ‘Client Key’)) | Rl9Pr4CbgF1UkLgJuMKyhmzn3lVaBI6JCfpB8yF9hc4= |
| 拼接符 | : |
| base格式的hmac(PBKDF2(salt, password, 迭代次数), ‘Server Key’) | GD3dLK/+DpyVxJRLJnUWtbgzl/S2JXkCETSB5pDNF7A= |

```python
# pg10
PostmasterMain # postmaster 线程
    ServerLoop
        ConnCreate
        BackendStartup
            BackendInitialize
            BackendRun
                PostgresMain # postgres 线程
                    InitPostgres
                        PerformAuthentication
                            ClientAuthentication
                                hba_getauthmethod
                                    CheckPWChallengeAuth
                                        get_role_password # 从pg_authid系统表中查询ropassword
                                        get_password_type # 从rolpassword中获取前缀
                                        CheckSCRAMAuth
                                            sendAuthRequest
                                            pg_be_scram_init
                                                parse_scram_verifier # 从rolpassword中，根据拼接符，依次获取各个子参数，并进行base64解码
                                                    strtok
                                                    pg_b64_decode
                                            pq_getbyte('p') # 接受客户端消息
                                            pg_be_scram_exchange
                                                read_client_first_message
                                                build_server_first_message
                                            sendAuthRequest
                    for (;;)
                        ReadCommand
```

# vasebase

## 阶段一：存储密码

```python
CreateRole
    RAND_priv_bytes # 生成32字节salt
    calculate_encrypted_password
        pg_sha256_encrypt # 计算 sha256(salt, password, 迭代次数)，迭代次数可配置，默认为10000
            PKCS5_PBKDF2_HMAC # PBKDF2(password, salt, 迭代次数)，使用sha1算法，输出k
            CRYPT_hmac
                HMAC # 计算sha256(k, 'Sever Key')，输出serverkey
            CRYPT_hmac
                HMAC # 计算sha256(k, 'Client Key')，输出clientkey
            EVP_Digest # 计算 sha256(client_key)，输出stored_key
            # 拼接结果
            # sha256{hex(salt)}{hex(serverkey)}{hex(stored_key)}
    encode_iteration
        # 在结果后拼接 hex(迭代次数)
```

```bash
client                                         server
+-----------------------------------------------------+
| send($username)
                                                      | $mechanism = find('pg_authid')
                  send($are1=AUTH_REQ_SASL, $mechanism) |
| preprocess($password)
| $cleintnoce = random(18)
| $client_first_message_bare = ('n=,r=%s', $clientnonce)
| send('p', 'SCRAM-SHA-256', 'n,,n=,r=%s', $clientnonce)
                                                     | server_first_message = ('r=%s,s=%s,i=%s', servernoce, salt, iteration)
                    send(areq=AUTH_REQ_SASL_CONT, $server_first_message)
| client_final_message_without_proof [c=biws,r=fhbF8xOmYuU9fjiMvMq/7sDjWMoEswVp/GzaslfJ7psvSGKx]
```

## 阶段二：验证密码

```python
# pg
PQconnectdb
    PQconnectStart
        connectOptions1
        connectOptions2
        connectDBStart
            PQconnectPoll
                keep_going:
                    if CONNECTION_NEEDED: # 1 建立连接
                        connect
                        set CONNECTION_STARTED
                    elif CONNECTION_STARTED: # 2 获取连接信息
                        getsockopt
                        getsockname
                        set CONNECTION_MADE
                    elif CONNECTION_MADE: # 3 填充用户信息：user, database等
                        pqBuildStartupPacket3
                            build_startup_packet
                        pqPacketSend
                        set CONNECTION_AWAITING_RESPONSE
                    elif CONNECTION_AWAITING_RESPONSE # 走到该状态好几次
                        pqGetc # get R or E, R是身份认证
                        pqGetInt # get length
                        pqGetInt # get auth type: [AUTH_REQ_OK, AUTH_REQ_MD5, AUTH_REQ_PASSWORD, AUTH_REQ_SASL, AUTH_REQ_SASL_CONT, AUTH_REQ_SASL_FIN, AUTH_REQ_SCM_CREDS]
                        pg_fe_sendauth
                            if AUTH_REQ_SASL:
                                pg_SASL_init
                                    pqGets # get mechanism, only support: "SCRAM-SHA-256"
                                    pg_fe_scram_init
                                        pg_saslprep # 处理password中的特殊字符为 UTF-8
                                    pg_fe_scram_exchange # 第一次调用，仅处理build_client_first_message
                                        build_client_first_message # 1 生成客户端 clientnonce
                                            pg_frontend_random # 生成18字节随机数 clientnonce
                                            pg_b64_enc_len # 编码 clientnonce
                                            client_first_message_bare = snprintf("n,n=,r=%s", clientnonce)
                            elif AUTH_REQ_SASL_CONT or AUTH_REQ_SASL_FIN:
                                pg_SASL_continue
                                    pg_fe_scram_exchange
                                        read_server_first_message # 2 接受服务端 (servernoce, salt, iteration)
                                                server_first_message = receive('r=%s%s,s=%s,i=%u', clientnoce, servernoce, salt, iteration)
                                                read_attr_value('r') # 获取服务端 servernoce
                                                read_attr_value('s') # 获取服务端 salt
                                                read_attr_value('i') # 获取服务端 iteration
                                            build_client_final_message # 结算
                                                appendPQExpBuffer('c=biws,r=%s', servernoce)
                                                client_final_message_without_proof = ('c=biws,r=%s', servernoce)
                                                calculate_client_proof
                                                    scram_SaltedPassword
                                                        hmac(password, salt, iteration) # 生成 saltpass
                                                    scram_ClientKey
                                                        hmac(saltpass, 'Client Key') # 生成 clientkey
                                                    scram_H
                                                        pg_sha256_update(clientkey) # 生成 storedkey
                                                    scram_HMAC_update(storedkey, client_first_message_bare, server_first_message, client_final_message_without_proof) # 生成 clientsign
                                                    clientproof = clientkey ^ clientsign
                                                appendPQExpBuffer(',p=%s', clientproof)
                                            read_server_final_message
                                                read_attr_value('v') # 获取服务端 serversign
                                            verify_server_signature
                                                scram_ServerKey
                                                    pg_sha256_update(saltpass) # 输出serverkey
                                                    scram_HMAC_update(serverkey, client_first_message_bare, server_first_message, client_final_message_without_proof) # 输出 _serversign
                                                    memcpy(_serversign, servergin) # 比较 serversign与_serversign
                                        pqPacketSend
                            elif AUTH_REQ_SCM_CREDS:
                                pg_local_sendauth
                        set CONNECTION_AUTH_OK
    connectDBComplete
```

```python
# pg
PostmasterMain # postmaster 线程
    ServerLoop
        ConnCreate
            StreamConnection
        BackendStartup
            PostgresMain # postgres 线程
                InitBackendWorker
                    InitSession
                        CheckAuthentication
                            PerformAuthentication
                                port->protocol_config->fn_authenticate
                                    ClientAuthentication
                                        hba_getauthmethod
                                            check_hba
                                                g_instance.libpq_cxt_comm_parsed_hba_lines # 读取缓存的hba
                                                if init_user:
                                                    get_default_auth_method
                                                else:
                                                    check_hostname
                                        sendAuthRequest
                                        recv_and_check_password_packet # 接收客户端的password
                                            crypt_verify
                for (;;)
                    ReadCommand
                    exec_simple_query('SQL')
```
