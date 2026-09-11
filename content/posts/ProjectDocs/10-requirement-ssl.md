+++
title = '海量 10 需求 SSL协议'
date = '2025-09-03T11:07:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['SSL', '需求文档']
weight = 1000
ShowToc = true
TocOpen = true
+++
# 1 简介

## 1.1 目的

在应用与数据库传输数据时，为避免攻击者对数据进行窃听、篡改、伪造、重放等攻击，Vastbase支持采用TLS协议保障数据机密性与完整性。  
通过TLS协议，应用传输数据指至服务端路程如下：

1.  建立连接：与数据建立TCP连接
2.  生成密钥(TLS)：采用TLS协议协商生成密钥(连接级)
3.  加密数据(TLS)：使用密钥加密数据(SQL等)
4.  发送数据：通过TCP协议，发送数据密文至数据库

客户可能采用第三方工具，截取网络流量，获取传输中的SQL等数据，进行流量审计。但是，在使用TLS协议的情况下，网络中的数据是密文形式，无法进行流量审计。为解决该问题，本文介绍如何让第三方工具获取密钥，以解密网络中的数据密文。

## 1.2 适用范围

本文适用于3.0.8 psu4以之后版本。未来本需求将同步至2.2.15版本。

## 1.3 术语定义、首字母缩写词和缩略语

-   SSL: Secure Sockets Layer，于保障网络通信安全的加密协议，早期协议，存在设计缺陷，目前由TLS协议替代。但是，SSL也可不特指SSL协议，可泛指所有通信安全加密协议。同时，由于历史原因，以及前向兼容，数据库中的很多参数与接口采用SSL命令，实际使用的是TLS协议。无需纠结TLS与SSL差异，vastbase中SSL等于TLS。
-   TLS: Transport Layer Security，更安全的传输加密协议。早期版本1.0,1.1已不安全，主流版本为1.2,1.3。

## 1.3 参考资料

