+++
title = 'Vastbase SSL安全传输'
date = '2025-08-28T09:47:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['Vastbase', 'SSL']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 基于SSL证书实现身份认证

在应用与数据库传输数据时，为避免攻击者对数据进行窃听、篡改、伪造、重放等攻击，Vastbae支持采用SSL协议保障数据机密性与完整性。在SSL协议协商密钥的过程中，应用与数据库需通过证书验证对方身份，同时，该证书也可作为登入数据库的身份凭证。  
此处介绍生成证书，并基于证书配置SSL协议，同时基于证书实现身份认证，操作流程可分为以下3个阶段：

-   一、生成私钥与证书
-   二、数据库端配置证书与私钥
-   三、应用端配置证书与私钥

## 一、生成私钥与证书

此处介绍基于openssl工具，生成自签名证书的流程

1.  创建存放私钥与证书的文件夹

    ```bash
    mkdir cadir
    cd cadir
    mkdir ./demoCA ./demoCA/newcerts ./demoCA/private
    echo '01'>./demoCA/serial
    touch ./demoCA/index.txt
    ```

2.  配置openssl工具  
    从Vastbase安装包中，获取openssl工具以及openss配置文件。假设Vastbae安装包存放在$GAUSSHOME目录。

    ```bash
    cp $GAUSSHOME/bin/openssl ./
    export PATH=`pwd`:$PATH
    which openssl # 确保openssl来源于Vastbase安装包，避免因版本不同造成证书不可用
    openssl version

    cp $GAUSSHOME/share/sslcert/gsql/openssl.cnf ./
    export OPENSSL_CONF=`pwd`/openssl.cnf
    ```

3.  创建CA私钥、CA证书

    ```bash
    openssl ecparam -genkey -name SM2 -out demoCA/private/cakey.pem
    openssl req -new -config openssl.cnf -key demoCA/private/cakey.pem -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=CA -out cacert.req
    openssl ca -selfsign -config openssl.cnf -batch -keyfile demoCA/private/cakey.pem -in cacert.req -out demoCA/cacert.pem
    ```

4.  创建数据库私钥、数据库证书

    ```bash
    openssl ecparam -genkey -name SM2 -out server.key
    openssl req -new -config openssl.cnf -key server.key -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=server -out server.req
    openssl ca -config openssl.cnf -days 3650 -batch -in server.req -out server.crt
    ```

5.  创建应用端私钥、应用端证书  
    注意，在以下第2条命令中，-subj的参数中，CN的取值应与数据库用户名相等。此处假设用户名为u1，则应配置CN=u1

    ```bash
    openssl ecparam -genkey -name SM2 -out client.key
    openssl req -new -config openssl.cnf  -key client.key -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=u1 -out client.req
    openssl ca -config openssl.cnf -days 3650 -batch -in client.req -out client.crt
    ```

6.  设置私钥与证书文件权限

    ```bash
    chmod 600 client* server* ca* demoCA/ca*
    ```

## 二、数据库端配置证书与私钥

1.  创建新用户

    ```sql
    CREATE USER u1 PASSWORD 'u1.password';
    ```

2.  配置SSL证书  
    SSL协议支持使用多种加密与哈希算法保护传输数据，此处，通过配置ssl_ciphers参数可强制采用国密算法。  
    此处，假设数据库的数据目录为$VBDATA。

    ```bash
    vb_guc set -D $VBDATA -c "ssl=on"
    vb_guc set -D $VBDATA -c "require_ssl=on"
    vb_guc set -D $VBDATA -c "ssl_ciphers='ECDHE-ECDSA-SM4-CBC-SM3'"
    vb_guc set -D $VBDATA -c "ssl_cert_file='`pwd`/server.crt'"
    vb_guc set -D $VBDATA -c "ssl_key_file='`pwd`/server.key'"
    vb_guc set -D $VBDATA -c "ssl_ca_file='`pwd`/demoCA/cacert.pem'"
    ```

3.  开启远程登录

    ```bash
    vb_guc set -D $VBDATA -c "listen_addresses='*'"
    ```

4.  开启登录防火墙与配置基于证书的身份认证  
    在pg_hba.conf中，添加一行配置，确保该配置在所有host配置的第1行

    ```bash
    vi $VBDATA/pg_hba.conf
    # 添加一下1行
    hostssl all u1 0.0.0.0/0 cert
    ```

## 三、应用端配置证书与私钥

1.  配置私钥与证书  
    应用端可通过环境变量或连接参数配置私钥与证书

    ```bash
    export PGSSLMODE=verify-ca
    export PGSSLCERT=`pwd`/client.crt
    export PGSSLKEY=`pwd`/client.key
    export PGSSLROOTCERT=`pwd`/demoCA/cacert.pem
    ```

