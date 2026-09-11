+++
title = '传统安全 1 密码学'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['加密']
weight = 101
ShowToc = true
TocOpen = true
+++
# 1 密码学综述

本文主要总结常见的密码算法与协议，并不详细介绍原理

-   密码算法
    -   对称密码算法
    -   非对称密码算法
    -   哈希算法
    -   完整性校验算法
-   其他算法
    -   随机数生成算法
    -   密钥派生算法

# 2 密码算法

## 2.1 对称加密算法

对称加密算法的基本原理是，输入明文、密钥，对明文进行分组，对每组明文进行多轮线性、非线性运算，比如异或、代换等，得到密文。  
常见的对称加密算法如下：

| 算法 | 发布时间 | 分组长度 | 密钥长度 | 算法 |
| --- | --- | --- | --- | --- |
| DES | 1977 | 64 | 64 | 16 x 置换（E扩展、异或、代换、P置换） |
| 3DES | - | - | - | - |
| IDEA | 1990 | - | - | - |
| AES | 2001 | 128 | 128/192/256 | 10/12/14 x 矩阵运算(字节代换、行移位、列混合、异或) |
| SM4 | 2012 | 128 | 128 | 32 x 分组运算（异或、代换、移位） |
| SM1 | - | 128 | 128 | 未公开 |
| SM7 | - | 128 | 128 | 未公开 |

在实现加密的过程中，还有几个基础知识：

-   密钥扩展：加密时，会迭代很多轮，每一轮都用1个轮密钥。1个原始密钥，扩展为多个的轮密钥。
-   加密模式：一个原始明文，分为多个明文组，组与组之间的组合方式如下：

    | 模式 | 中文 | 描述 |
    | --- | --- | --- |
    | ECB | 电子密码本 | 不同的明文块，用相同的密钥 |
    | CBC | 密码分组链接 | 上1密文块，与下一明文块异或 |
    | CTR | 计数器模式 | 密钥加密计数器生成密钥流，密文块与密钥流异或 |
    | CFB | 密码反馈模式 | \- |
    | OFB | 输出反馈模式 | 与CFB类似 |

常见算法的具体实现原理如下：

-   一、DES

    -   密钥扩展：16轮 \* 48 bit密钥 （每轮生成1个轮密钥）
        1.  转换：64 -> 56 bit，忽略校验位
        2.  移位
        3.  合并：28 bit 与 28 bit合并
        4.  代换：
    -   加密：16轮
        1.  置换：前面的bit后后面的bit置换
        2.  异或
        3.  代换
-   二、AES

    -   密钥扩展：128 / 192 / 256 bit 分别对应 10 / 12 / 14 轮 \* 32 bit 密钥（每轮生成1个轮密钥）
        1.  移位：左移
        2.  代换：S盒代换
        3.  异或：与固定基数异或
    -   加密：10 / 12 / 14 轮 （与密钥长度有关） 构造1个矩阵：4 x 4 字节 = 4 \* 4 \* 8 bit = 128 bit
        1.  代换：字节代换
        2.  移位：行移位
        3.  混合：列混合 （各分组拼成矩阵，矩阵相乘）
        4.  异或：轮密钥加
    -   解密：轮密钥加、逆列混合、逆行移位、逆字节代换
-   三、SM4

    -   密钥扩展：32轮 \* 32 bit 密钥 （每轮生成1个轮密钥）
        1.  分组：分为4组 \* 32bit
        2.  异或：与固定基数异或
        3.  代换：S盒代换
        4.  移位：移位并与其他分组异或
    -   明文：128 bit，分为4组 \* 32bit
    -   加密：32轮 -> 分为4组 \* 32bit
        1.  异或：轮密钥异或
        2.  代换：S盒代换
        3.  移位：行移位并与自己异或
    -   解密：

## 2.2 非对称密码算法

-   原理：基于数学问题的难解性，给定输入，计算输出容易；给定输出，计算输入困难。
-   4个常见算法