-   原始需求：[https://www.tapd.cn/tapd_fe/60475194/story/detail/1160475194001084569](https://www.tapd.cn/tapd_fe/60475194/story/detail/1160475194001084569)
-   openssl支持的所有cipers： [https://docs.openssl.org/3.0/man1/openssl-ciphers/](https://docs.openssl.org/3.0/man1/openssl-ciphers/)
-   ssl与tls原理：博客写了一点点，没整理

# 2 TLS协议支持第三方流量审计

## 2.1 功能简述

【需求现状】  
目前，大部分第三方流量审计工具，可在一些特定场景下，解密由TLS协议加密后的数据。以vastbase为例，使用TLS协议分为以下阶段：

1.  生成证书、私钥文件
2.  vastbase端配置证书、私钥文件
3.  vsql端配置证书、私钥文件
4.  vsql连接vastbase  
    4.1 建立tcp连接  
    4.2 使用证书校验对方身份  
    4.3 双发协商选择算法套件：包括密钥生成协议、加密算法等  
    4.4 双方协商生成密钥
5.  vsql与vastbase传输数据  
    5.1 发送数据前，使用密钥加密数据  
    5.2 发送数据密文  
    在4.3步骤中，可配置不同的密钥生成协议，对于其中一部分协议，在步骤4.4中，第三方工具可获取密钥，第步骤5.2中，第三方工具截取数据密文后，即可解密数据。  
    但是，4.3步骤中，目前vastbase仅支持2种密钥生成协议，这2种协议都无法让第三方工具获取密钥。

【密钥生成协议】  
此处介绍2类常见的密钥生成协议：

-   一、DHE密钥协商协议  
    Vastbase目前支持的2种协议，都属于此类协议

    ```bash
    client                                    server
    +-------------------------------------------+-----------------------------------
    |  <-------- 0. 双方随机约定一些参数 ------>  |
    | 1. 生成随机私钥 client_priv
    | 2. 基于client_priv，计算公钥 client_pub
    | 3. 发送公钥 client_pub ------------>
                                                | 4. 接收公钥 client_pub
                                                | 5. 生成随机私钥 server_priv
                                                | 6. 基于server_priv，计算公钥 server_pub
                                <------------   | 7. 发送公钥 server_pub
    | 8. 接收公钥 server_pub
    | 9. 基于client_priv，server_pub，计算密钥
                                                | 10. 基于server_priv，client_pub，计算密钥
    （第9步和第10步，可以计算出相同的密钥）

    简单举个例子
    client                                    server
    +-------------------------------------------+-----------------------------------
    |  <----- 0. generate and send (2,11) ----> |
    | 1. generate 8
    | 2. caculate (8 * 2) % 11 = 5
    | 3. send 5 ---------->  
                                                | 4. receive 5
                                                | 5. generate 10
                                                | 6. caculate (10 * 2) % 11 = 9
                                <------------   | 7. send 9
    | 8. receive 9
    | 9. key = (8 * 9) % 11 = 6
                                                | 10. key = (10 * 5) % 11 = 6

    攻击者：截获网络流量，获取2,11,5,9，无法计算出密钥为6
    ```

-   二、RSA密钥交换协议  
    该协议支持第三方工具解密流量，客户选择的工具已适配该协议。TLS还支持其他PSK、SRP等协议，但是，由于这些协议比较少见，且客户选择的工具未适配，本次不适配其他协议。

    ```bash
    client                                    server
    +-------------------------------------------+-----------------------------------
                                                | 1. 提前配置私钥、公钥 server_priv, server_pub
                                <------------   | 2. 发送公钥 server_pub
    | 3. 生成密钥 key
    | 4. 使用公钥加密密钥 enc_key = enncrypt(key, server_pub)
    | 5. 发送密钥 enc_key  -------->
                                                | 6. 接收密钥 enc_key
                                                | 7. 解密密钥 key = decrypt(enc_key, server_priv)

    攻击者：截获网络流量，获取公钥server_pub, 加密后的enc_key，因为没有私钥，无法解密得到key
    第三方工具：如果提前拿到server_priv，并且截获网络流量获取en_key，则可解密得到key
    ```

【TLS算法套件】  
TLS协议主要提供4个功能：

-   身份认证（基于证书）
-   密钥生成（对称密钥）
-   数据机密性（对称加密）
-   数据完整性

用户使用TLS协议时，可选择不同算法套件，不同算法套件中，上述4个功能采用的协议或算法不同。  
openssl 1.1.1n支持的算法套件有100+种，在编译libssl.so时，裁剪一些冷门的、不安全的算法套件后，vastbase使用的openssl支持60种。（执行openssl ciphers -v或者-v ‘ALL:eNULL’可查看）

-   内核已支持以下几种：

    1.  ECDHE-ECDSA-AES256-GCM-SHA384
    2.  ECDHE-RSA-AES256-GCM-SHA384
    3.  DHE-RSA-AES256-GCM-SHA384
    4.  ECDHE-ECDSA-AES128-GCM-SHA256
    5.  DHE-RSA-AES128-GCM-SHA256
    6.  ECDHE-RSA-AES128-SHA256
    7.  ECDHE-ECDSA-SM4-CBC-SM3
    8.  4个仅tassl支持的国密算法套件
-   客户选择的第三方工具，支持7种：

    | 编号 | 算法套件 | 代码定义 | 支持情况 |
    | --- | --- | --- | --- |
    | 1 | AES256-SHA256 | TLS_RSA_WITH_AES_256_CBC_SHA256 | 可支持 |
    | 2 | AES128-SHA256 | TLS_RSA_WITH_AES_128_CBC_SHA256 | 可支持 |
    | 3 | DES-CBC3-SHA | TLS_RSA_WITH_3DES_EDE_CBC_SHA | 含不安全算法3des，vastbase依赖的libssl.so编译裁剪 |
    | 4 | DES-CBC3-SHA | SSL_RSA_WITH_3DES_EDE_CBC_SHA | 含不安全算法3des，vastbase依赖的libssl.so编译裁剪 |
    | 5 | AES256-SHA | SSL_RSA_WITH_AES_256_CBC_SHA | 含不安全算法sha1，可支持，不建议支持 |
    | 6 | AES128-SHA | TLS_RSA_WITH_AES_128_CBC_SHA | 含不安全算法sha1，可支持，不建议支持 |
    | 7 | AES256-GCM-SHA256 | TLS_RSA_WITH_AES_256_GCM_SHA256 | 找不到，只有AES256-GCM-SHA384、AES128-GCM-SHA256 |

    客户提的几种看起来取名简单，和之前的风格不同，但这是openssl取的，这些名称都直接传递给libssl.so，openssl迭代过很多版本，执行openssl cipher -v显示的对应的名称就是以下4个。

    7种算法套中：

    -   第1、2种，算法是安全的，协议不太安全，但符合标准，整体算是安全的，可以不用参数控制
    -   第2，3种，算法非常不安全，我们的openssl都完全不支持
    -   第4，5种，算法不安全，如果要支持，需要参数控制
    -   第7种，找不到

    客户的要求，第三方工具能解密数据，因此只需至少支持其中1种即可，无需全都支持。  
    客户提出的7种，本次支持2种。另外，还有2种客户未提出，但也满足条件，疑似是第7种，使用GCM加密模式，性能更高，本次也支持：

    -   AES128-SHA256
    -   AES256-SHA256
    -   AES128-GCM-SHA256
    -   AES256-GCM-SHA384  
        （代码中的定义分别为：TLS1_TXT_RSA_WITH_AES_128_SHA256、TLS1_TXT_RSA_WITH_AES_256_SHA256、TLS1_TXT_RSA_WITH_AES_128_GCM_SHA256、TLS1_TXT_RSA_WITH_AES_256_GCM_SHA384）

以下是vastbase libssl.so支持的60种完整算法套件，仅供参考：

| # | Cipher Suite | Protocol | Kx | Au | Enc | Mac | 内核支持 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | AES128-GCM-SHA256 | TLSv1.2 | RSA | RSA | AESGCM(128) | AEAD | 满足条件，本次支持 |
| 2 | AES128-SHA | SSLv3 | RSA | RSA | AES(128) | SHA1 | 客户提出，不安全 |
| 3 | AES128-SHA256 | TLSv1.2 | RSA | RSA | AES(128) | SHA256 | 客户提出，本次支持 |
| 4 | AES256-GCM-SHA384 | TLSv1.2 | RSA | RSA | AESGCM(256) | AEAD | 满足条件，本次可支持 |
| 5 | AES256-SHA | SSLv3 | RSA | RSA | AES(256) | SHA1 | 客户提出，不安全 |
| 6 | AES256-SHA256 | TLSv1.2 | RSA | RSA | AES(256) | SHA256 | 客户提出，本次支持 |
| 7 | DHE-PSK-AES128-CBC-SHA | SSLv3 | DHEPSK | PSK | AES(128) | SHA1 |  |
| 8 | DHE-PSK-AES128-CBC-SHA256 | TLSv1 | DHEPSK | PSK | AES(128) | SHA256 |  |
| 9 | DHE-PSK-AES128-GCM-SHA256 | TLSv1.2 | DHEPSK | PSK | AESGCM(128) | AEAD |  |
| 10 | DHE-PSK-AES256-CBC-SHA | SSLv3 | DHEPSK | PSK | AES(256) | SHA1 |  |
| 11 | DHE-PSK-AES256-CBC-SHA384 | TLSv1 | DHEPSK | PSK | AES(256) | SHA384 |  |
| 12 | DHE-PSK-AES256-GCM-SHA384 | TLSv1.2 | DHEPSK | PSK | AESGCM(256) | AEAD |  |
| 13 | DHE-RSA-AES128-GCM-SHA256 | TLSv1.2 | DH | RSA | AESGCM(128) | AEAD | 已支持 |
| 14 | DHE-RSA-AES128-SHA | SSLv3 | DH | RSA | AES(128) | SHA1 |  |
| 15 | DHE-RSA-AES128-SHA256 | TLSv1.2 | DH | RSA | AES(128) | SHA256 |  |
| 16 | DHE-RSA-AES256-GCM-SHA384 | TLSv1.2 | DH | RSA | AESGCM(256) | AEAD | 已支持 |
| 17 | DHE-RSA-AES256-SHA | SSLv3 | DH | RSA | AES(256) | SHA1 |  |
| 18 | DHE-RSA-AES256-SHA256 | TLSv1.2 | DH | RSA | AES(256) | SHA256 |  |
| 19 | DHE-RSA-CHACHA20-POLY1305 | TLSv1.2 | DH | RSA | CHACHA20/POLY1305(256) | AEAD |  |
| 20 | ECDHE-ECDSA-AES128-GCM-SHA256 | TLSv1.2 | ECDH | ECDSA | AESGCM(128) | AEAD | 已支持 |
| 21 | ECDHE-ECDSA-AES128-SHA | TLSv1 | ECDH | ECDSA | AES(128) | SHA1 |  |
| 22 | ECDHE-ECDSA-AES128-SHA256 | TLSv1.2 | ECDH | ECDSA | AES(128) | SHA256 |  |
| 23 | ECDHE-ECDSA-AES256-GCM-SHA384 | TLSv1.2 | ECDH | ECDSA | AESGCM(256) | AEAD | 已支持 |
| 24 | ECDHE-ECDSA-AES256-SHA | TLSv1 | ECDH | ECDSA | AES(256) | SHA1 |  |
| 25 | ECDHE-ECDSA-AES256-SHA384 | TLSv1.2 | ECDH | ECDSA | AES(256) | SHA384 |  |
| 26 | ECDHE-ECDSA-CHACHA20-POLY1305 | TLSv1.2 | ECDH | ECDSA | CHACHA20/POLY1305(256) | AEAD |  |
| 27 | ECDHE-PSK-AES128-CBC-SHA | TLSv1 | ECDHEPSK | PSK | AES(128) | SHA1 |  |
| 28 | ECDHE-PSK-AES128-CBC-SHA256 | TLSv1 | ECDHEPSK | PSK | AES(128) | SHA256 |  |
| 29 | ECDHE-PSK-AES256-CBC-SHA | TLSv1 | ECDHEPSK | PSK | AES(256) | SHA1 |  |
| 30 | ECDHE-PSK-AES256-CBC-SHA384 | TLSv1 | ECDHEPSK | PSK | AES(256) | SHA384 |  |
| 31 | ECDHE-PSK-CHACHA20-POLY1305 | TLSv1.2 | ECDHEPSK | PSK | CHACHA20/POLY1305(256) | AEAD |  |
| 32 | ECDHE-RSA-AES128-GCM-SHA256 | TLSv1.2 | ECDH | RSA | AESGCM(128) | AEAD |  |
| 33 | ECDHE-RSA-AES128-SHA | TLSv1 | ECDH | RSA | AES(128) | SHA1 |  |
| 34 | ECDHE-RSA-AES128-SHA256 | TLSv1.2 | ECDH | RSA | AES(128) | SHA256 | 已支持 |
| 35 | ECDHE-RSA-AES256-GCM-SHA384 | TLSv1.2 | ECDH | RSA | AESGCM(256) | AEAD | 已支持 |
| 36 | ECDHE-RSA-AES256-SHA | TLSv1 | ECDH | RSA | AES(256) | SHA1 |  |
| 37 | ECDHE-RSA-AES256-SHA384 | TLSv1.2 | ECDH | RSA | AES(256) | SHA384 |  |
| 38 | ECDHE-RSA-CHACHA20-POLY1305 | TLSv1.2 | ECDH | RSA | CHACHA20/POLY1305(256) | AEAD |  |
| 39 | PSK-AES128-CBC-SHA | SSLv3 | PSK | PSK | AES(128) | SHA1 |  |
| 40 | PSK-AES128-CBC-SHA256 | TLSv1 | PSK | PSK | AES(128) | SHA256 |  |
| 41 | PSK-AES128-GCM-SHA256 | TLSv1.2 | PSK | PSK | AESGCM(128) | AEAD |  |
| 42 | PSK-AES256-CBC-SHA | SSLv3 | PSK | PSK | AES(256) | SHA1 |  |
| 43 | PSK-AES256-CBC-SHA384 | TLSv1 | PSK | PSK | AES(256) | SHA384 |  |
| 44 | PSK-AES256-GCM-SHA384 | TLSv1.2 | PSK | PSK | AESGCM(256) | AEAD |  |
| 45 | PSK-CHACHA20-POLY1305 | TLSv1.2 | PSK | PSK | CHACHA20/POLY1305(256) | AEAD |  |
| 46 | RSA-PSK-AES128-CBC-SHA | SSLv3 | RSAPSK | RSA | AES(128) | SHA1 |  |
| 47 | RSA-PSK-AES128-CBC-SHA256 | TLSv1 | RSAPSK | RSA | AES(128) | SHA256 |  |
| 48 | RSA-PSK-AES128-GCM-SHA256 | TLSv1.2 | RSAPSK | RSA | AESGCM(128) | AEAD |  |
| 49 | RSA-PSK-AES256-CBC-SHA | SSLv3 | RSAPSK | RSA | AES(256) | SHA1 |  |
| 50 | RSA-PSK-AES256-CBC-SHA384 | TLSv1 | RSAPSK | RSA | AES(256) | SHA384 |  |
| 51 | RSA-PSK-AES256-GCM-SHA384 | TLSv1.2 | RSAPSK | RSA | AESGCM(256) | AEAD |  |
| 52 | RSA-PSK-CHACHA20-POLY1305 | TLSv1.2 | RSAPSK | RSA | CHACHA20/POLY1305(256) | AEAD |  |
| 53 | SRP-AES-128-CBC-SHA | SSLv3 | SRP | SRP | AES(128) | SHA1 |  |
| 54 | SRP-AES-256-CBC-SHA | SSLv3 | SRP | SRP | AES(256) | SHA1 |  |
| 55 | SRP-RSA-AES-128-CBC-SHA | SSLv3 | SRP | RSA | AES(128) | SHA1 |  |
| 56 | SRP-RSA-AES-256-CBC-SHA | SSLv3 | SRP | RSA | AES(256) | SHA1 |  |
| 57 | TLS_AES_128_CCM_8_SHA256 | TLSv1.3 | any | any | AESCCM8(128) | AEAD | TLS版本过高 |
| 58 | TLS_AES_128_CCM_SHA256 | TLSv1.3 | any | any | AESCCM(128) | AEAD | TLS版本过高 |
| 59 | TLS_AES_256_GCM_SHA384 | TLSv1.3 | any | any | AESGCM(256) | AEAD | TLS版本过高 |
| 60 | TLS_CHACHA20_POLY1305_SHA256 | TLSv1.3 | any | any | CHACHA20/POLY1305(256) | AEAD | TLS版本过高 |

## 2.2 功能说明

### 2.2.1 使用流程

#### 前置条件：生成证书

此处介绍基于openssl工具，生成自签名证书的流程，与之前版本相比，无任何区别。

1.  创建存放私钥与证书的文件夹

    ```bash
    mkdir certs
    cd certs
    mkdir ./demoCA ./demoCA/newcerts ./demoCA/private
    echo '01'>./demoCA/serial
    touch ./demoCA/index.txt
    ```

2.  配置openssl工具  
    从Vastbase安装包中，获取openssl工具以及openss配置文件。假设Vastbae安装包存放在$GAUSSHOME目录。

    ```bash
    cp $GAUSSHOME/bin/openssl ./
    chmod +x ./openssl
    export PATH=`pwd`:$PATH
    which openssl # 确保openssl来源于Vastbase安装包，避免因版本不同造成证书不可用
    openssl version
    cp $GAUSSHOME/share/sslcert/gsql/openssl.cnf ./
    export OPENSSL_CONF=`pwd`/openssl.cnf
    ```

3.  创建CA私钥、CA证书

    ```bash
    openssl genrsa -out demoCA/private/cakey.pem 2048
    openssl req -new -config openssl.cnf -key demoCA/private/cakey.pem -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=CA -out cacert.req
    openssl ca -selfsign -config openssl.cnf -batch -keyfile demoCA/private/cakey.pem -in cacert.req -out demoCA/cacert.pem
    ```

4.  创建数据库私钥、数据库证书

    ```bash
    openssl genrsa -out server.key 2048
    openssl req -new -config openssl.cnf -key server.key -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=server -out server.req
    openssl ca -config openssl.cnf -days 3650 -batch -in server.req -out server.crt
    ```

5.  创建应用端私钥、应用端证书

    ```bash
    openssl genrsa -out client.key 2048
    openssl req -new -config openssl.cnf  -key client.key -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=client -out client.req
    openssl ca -config openssl.cnf -days 3650 -batch -in client.req -out client.crt
    ```

6.  设置私钥与证书文件权限

    ```bash
    chmod 600 client* server* ca* demoCA/ca*
    ```

#### 场景一：配置可解密的TLS算法套件

1.  创建新用户

    ```sql
    vsql -d vastbase -c "CREATE USER u1 PASSWORD 'u1.password';"
    ```

2.  配置SSL证书  
    此处，假设数据库的数据目录为$VBDATA。

    ```bash
    export VBDATA=$GAUSSHOME/data
    vb_guc set -D $VBDATA -c "ssl=on"
    vb_guc set -D $VBDATA -c "require_ssl=on"
    vb_guc set -D $VBDATA -c "ssl_cert_file='`pwd`/server.crt'"
    vb_guc set -D $VBDATA -c "ssl_key_file='`pwd`/server.key'"
    vb_guc set -D $VBDATA -c "ssl_ca_file='`pwd`/demoCA/cacert.pem'"
    ```

    接下来，需配置TLS协议采用的默认算法套件
    -   之前版本，ssl_ciphers取值范围如下：
        1.  ECDHE-ECDSA-AES256-GCM-SHA384
        2.  ECDHE-RSA-AES256-GCM-SHA384
        3.  DHE-RSA-AES256-GCM-SHA384
        4.  ECDHE-ECDSA-AES128-GCM-SHA256
        5.  DHE-RSA-AES128-GCM-SHA256
        6.  ECDHE-RSA-AES128-SHA256
        7.  ECDHE-ECDSA-SM4-CBC-SM3
        8.  4个仅tassl支持的国密算法套件
    -   本版本，新增4个取值范围
        -   AES128-SHA256
        -   AES256-SHA256
        -   AES128-GCM-SHA256
        -   AES256-GCM-SHA384

            ```bash
            vb_guc set -D $VBDATA -c "ssl_ciphers='AES128-SHA256'"
            ```

3.  开启远程登录

    ```bash
    vb_guc set -D $VBDATA -c "listen_addresses='*'"
    ```

4.  开启登录防火墙  
    在pg_hba.conf中，添加一行配置，确保该配置在所有host配置的第1行

    ```bash
    vb_guc set -D $VBDATA -h "host all all 0.0.0.0/0 sha256"
    ```

5.  重启数据库，使配置生效
6.  应用端配置私钥与证书  
    应用端通过环境变量或连接参数配置私钥与证书。

    ```bash
    export PGSSLMODE=verify-ca
    export PGSSLCERT=`pwd`/client.crt
    export PGSSLKEY=`pwd`/client.key
    export PGSSLROOTCERT=`pwd`/demoCA/cacert.pem
    ```

7.  应用端连接数据库

    ```bash
    vsql -h localhost -p 5432 -d vastbase -U u1 -W 'u1.password' -r
    # 预期结果：连接成功，启动TLS协议，使用的算法为AES128-SHA256（vsql会显示采用的算法套件）
    ```

#### 场景二：第三方工具解密TLS流量

1.  按场景一配置数据库
2.  使用tcpdump监听数据库端口，准备抓包  
    需要root用户执行，接下来抓包的数据将输出到vsql.pcap中

    ```bash
    tcpdump -i any -w ./vsql.pcap 'tcp port 5432'
    ```

3.  vsql通过TLS连接数据库

    ```bash
    vsql -h localhost -p 5432 -d vastbase -U u1 -W 'u1.password' -r
    ```

    此时，步骤2会在后台抓取vsql与vastbase传输的所有数据，并输出到vsql.pcap中
4.  windows机器下载vsql.pcap
5.  windows机器下载server.key文件  
    即ssl_key_file参数配置的文件
6.  windows安装wireshark工具
7.  wireshark直接打开vsql.pcap  
    效果如下图所示，可看到TLS握手过程，包括：选择算法套件、生成密钥流程等。此时，传输的数据是密文格式  
    ![decrypt](/images/ProjectDocs/10-requirement-ssl/decrypt.png) ![tcpdump](/images/ProjectDocs/10-requirement-ssl/tcpdump.png)
8.  wireshark导入server.key  
    以此点击：
    -   编辑
    -   首选项
    -   Protocols
    -   TLS：协议有点多，得好好找一下
    -   RSA keys list
    -   Edit
    -   点“+”号
    -   配置：
        -   IP address：0.0.0.0
        -   Port: 5432
        -   Protocol：（不填）
        -   Key File：下载的server.key  
            保存配置
9.  此时，vsql.pcap会自动刷新成为以下内容：  
    ![decrypt](/images/ProjectDocs/10-requirement-ssl/decrypt.png)![decrypt](/images/ProjectDocs/10-requirement-ssl/decrypt.png)

#### 场景三：第三方工具解密JDBC TLS流量

JDBC无任何改动，当vastbase配置新算法套件时，JDBC也能正常使用TLS协议

#### 扩展场景：其他组件使用TLS协议

在使用TLS协议时，数据库端ssl_ciphers参数控制使用哪种算法套件，客户端无控制参数。  
此次修改，仅修改服务端，未修改客户端。vsql默认可使用新增算法套件。  
其他数据库工具/组件，可能会采用TLS协议访问数据库，当数据库端配置新增的算法套件时，其他数据库组件无需修改，可直接使用新增的算法套件。

-   obs
-   dcf

#### 异常场景

无。此次修改ssl_ciphers的取值范围，新增的4个参数，直接传递给libssl.so，无异常场景。

### 2.2.2 配置参数和文件

1.  修改1个GUC ssl_ciphers的取值范围
    -   修改前：
        1.  ECDHE-ECDSA-AES256-GCM-SHA384
        2.  ECDHE-RSA-AES256-GCM-SHA384
        3.  DHE-RSA-AES256-GCM-SHA384
        4.  ECDHE-ECDSA-AES128-GCM-SHA256
        5.  DHE-RSA-AES128-GCM-SHA256
        6.  ECDHE-RSA-AES128-SHA256
        7.  ECDHE-ECDSA-SM4-CBC-SM3
        8.  4个仅tassl支持的国密算法套件
    -   修改后：新增4个取值
        -   AES128-SHA256
        -   AES256-SHA256
        -   AES128-GCM-SHA256
        -   AES256-GCM-SHA384

### 2.2.3 数据相关性

无

## 2.3 接口信息

修改1个GUC ssl_ciphers的取值范围。

## 2.4 正反向行为

### 2.4.1 生效说明

1.  ssl_ciphers 可配置为新的取值
2.  vsql使用tls连接时，vsql可显示采用的算法套件为新增的算法套件
3.  使用tcpdump工具抓包，wireshark工具解析，可查看算法套件
4.  使用第三方工具，可解密网络流量

### 2.4.2 提示信息

未新增。vsql已支持打印tls协议的算法套件名称。

### 2.4.3 约束和依赖

无

## 2.5 安全性

### 2.5.1 权限控制

无

### 2.5.2 审计

无

## 2.6 影响范围

### 2.6.1 对已有UDT,UDF, ECPG的影响

如果采用tls协议访问数据库，当ssl_ciphers配置为新增的算法套件时，仍然可以正常使用tls。

### 2.6.2 对系统函数的影响

无

### 2.6.3 对系统CATALOG的影响

无

### 2.6.4 对xlog日志格式、数据格式的影响

无

### 2.6.5 与其他功能交互时的行为表现

无

### 2.6.6 版本兼容性

旧版本驱动、旧版本vsql，可通过tls正常访问新版本数据库。

### 2.6.7 用户行为变更

1.  修改1个GUC ssl_ciphers的取值范围
    -   修改前：
        1.  ECDHE-ECDSA-AES256-GCM-SHA384
        2.  ECDHE-RSA-AES256-GCM-SHA384
        3.  DHE-RSA-AES256-GCM-SHA384
        4.  ECDHE-ECDSA-AES128-GCM-SHA256
        5.  DHE-RSA-AES128-GCM-SHA256
        6.  ECDHE-RSA-AES128-SHA256
        7.  ECDHE-ECDSA-SM4-CBC-SM3
        8.  4个仅tassl支持的国密算法套件
    -   修改后：新增4个取值。如客户需使用第三方流量审计工具，需配置为新的取值，新的取值中密码生成协议为RSA协议，支持解密TLS流量。
        -   AES128-SHA256
        -   AES256-SHA256
        -   AES128-GCM-SHA256
        -   AES256-GCM-SHA384

## 2.7 指标相关

### 2.7.1 关键资源指标

无

### 2.7.2 系统性指标

无

### 2.7.3 性能指标

无

## 2.8 测试建议

无

## 2.8 其他说明

无