2.  登录数据库  
    采用基于证书的身份认证后，并启用SSL协议，客户端无需再使用基于密码的身份认证

    ```bash
    vsql -h localhost -p 5432 -U u1 -r
    ```

3.  ```bash
    # 1. 验证openssl版本（确保openssl来vastbase安装包，且是tassl版本）
    which openssl
    openssl version

    # 2. 搭建CA环境
    mkdir cadir
    cd cadir
    mkdir ./demoCA ./demoCA/newcerts ./demoCA/private

    echo '01'>./demoCA/serial
    touch ./demoCA/index.txt

    # 3. 创建CA私钥、CA证书
    openssl ecparam -genkey -name SM2 -out demoCA/private/cakey.pem
    openssl req -new -config openssl.cnf -key demoCA/private/cakey.pem -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=CA -out cacert.req
    openssl ca -config openssl.cnf -in cacert.req -keyfile demoCA/private/cakey.pem -selfsign -out demoCA/cacert.pem -batch

    # 4. 创建服务端私钥、服务端证书
    openssl ecparam -genkey -name SM2 -out server.key
    openssl req -new -config openssl.cnf -key server.key -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=server -out server.req
    openssl ca -config openssl.cnf -in server.req -out server.crt -days 3650 -batch # -md sm3

    # 5. 创建客户端私钥、客户端证书
    openssl ecparam -genkey -name SM2 -out client.key
    # (如果使用cert认证，-subj中，CN必须与用户名相等，比如我的用户名时u1)
    openssl req -new -config openssl.cnf  -key client.key -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=u1 -out client.req
    openssl ca -config openssl.cnf -in client.req -out client.crt -days 3650 -batch

    # 6. 设置权限
    chmod 600 client* server* ca* demoCA/ca*

    # 7. 客户端配置ssl
    export PGSSLCERT=`pwd`/client.crt
    export PGSSLKEY=`pwd`/client.key
    export PGSSLMODE=verify-ca
    export PGSSLROOTCERT=`pwd`/demoCA/cacert.pem

    # 8. 服务端配置ssl连接
    gs_guc set -D $GAUSSHOME/data -c "ssl=on"
    gs_guc set -D $GAUSSHOME/data -c "require_ssl=on"
    gs_guc set -D $GAUSSHOME/data -c "ssl_cert_file='`pwd`/server.crt'"
    gs_guc set -D $GAUSSHOME/data -c "ssl_key_file='`pwd`/server.key'"
    gs_guc set -D $GAUSSHOME/data -c "ssl_ca_file='`pwd`/demoCA/cacert.pem'"
    gs_guc set -D $GAUSSHOME/data -c "ssl_crl_file=''"

    # 9. 服务端配置远程连接
    gs_guc set -D $GAUSSHOME/data -c "listen_addresses = '*'"
    vi $GAUSSHOME/data/pg_hba.conf
    host all u1 0.0.0.0/0 sha256

    # 如果是cert认证，pg_hba.conf配置修改为：
    hostssl all all 0.0.0.0/0 cert
    ```

安全前提：（本例子中，正向计算为乘法，负向计算为除法，显然除法计算不难，此处只是为了方便解释如何计算密钥）  
攻击者通过网络流量，获取：4，120，80  
安全前提，攻击者无法逆向计算：120 / 4 = 30 或者 80 / 4 = 20

RSA：正向计算简单（大质数相乘）、负向计算非常难（大整数分解）

-   正向计算：9999991 \* 9999983 = 99999740000153
-   负向计算：将99999740000153分解为2个质数

```bash
client
  - 生成随机数 [client_random]
  - 生成随机私钥 [client_priv]
  - 计算公钥 [client_pub]
  - 发送 [client_random, client_pub] -->
                                        - 接收 [client_random, client_pub]
                                        - 生成随机数 [server_random]
                                        - 生成随机私钥 [server_priv]
                                        - 计算公钥 [server_pub]
                                        - 发送 [server_random, server_pub]
  - 生成密钥 [client_random, client_priv, server_random, server_pub]
                                        - 生成密钥 [server_random, server_priv, client_random, client_pub]

                                        原理：[client_priv, server_pub] = [server_priv, client_pub]
```