| 算法 | 安全密钥长度 | 数论基础 | 安全性基础 |
| --- | --- | --- | --- |
| RSA | 2048 bit | 欧拉定理 | 整数分解问题的难解性 |
| ElGamal | 1024 bit | 离散对数 | 有限域上，离散对数问题的难解性 |
| ECC | 160 bit | 离散对数 | 椭圆曲线上，离散对数问题的难解性 |
| SM2 | 256 bit | 离散对数 | 椭圆曲线上，离散对数问题的难解性 |

-   加密算法：
-   RSA
-   ElGamal
-   ECC
-   SM2

## 2.3 哈希算法

## 2.4 完整性校验算法

| 认证模式 | 算法 | 密钥长度 |
| --- | --- | --- |
| HMAC | HMAC-MD5 | 128 bit |
| HMAC | HMAC-SHA1 | 160 |
| HMAC | HMAC-SHA256 | 256 |
| HMAC | SM3 | 256 |
| DES | CBC-MAC | 64 |
| AES | CBC-MAC | 128 |

## 2.5 随机数生成算法

## 2.6 密钥派生算法

# 3 密码协议

# 5 软件实现

## 5.1 openssl实现加密

### 一、对称加密

#### 准备编译环境

1.  准备开发环境：centos 7, x86
2.  下载openssl源码  
    centos已安装openssl，但可能是1.0或1.1版本，我想使用3.0版本，所以选择源码编译安装openssl。另外，如果更改系统原openssl版本，可能导致系统崩溃

    ```bash
    mkdir crypto
    cd crypto

    wget https://www.openssl.org/source/openssl-3.0.5.tar.gz
    ```

3.  安装perl  
    配置openssl的编译参数时，即下述步骤4中的`./config ..`命令中，需要依赖perl。（我没用过perl，直接跟着教程安装的）

    ```bash
    yum install -y perl-CPAN
    # 继续安全必须模块
    perl -MCPAN -e shell
      # 中途有个地方，输入：local::lib
    # 当出现 cpan[1]> ，时，输入一下命令
    install IPC::Cmd
    # 退出
    exit
    ```

4.  编译openssl源码

    ```bash
    taz -zxvf openssl-3.0.5.tar.gz
    mkdir openssl # 存放编译出的libssl.so

    cd openssl-3.0.5
    # 安装目录设置为当前目录的 output文件夹
    ./config --prefix=`pwd`/output --openssldir=`pwd`/output shared
    make -sj
    make install -sj

    mv ./output ../libssl
    ```

5.  创建源码目录

    ```bash
    cd ..

    mkdir code
    # 确保目录结构为：
    |-- crypto
      |-- libssl # 存放openssl的lib与include文件
      |-- openssl-3.0.5 # openssl源码，用不上了
      |-- code

    cd code
    touch enc.c
    ```

    在enc.c中，开始写加解密代码demo

#### 加解密demo

