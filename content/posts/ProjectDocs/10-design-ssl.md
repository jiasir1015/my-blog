+++
title = '海量 10 设计 SSL协议'
date = '2025-09-09T18:48:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['SSL', '设计文档']
weight = 1000
ShowToc = true
TocOpen = true
+++
# 1 TLS协议支持第三方流量审计

## 1.1 功能简述

【需求背景】  
TLS协议，是保障通信安全的加密协议，可分为4个子功能：

1.  密钥生成：通过密钥交换或密钥协商等协议，让双方生成相同的密钥
2.  身份认证：在开始阶段，双方均向对方发送自己的证书。双方接收证书后，基于PKI体系，校验证书是否合法。
3.  数据加密：发送方发生数据前，使用密钥加密数据，发送数据密文。接受方接受密文后，使用密钥解密，获取数据。
4.  数据校验：在加密数据的同时，生成数据完整性校验码，与数据密文拼接在一起。（简单理解：生成数据的哈希值，并使用密钥加密哈希值）接收方解密数据后，同样生成数据完整性校验码，与接收的相比，判断是否一致。

开源软件libssl.so提供TLS功能，应用只需调用接口，即可实现TLS协议。同时，libssl.so提供100+算法套件，可让应用选择不同的参数组合，1个算法套件，包含4个关键参数：

1.  密钥生成：密钥生成协议
2.  身份认证：证书算法类型
3.  数据加密：加密算法类型
4.  数据校验：哈希算法类型

例如，libssl.so中，常用的算法套件为：ECDHE-RSA-AES128-SHA256，该套件中，参数的含义如下：

1.  密钥生成协议：ECDHE协议。（常见协议类型:DHE、ECDHE、RSA等）
2.  证书算法类型：RSA
3.  加密算法类型：AES-128
4.  哈希算法类型：SHA-256

【需求分析】  
vastbase支持TLS协议，当vsql与vastbase通信时，双方可使用TLS模块，生成密钥，并使用密钥加密、解密通信数据，包括：SQL语句、SQL执行结果等。  
客户可能采用第三方工具，截取网络流量，获取传输中的SQL等数据，进行流量审计。但是，在使用TLS协议的情况下，网络中的数据是密文形式，无法进行流量审计。

vastbase提供1个GUC参数ssl_ciphers，用于配置TLS协议采用的算法套件，旧版本，该参数的取值范围如下：

-   ECDHE-ECDSA-AES256-GCM-SHA384
-   ECDHE-RSA-AES256-GCM-SHA384
-   DHE-RSA-AES256-GCM-SHA384
-   ECDHE-ECDSA-AES128-GCM-SHA256
-   DHE-RSA-AES128-GCM-SHA256
-   ECDHE-RSA-AES128-SHA256
-   ECDHE-ECDSA-SM4-CBC-SM3
-   4个仅tassl支持的国密算法套件

上述7个套件中，密钥生成协议为：ECDHE、DHE，此类DH协议，无法让第三方工具获取密钥。

本版本，新增4个算法套件：

-   AES128-SHA256
-   AES256-SHA256
-   AES128-GCM-SHA256
-   AES256-GCM-SHA384

上述4个套件，密钥生成协议为：RSA，该协议可让第三方工具获取密钥，使其可解密网络流量，获取SQL语句、SQL执行结果等。

【需求实现】  
之前，vastbase限制ssl_ciphers的取值范围，仅放开7个算法套件，本版本，将新增放开4个算法套件。

实现时，仅修改ssl_ciphers的取值范围，新增支持4个算法套件[AES128-SHA256、AES256-SHA256、AES128-GCM-SHA256、AES256-GCM-SHA384]，4个算法套件将直接传递给libssl.so，内核不做任何处理。

因此，本需求无复杂设计。本文主要介绍完整的TLS协议工作原理。

## 1.2 实现方案

### 一、ECDHE与RSA的区别

此处简化ECDHE与RSA的步骤与算法，提取最核心的原理，方便快速理解。

-   一、ECDHE密钥协商协议  
    第三方工具、攻击者完全无法获取密钥。

    ```bash
    client                                    server
    +-------------------------------------------+-----------------------------------
    |  <---- 0. 双方随机约定一些公开参数 ------>  |
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
    -   第三方工具：配置步骤1中的server_priv，并截获步骤5中的enc_key，则可解密获取的密钥key。该密钥key将用于解密网络流量。
    -   攻击者：无法获取server_priv，则无法解密网络流量。

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
        ```

### 二、完整的TLS协议

完整的TLS协议如下图所示，其中：