```bash
client
  - 生成随机数 [client_random]
  - 生成随机私钥 [client_priv] 3
  - 基于client_priv，计算公钥 [client_pub] 10 - 3 = 7
  - 发送 [client_random, client_pub] -->
                                        - 接收 [client_random, client_pub]
                                        - 生成随机数 [server_random]
                                        - 生成随机私钥 [server_priv] 1
                                        - 基于server_priv，计算公钥 [server_pub] 10 - 1 = 9
                                        - 发送 [server_random, server_pub]
  - 生成密钥 [client_random, client_priv, server_random, server_pub]
                                        - 生成密钥 [server_random, server_priv, client_random, client_pub]
```

3， 7  
9 1

3 + (10 - 1) = 12  
9 + (10 - 7) = 12

```bash
Client                                                               Server
==================================================================================
0️⃣  启动连接  
    本机产生 32 字节随机预随机 → 准备发 ClientHello  
    ------------------------------------------>

1️⃣  ClientHello 报文内容  
    - 协议版本：客户端最高支持的 TLS 版本号（如 1.2）  
    - ClientRandom：4 字节时间戳 + 28 字节真随机共 32 B  
    - 会话 ID：空（新会话）或旧会话票  
    - 密码套件列表：必须包含 ECDHE 族，如 TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256  
    - 压缩方法列表：通常只有 null  
    - 扩展：  
        – supported_groups：本机支持的椭圆曲线（secp256r1、secp384r1 …）  
        – ec_point_formats：支持未压缩/压缩点  
        – server_name：访问的域名（SNI）  
        – application_layer_protocol_negotiation：想谈 ALPN（h2、http/1.1 …）  
        – session_ticket：如果客户端有旧票  
    ------------------------------------------>

2️⃣  Server 收到 ClientHello 后，**一次性动作**  
    2a) 当场随机生成 32 字节 ServerRandom（4 字节时间戳 + 28 字节真随机）  
    2b) 当场随机生成 ECDHE 私钥 eS ∈ [1, n-1]（n 为曲线阶）  
    2c) 计算对应临时公钥 PubS = eS·G  
    2d) 选定最终协议版本、CipherSuite、曲线  
    2e) 组装以下四条报文一次性发回  

    <------------------------------------------
    ┌─ ServerHello 报文  
    │   - 协议版本：最终协商的 TLS 版本  
    │   - ServerRandom：32 B 随机数  
    │   - CipherSuite：最终选定的算法套件  
    │   - CompressionMethod：null  
    │   - SessionID：服务器决定的新会话 ID  
    │   - 扩展：选定的曲线、点格式、ALPN 结果等  
    ├─ Certificate 报文  
    │   - 服务器证书链（叶子证书 + 可选中间证书）  
    │   - 叶子证书含 RSA/ECDSA 公钥，KeyUsage 含数字签名  
    ├─ ServerKeyExchange 报文  
    │   - 曲线参数：曲线名 secp256r1  
    │   - PubS：服务器临时 ECDHE 公钥（未压缩或压缩点）  
    │   - Signature：对“曲线参数 || PubS || ClientRandom || ServerRandom”  
    │     用服务器私钥做的数字签名（算法与证书匹配）  
    ├─ CertificateRequest 报文（双向认证必发）  
    │   - certificate_types：要求 RSA 或 ECDSA 证书  
    │   - signature_algorithms：可接受的签名算法列表  
    │   - certificate_authorities：服务器信任的 CA 可打印名列表  
    └─ ServerHelloDone 报文（空结构，仅表示“我发完了”）

【★Client 校验服务器身份】  
3️⃣  Client 收到后  
    3a) **当场随机生成 ECDHE 私钥 eC ∈ [1, n-1]**  
    3b) 计算对应临时公钥 PubC = eC·G  
    3c) **逐张检查服务器证书链**  
        - 有效期、KeyUsage、吊销状态（CRL/OCSP）、域名匹配  
    3d) **用服务器证书公钥验证 ServerKeyExchange 中的签名**  
        - 验证失败直接发 Alert 断开  
    3e) **计算共享密钥**  
        Pre-Master Secret = 椭圆曲线点乘 eC·PubS 的 x 坐标  
    3f) 组装以下报文一次性发出  

    ------------------------------------------>
    ┌─ Certificate 报文（双向认证时发）  
    │   - 客户端证书链（叶子证书 + 可选中间证书）  
    │   - 叶子证书含 RSA/ECDSA 公钥，KeyUsage 含数字签名  
    ├─ ClientKeyExchange 报文  
    │   - PubC：客户端临时 ECDHE 公钥  
    ├─ CertificateVerify 报文（若发了客户端证书，必发）  
    │   - Signature：对“到此为止所有握手消息哈希”  
    │     用客户端私钥做的数字签名（算法与证书匹配）  
    ├─ ChangeCipherSpec 报文（单字节 0x01）  
    │   - 含义：以后我用协商密钥加密  
    └─ Finished 报文  
        - 用刚刚算出的主密钥对“全部握手消息”做 HMAC，验证完整性

【★Server 校验客户端身份】  
4️⃣  Server 收到后  
    4a) **逐张检查客户端证书链**  
        - 有效期、KeyUsage、吊销状态、ACL 匹配  
    4b) **用客户端证书公钥验证 CertificateVerify 中的签名**  
        - 验证失败直接发 Alert 断开  
    4c) **计算共享密钥**  
        Pre-Master Secret = 椭圆曲线点乘 eS·PubC 的 x 坐标  
        （与 Client 值必然相同）  
    4d) **PRF 派生主密钥**  
        Master Secret = PRF(Pre-Master, "master secret", ClientRandom || ServerRandom)  
    4e) **PRF 再次派生 6 把会话密钥/IV**  
        - client_write_key、server_write_key  
        - client_write_MAC_key、server_write_MAC_key  
        - client_write_IV、server_write_IV  
    4f) 组装以下报文一次性发回  

    <------------------------------------------
    ┌─ ChangeCipherSpec 报文（单字节 0x01）  
    └─ Finished 报文  
        - 用协商密钥对“全部握手消息”做 HMAC，验证完整性

5️⃣  双方各自校验对端 Finished 的 HMAC  
    通过 → 握手成功  
    失败 → Alert(fatal) 立即断开

6️⃣  应用数据阶段  
    - 所有后续记录层消息使用 AEAD（如 AES-128-GCM）加密  
    - 每条记录含序列号、类型、长度、密文、认证标签  
    - 任何 MAC 校验错误 → Alert(fatal) 立即中断
```