1.  加解密源码：

    ```c
    #include <stdio.h>
    #include <string.h>
    /* openssl头文件 */
    #include <openssl/evp.h>
    #include <openssl/rand.h>
    #include <openssl/err.h>

    typedef unsigned char uchar;
    #define ASSERT(condition) if (!(condition)) {printf("error: code line: %d\n", __LINE__); exit(0);}

    /* 加密函数 （为考虑博客排版紧凑，不考虑代码风格） */
    void encrypt(uchar *plain, int plainlen, uchar *key, uchar *iv, uchar *cipher, int *cipherlen)
    {
        int ret;
        /* 1 初始化内存上下文 */
        EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
        ASSERT(ctx != NULL);
        /* 2 选择加密算法，建议当函数入参传进来 */
        const EVP_CIPHER *algorithm = EVP_aes_256_cbc();
        /* 3 扩展密钥 */
        ret = EVP_EncryptInit_ex(ctx, algorithm, NULL, key, iv);
        ASSERT(ret == 1);
        /* 4 加密明文 */
        ret = EVP_EncryptUpdate(ctx, cipher, cipherlen, plain, plainlen);
        ASSERT(ret == 1);
        /* 5 填充密文，让密文长度变成分组长度的整数倍 */
        int padlen;
        ret = EVP_EncryptFinal_ex(ctx, cipher + *cipherlen, &padlen);
        ASSERT(ret == 1);
        *cipherlen += padlen; /* 输出长度：密文实际长度 + 填充长度 */
        EVP_CIPHER_CTX_free(ctx);
    }

    /* 解密函数 */
    void decrypt(uchar *cipher, int cipherlen, uchar *key, uchar *iv, uchar *plain, int *plainlen)
    {
        int ret;
        /* 1 初始化内存上下文 */
        EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
        ASSERT(ctx != NULL);
        /* 2 选择加密算法 */
        const EVP_CIPHER *algorithm = EVP_aes_256_cbc();
        /* 3 扩展密钥 */
        ret = EVP_DecryptInit_ex(ctx, algorithm, NULL, key, iv);
        ASSERT(ret == 1);
        /* 4 解密密文 */
        ret = EVP_DecryptUpdate(ctx, plain, plainlen, cipher, cipherlen);
        ASSERT(ret == 1);
        /* 5 计算填充长度并清理填充 */
        int padlen;
        ret = EVP_DecryptFinal_ex(ctx, plain + *plainlen, &padlen);
        ASSERT(ret == 1);
        *plainlen += padlen; /* 输出长度：解密长度 - 填充长度，此处padlen实际是个负数  */
        EVP_CIPHER_CTX_free(ctx);
    }

    void print_uchar(uchar *data, int len)
    {
        printf("len:%-6d data:");
        int i;
        for (i = 0; i < len; i++) {
            printf("%x", data[i]);
        }
        printf("\n");
    }

    int main()
    {
        uchar plain[37] = {0}; /* 随便设置的长度 */
        uchar key[32] = {0};
        uchar iv[16] = {0};
        uchar cipher[64] = {0};
        int cipherlen = 0;
        int ret;

        /* 随机生成 明文、密钥、IV */
        ret = RAND_bytes(plain, 37);
        ASSERT(ret == 1);
        ret = RAND_bytes(key, 32);
        ASSERT(ret == 1);
        ret = RAND_bytes(iv, 16);
        ASSERT(ret == 1);

        printf("-- plain, key, iv:\n");
        print_uchar(plain, 37);
        print_uchar(key, 32);
        print_uchar(iv, 16);

        /* 加密 */
        encrypt(plain, 37, key, iv, cipher, &cipherlen);
        printf("\n-- output cipher:\n");
        print_uchar(cipher, cipherlen);

        /* 解密 */
        uchar _plain[64] = {0};
        int _plainlen = 0;
        decrypt(cipher, cipherlen, key, iv, _plain, &_plainlen);
        printf("\n-- output plain:\n");
        print_uchar(_plain, _plainlen);

        return 0;
    }
    ```

2.  编译代码

    ```bash
    gcc enc.c -I../libssl/include -L../libssl/lib64 -lssl -lcrypto -o enc
    ```

3.  运行代码

    ```bash
    export LD_LIBRARY_PATH=`pwd`/../libssl/lib64:$LD_LIBRARY_PATH

    ./enc
    ```

    以下是示例输出：

    ```bash
    -- plain, key, iv:
    len:37     data:1b172e617193d5bef358a28504f86b2ce9f820a8599982d6e7edda2b3c69b98b2e1b9d9
    len:32     data:7bf1cc71b9262c0c0621956e9d4528841da3b47a48f0a0a8d63b1997586d28
    len:16     data:9cc1f5648c6988d33e7b24f46223b648

    -- output cipher:
    len:48     data:1e6fde979bf3b76e889f588a3943a9bf74eaed127e0a0ba1f27f97558b0c93f9f5d2d89202d59444f6ce6bc7d596114

    -- output plain:
    len:37     data:1b172e617193d5bef358a28504f86b2ce9f820a8599982d6e7edda2b3c69b98b2e1b9d9
    ```