-   第21-47步，为完整的TLS协议，由libssl.so提供。本示例中，密钥协议为ECDHE。

    ```bash
    [user]-------------------------------------------- [client]------------------------------------------[server]-----------------------------------------------
    # 前提步骤：生成私钥、证书
    1. 从安装包获取openssl工具
    2. openssl随机生成ca.key
    3. openssl根据ca.key，计算生成ca.cert
    4. openssl随机生成私钥client.key
    5. openssl根据client.key，计算生成client.cert
        - client.cert由ca.key签名，将由ca.cert验证签名
    6. openssl随机生成私钥server.key
    7. openssl根据server.key，计算生成server.cert
        - server.cert由ca.key签名，将由ca.cert验证签名

    # 前置步骤：配置私钥、证书、算法套件
    8. 设置GUC：ssl=on ------------------------------------------------------------------------------------->
    9. 设置GUC：ssl_cert_file=server.cert ------------------------------------------------------------------>
    10. 设置GUC：ssl_key_file=server.key ------------------------------------------------------------------->
    11. 设置GUC：ssl_ca_file=ca.cert ----------------------------------------------------------------------->
    12. 设置GUC：ssl_ciphers='ECDHE-RSA-AES128-SHA256' ----------------------------------------------------->

    # 前置条件：配置私钥、证书
    13. 设置环境变量：PGSSLMODE=verify-ca ---------------->
    14. 设置环境变量：PGSSLCERT=client.cert -------------->
    15. 设置环境变量：PGSSLKEY=client.key ---------------->
    16. 设置环境变量：PGSSLROOTCERT=ca.cert -------------->

    17. vsql -h $host -p $port -U $user -W $password -->
                                                        # 阶段一、建立TCP连接
                                                        | 18. 获取$host, $port
                                                        | 19. 与$host, $port 建立TCP连接 -------------------->
                                                        | 20. 获取PGSSLMODE，判断是否使用SSL协议
                                                        # 阶段二、建立TLS连接（完全由第三方库libssl.so实现）
                                                        | 21. 询问是否启用SSL协议 --------------------------->
                                                                                                            | 22. 读取GUC：ssl=on
                                                                                                            | 23. 读取server.cert，server.key
                                                        | <------------------------------ 24. 启用SSL协议
                                                        | 25. 生成随机数 $client_random
                                                        | 26. 发送 [Client Hello] -------------------------->
                                                            - 支持的最高TLS协议版本：1.2
                                                            - $client_random
                                                            - 支持的密码套件: 默认12个
                                                                -
                                                            - 其他
                                                                                                            | 27. 接收
                                                                                                            | 28. 生成随机数 $server_random
                                                                                                            | 29. 随机生成私钥 $server_priv
                                                                                                            | 30. 根据$server_priv，计算公钥$server_pub
                                                                                                            | 31. 根据客户端支持的密码套件，以及ssl_ciphers取值，选择算法套件
                                                                                                            | 32. 用server.key对$client_random，$server_random，$server_pub签名，生成$server_signature
                                                        | <---  33. 发送 [Server Hello] [Cert] [Cert Request]
                                                                                - 选择的TLS协议版本：1.2
                                                                                - $server_random
                                                                                - 选择的算法套件
                                                                                - server.cert (用于身份认证)
                                                                                - 服务端支持的证书类型：RSA
                                                                                - $server_pub (用于生成密钥)
                                                                                - $server_signature
                                                        | 34. 接收
                                                        | 35. 读取算法套件，根据算法套件，确定密钥生成协议
                                                        | 36. 随机生成私钥 $client_priv
                                                        | 37. 根据$client_priv，计算公钥$client_pub
                                                        | 38. 使用ca.cert，验证server.cert (身份认证)
                                                        | 39. 使用server.cert，验证$server_signature
                                                        | 40. 使用client.key对$client_random，$server_random，$client_pub等签名，生成$client_signature
                                                        | 41. 使用$client_priv, $server_pub, $client_random, $server_random，计算$key (生成密钥)
                                                        | 42. 发送 [Cert] [Key Exchange] [Cert Verify] [Cipher Spec] ----->
                                                            - client.cert
                                                            - $client_pub
                                                            - $client_signature
                                                            - $key准备就绪
                                                                                                            | 43. 接收
                                                                                                            | 44. 使用ca.cert，校验client.cert
                                                                                                            | 45. 使用client.cert，校验$client_signature
                                                                                                            | 46. 使用$server_priv, $client_pub, $client_random, $server_random，计算$key
                                                        | <-------------------------  47. 发送 [Cipher Spec]
                                                                                        - $key准备就绪
                                                        # （至此，双方之间的通信数据，将完全由$key加密，同时基于$生成完整性校验码）
                                                        # 阶段三、身份认证
                                                        | 48. 随机生成 $client_nonce
                                                        | 49. 使用$key，加密$client_nonce（同时生成完整性校验码，后面省略次步骤）
                                                        | 50. 发送加密的$client_nonce
                                                                                                            | 51. 接收、解密（同时校验完整性校验码）
                                                                                                            | 52. 根据pg_authid系统表、pg_hba.conf，选择密码的hash算法
                                                                                                            | 53. 随机生成 $server_nonce
                                                                                                            | 54. 从pg_authid获取$user 的 $salt,$iteration,$storedkey,$serverkey
                                                                                                            | 55. 使用$key 加密$server_nonce,$salt,$iteration
                                                        | <----- 56. 发送加密的 $server_nonce,$salt,$iteration
                                                        | 57. 接收、解密
                                                        | 58. 使用$password,$iteration,$salt等，计算$client_proof
                                                        | 59. 使用$key 加密$client_proof
                                                        | 60. 发送加密的 $client_proof ---------------------->
                                                                                                            | 61. 接受、解密
                                                                                                            | 62. 根据$client_proof，生成$clientkey
                                                                                                            | 63. 校验$serverkey 与$clientkey
    64. SELECT * FROM t1; ------------------------------>
                                                        | 65. 使用$key，加密SQL语句
                                                        | 66. 发送加密后的SQL ------------------------------->
                                                                                                            | 67. 接收、解密
                                                                                                            | ...(省略)
    ```

## 1.3 接口说明

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

## 1.4 内存管理

不涉及

## 1.5 安全

RSA协议安全性比ECDHE稍低，但RSA协议也是标准协议，且使用范围广，在HTTPS等中较常见。

## 1.6 性能

几乎无影响。

-   默认不生效，需单独配置ssl_ciphers，需求才生效。
-   仅修改密钥生成协议，影响TLS握手阶段，不影响数据传输阶段。
-   TLS握手阶段，RSA与ECDHE协议相比，网络交互次数相同，密钥生成速度接近。

## 1.7 专利

无

## 1.8 升级管理

无适配。旧版本驱动，可正常连接新版本数据库。

## 1.9 其他说明

无