```bash
Client                                                               Server
==================================================================================
0️⃣  启动连接
    本地随机生成 32 B 预随机
    ------------------------------------------>

1️⃣  ClientHello
    - TLS 版本、CipherSuites（本次必须含 TLS_RSA_WITH_*）
    - ClientRandom (32 B)
    - 可选 SNI / ALPN / 会话票
    ------------------------------------------>

2️⃣  Server 收到
    - 选 TLS 版本、CipherSuite（TLS_RSA_*）
    - 当场随机生成 ServerRandom
    - 取自己 RSA 证书链 CertS（含 RSA 公钥 PubS）
    - 决定要求客户端证书 → 置 CertificateRequest
    <------------------------------------------
    ServerHello
    Certificate (CertS)        ← 仅含 RSA 公钥，无临时 ECDHE 参数
    CertificateRequest*        ← 双向认证时发送
    ServerHelloDone

【★Client 校验 Server 证书】
3️⃣  Client 收到后
    3a) 解析 CertS 链
        - 逐级检查签名、有效期、KeyUsage = keyEncipherment
        - 查 CRL / OCSP / 本地缓存
        - 把叶子证书与 SNI / URL 域名比对
    3b) 任一步失败 → Alert(fatal) 中断
    3c) 当场随机生成 48 B 的 Pre-Master Secret
    3d) 用 PubS 对其进行 RSAES-PKCS1-v1_5 或 RSAES-OAEP 加密，
        得到 EncryptedPreMasterSecret

4️⃣  Client 发送
    - 自己的证书链 CertC（含 RSA 公钥）
    - EncryptedPreMasterSecret
    - CertificateVerify
        - 签名 = Sign(握手消息哈希)
          用 CertC 对应私钥
    ------------------------------------------>
    ClientKeyExchange
        - EncryptedPreMasterSecret
    Certificate (CertC)
    CertificateVerify
    ChangeCipherSpec
    Finished

【★Server 校验 Client 证书】
5️⃣  Server 收到后
    5a) 解析 CertC 链
        - 逐级检查签名、有效期、KeyUsage = digitalSignature
        - 查 CRL / OCSP / 本地 ACL
    5b) 用 CertC 的公钥验证 CertificateVerify
    5c) 任一步失败 → Alert(fatal) 中断
    5d) 用本地 RSA 私钥解密 EncryptedPreMasterSecret
        得到与 Client 完全相同的 48 B Pre-Master
    5e) PRF(Pre-Master, ClientRandom, ServerRandom)
        → Master Secret (48 B)
        → 6 个对称密钥/IV

    <------------------------------------------
    ChangeCipherSpec
    Finished

6️⃣  双方独立派生密钥
    PRF 展开 → client_write_key / server_write_key 等
    后续记录层全部 AEAD 加密

7️⃣  应用数据阶段
    Client 写：AEAD-加密
    Server 写：AEAD-加密
    Finished 校验失败 → Alert(fatal) 立即中断
```
