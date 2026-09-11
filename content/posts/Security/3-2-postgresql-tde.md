+++
title = '数据库安全 0 postgresql表级透明加密'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['PostgreSQL', '加密']
weight = 302
ShowToc = true
TocOpen = true
+++
1.  [1 特性背景](#1-%E7%89%B9%E6%80%A7%E8%83%8C%E6%99%AF)
2.  [2 实现方案](#2-%E5%AE%9E%E7%8E%B0%E6%96%B9%E6%A1%88)
    1.  [2.1 系统表](#2-1-%E7%B3%BB%E7%BB%9F%E8%A1%A8)
        1.  [1\. pg_key_info 密钥信息](#1-pg-key-info-%E5%AF%86%E9%92%A5%E4%BF%A1%E6%81%AF)
        2.  [2\. pg_key_data 密钥数据](#2-pg-key-data-%E5%AF%86%E9%92%A5%E6%95%B0%E6%8D%AE)
        3.  [3\. pg_encryption 加密对象](#3-pg-encryption-%E5%8A%A0%E5%AF%86%E5%AF%B9%E8%B1%A1)
    2.  [2.2 定义表](#2-2-%E5%AE%9A%E4%B9%89%E8%A1%A8)
    3.  [2.3 定义表加密](#2-3-%E5%AE%9A%E4%B9%89%E8%A1%A8%E5%8A%A0%E5%AF%86)
    4.  [2.4 操作表](#2-4-%E6%93%8D%E4%BD%9C%E8%A1%A8)
    5.  [2.5 管理表加密](#2-5-%E7%AE%A1%E7%90%86%E8%A1%A8%E5%8A%A0%E5%AF%86)
    6.  [2.6 管理主密钥](#2-6-%E7%AE%A1%E7%90%86%E4%B8%BB%E5%AF%86%E9%92%A5)
    7.  [2.7 管理数据密钥](#2-7-%E7%AE%A1%E7%90%86%E6%95%B0%E6%8D%AE%E5%AF%86%E9%92%A5)
    8.  [2.8 管理加密定义](#2-8-%E7%AE%A1%E7%90%86%E5%8A%A0%E5%AF%86%E5%AE%9A%E4%B9%89)
    9.  [2.8 未来计划](#2-8-%E6%9C%AA%E6%9D%A5%E8%AE%A1%E5%88%92)
        1.  [一、功能补充](#%E4%B8%80%E3%80%81%E5%8A%9F%E8%83%BD%E8%A1%A5%E5%85%85)
        2.  [二、语法复用](#%E4%BA%8C%E3%80%81%E8%AF%AD%E6%B3%95%E5%A4%8D%E7%94%A8)
3.  [3 关键设计](#3-%E5%85%B3%E9%94%AE%E8%AE%BE%E8%AE%A1)
    1.  [3.1 格式设计](#3-1-%E6%A0%BC%E5%BC%8F%E8%AE%BE%E8%AE%A1)
    2.  [3.2 流程设计](#3-2-%E6%B5%81%E7%A8%8B%E8%AE%BE%E8%AE%A1)
        1.  [整体流程](#%E6%95%B4%E4%BD%93%E6%B5%81%E7%A8%8B)
        2.  [加密粒度](#%E5%8A%A0%E5%AF%86%E7%B2%92%E5%BA%A6)
        3.  [加密时机](#%E5%8A%A0%E5%AF%86%E6%97%B6%E6%9C%BA)
        4.  [加密判断](#%E5%8A%A0%E5%AF%86%E5%88%A4%E6%96%AD)
        5.  [密钥存储](#%E5%AF%86%E9%92%A5%E5%AD%98%E5%82%A8)
        6.  [解密时机](#%E8%A7%A3%E5%AF%86%E6%97%B6%E6%9C%BA)
        7.  [解密判断](#%E8%A7%A3%E5%AF%86%E5%88%A4%E6%96%AD)
        8.  [密钥来源](#%E5%AF%86%E9%92%A5%E6%9D%A5%E6%BA%90)
    3.  [3.3 其他设计](#3-3-%E5%85%B6%E4%BB%96%E8%AE%BE%E8%AE%A1)
    4.  [3.2 主备密钥同步](#3-2-%E4%B8%BB%E5%A4%87%E5%AF%86%E9%92%A5%E5%90%8C%E6%AD%A5)
4.  [4 特性源码](#4-%E7%89%B9%E6%80%A7%E6%BA%90%E7%A0%81)
    1.  [4.1 功能概览](#4-1-%E5%8A%9F%E8%83%BD%E6%A6%82%E8%A7%88)
        1.  [基本功能篇](#%E5%9F%BA%E6%9C%AC%E5%8A%9F%E8%83%BD%E7%AF%87)
        2.  [高级功能篇](#%E9%AB%98%E7%BA%A7%E5%8A%9F%E8%83%BD%E7%AF%87)
        3.  [加强篇](#%E5%8A%A0%E5%BC%BA%E7%AF%87)
    2.  [4.2 新增系统表 pg_key_info](#4-2-%E6%96%B0%E5%A2%9E%E7%B3%BB%E7%BB%9F%E8%A1%A8-pg-key-info)
    3.  [4.2 新增系统表 pg_key_data](#4-2-%E6%96%B0%E5%A2%9E%E7%B3%BB%E7%BB%9F%E8%A1%A8-pg-key-data)
    4.  [4.3 新增语法 CREATE KEY](#4-3-%E6%96%B0%E5%A2%9E%E8%AF%AD%E6%B3%95-CREATE-KEY)
    5.  [4.4 新增语法 CREATE TABLE .. (protect=$data_key)](#4-4-%E6%96%B0%E5%A2%9E%E8%AF%AD%E6%B3%95-CREATE-TABLE-protect-x3D-data-key)
    6.  [4.5 对加密对象的数据进行加密](#4-5-%E5%AF%B9%E5%8A%A0%E5%AF%86%E5%AF%B9%E8%B1%A1%E7%9A%84%E6%95%B0%E6%8D%AE%E8%BF%9B%E8%A1%8C%E5%8A%A0%E5%AF%86)
5.  [参考](#%E5%8F%82%E8%80%83)

# 1 特性背景

# 2 实现方案

## 2.1 系统表

### 1\. pg_key_info 密钥信息

| keyoid | keyname | type | alrotithm | storage | access | protect | create_time | round |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | mk_1 | master_key | any | localkms | path=./keyfile | $pass1 | 2024/02/01 13:01:01 | - |
| 2 | dk_1 | date_key | aes_256_cbc | database | m100.d100.b1.i2 | mk1 | 2024/02/01 13:01:01 | 0 |

### 2\. pg_key_data 密钥数据

| oid | keydata | algorithm |
| --- | --- | --- |
| 3 | abcd1234 | aes_256 |

### 3\. pg_encryption 加密对象

| type | name | oid | special | protect | oldest_round |  |
| --- | --- | --- | --- | --- | --- | --- |
| table | t1 | 100 | - | dk_1 | 1 |  |

## 2.2 定义表

1.  定义表  
    定义表的语法与非加密表一致，我们通过单独的语法定义ENCRYPTION。

    ```sql
    CREATE TABLE t1 (c1 INT, c2 TEXT);
    ```

2.  定义索引

    ```sql
    CREATE INDEX i1 ON t1 (c1);
    ```

## 2.3 定义表加密

1.  定义主密钥

    ```sql
    CREATE KEY mk_1 (type=master_key, storage=localkms, access='./keyfile', protect='$pass1');
    ```

2.  定义数据密钥

    ```sql
    CREATE KEY dk_1 (type=data_key, protect=mk_1, algorithm=aes_256_cbc);
    ```

3.  定义表加密  
    表上的索引默认不加密

    ```sql
    CREATE ENCRYPTION (protect=dk_1) ON TABLE t1;
    ```

CREATE TABLE t1 (c1 INT, c2 TEXT);  
CREATE KEY mk_1 (type=master_key, storage=localkms, access=’./keyfile’, protect=’$pass1’);  
CREATE KEY dk_1 (type=data_key, protect=mk_1, algorithm=aes_256_cbc);  
CREATE ENCRYPTION (protect=dk_1) ON TABLE t1;  
SELECT \* FROM pg_encryption;

4.  定义表上索引加密

    ```sql
    CREATE ENCRYPTION (protect=dk_1) ON TABLE t1 WITH (index=on);
    ```

5.  定义表上xlog加密

    ```sql
    CREATE ENCRYPTION (protect=dk_1) ON TABLE t1 WITH (index=on, xlog=on);
    ```

6.  定义索引加密

    ```sql
    CREATE ENCRYPTION (protect=dk_1) ON INDEX i1;
    ```

## 2.4 操作表

1.  写入数据

    ```sql
    INSERT INTO t1 VALUES (1, 'aaaaa');
    ```

2.  查询数据

    ```sql
    SELECT * FROM t1;
    ```

## 2.5 管理表加密

1.  查看表加密

    ```sql
    SELECT * FROM pg_encryption;
    ```

2.  修改表加密的密钥

    ```sql
    ALTER ENCRYPTION (protect=dk_2) ON TABLE t1;
    ```

3.  删除表加密

    ```sql
    DROP ENCRYPTION ON TABLE t1;
    ```

## 2.6 管理主密钥

1.  查看主密钥信息

    ```sql
    SELECT * FROM pg_key_info WHERE type = 'master_key';
    ```

2.  修改主密钥

    ```sql
    ALTER KEY mk_1 SET (access='./keyfile2');
    ```

3.  删除主密钥

    ```sql
    DROP KEY mk_1;
    ```

## 2.7 管理数据密钥

1.  查看数据密钥信息

    ```sql
    SELECT * FROM pg_key_info WHERE type = 'data_key';
    ```

2.  查看数据密钥密文

    ```sql
    SELECT * FROM pg_key_data;
    ```

3.  轮转数据密钥

    ```sql
    ROTATION KEY dk_1;
    ```

4.  修改数据密钥

    ```sql
    ALTER KEY dk_1 SET (protect=mk_2);
    ```

5.  收集旧版本数据密钥信息

    ```sql
    VACUUM FULL t1;
    ```

6.  回收旧版本数据密钥

    ```sql
    VACUUM KEY dk_1;
    ```

7.  删除数据密钥

    ```sql
    DROP KEY dk_1;
    ```

## 2.8 管理加密定义

1.  删除加密定义

    ```sql
    DROP ENCRYPTION ON TABLE t1;
    ```

## 2.8 未来计划

### 一、功能补充

1.  在ENCRYPTION与KEY，KEY与KEY之间，添加DEPENDENCY约束
2.  为ENCRYPTION和KEY添加ACL，控制访问权限

### 二、语法复用

1.  定义列加密  
    该种定义可用于全密态数据库

    ```sql
    CREATE ENCRYPTION (protect=dk_1) ON COLUMN t1(c1);
    ```

2.  定义表空间加密

    ```sql
    CREATE ENCRYPTION (protect=dk_1) ON TABLESPACE spc1;
    ```

3.  定义数据库加密

    ```sql
    CREATE ENCRYPTION (protect=dk_1) ON DATABASE spc1;
    ```

4.  定义xlog加密

    ```sql
    CREATE ENCRYPTION (protect=dk_1) ON XLOG;
    ```

# 3 关键设计

## 3.1 格式设计

-   Page格式

    ```c
    +---------------+
    | PageHeader    | 在Header中，标记Page属于加密表，并标记加密状态
    |               |
    | tuple ..      |
    | tuple 2       |
    | tuple 1       |
    | PageSpecial   | 在Special中，记录密钥信息
    +---------------+
    ```

-   PageSpecial格式

    ```c
    typedef struct {
        uint8 version;
        uint8 algo;
        Tid   datakeypos;
        uchar iv[16];
        uchar mac[32];
    } PageEncInfo;
    ```

## 3.2 流程设计

### 整体流程

```java
@user
    create table t1 (.. dk_1)
@user:
    insert into t1 (..abc)
@kernel.postgres:
    heap_insert(t1, 'abc')
    page_init(t1.dk_1, page)
        memcpy(page, get_enc_info(t1.dk_1))
        page_set_flag(page, tde_flag)
    page_add_item(page, 'abc')
@kernel.checkpoint:
    smgrwrite(page)
        if (is_page_set_flag(page, tde_flag))
            page_encrypt_date(page)
```

### 加密粒度

### 加密时机

### 加密判断

### 密钥存储

### 解密时机

### 解密判断

### 密钥来源

## 3.3 其他设计

## 3.2 主备密钥同步

```python
# 主机
page_init(page, encinfo)
    memcpy(page, encinfo)
```

# 4 特性源码

## 4.1 功能概览

### 基本功能篇

1.  新增系统表：pg_key_info
2.  新增系统表：pg_key_data
3.  新增语法：CREATE KEY
4.  新增语法：CREATE TABLE .. (encrypt=xx)
5.  加密判断与密钥存储
6.  解密判断与密钥来源

### 高级功能篇

1.  索引的加密判断与密钥存储

3.  加密Redo Log

### 加强篇

1.  新增视图

## 4.2 新增系统表 pg_key_info

1.  查找oid

    ```bash
    cd $PGCODE/src/include/catalog
    chmod +x ./unused_oids
    ./unused_oids
    ```

    4001

2.  新增头文件 pg_key_info.h

    ```bash
    touch pg_key_info.h
    git add ./pg_key_info.h
    ```

    ```c
    #ifndef
    ```

3.  编译头文件

    ```bash
    cd $PGCODE/src/backend/catalog
    vi Makefile

    # add pg_key_info.h
    ```

4.  添加缓存 skip now

    ```bash
    cd $PGCODE/src/include/catlog
    vi indexing.h
    ```

```c
DECLARE_UNIQUE_INDEX(pg_key_info_keyoid, 4002, on pg_key_info using btree(keyoid oid_ops));
#define KeyInfoKeyoidIndexId		4002
```

5.  编译、安装、启动

6.  验证

    ```SQL
    SELECT * FROM pg_key_info;
    \d pg_key_info
    ```

## 4.2 新增系统表 pg_key_data

流程和方法与新增pg_key_info一致，此处不再赘述

## 4.3 新增语法 CREATE KEY

1.  定义主密钥

    ```sql
    CREATE KEY mk_1 (type=master_key, storage=localkms, access='./keyfile', protect='$pass1');
    ```

2.  定义数据密钥

    ```sql
    CREATE KEY dk_1 (type=data_key, protect=mk_1, algorithm=aes_256_cbc);
    ```

3.  负向用例

    ```sql
    -- 1. 不设置密钥类型
    CREATE KEY key1 (storage=localkms, access='./keyfile', protect='$pass1');

    -- 2. 主密钥 重名
    CREATE KEY mk_1 (type=master_key, storage=localkms, access='./keyfile', protect='$pass1');

    -- 3. 主密钥 未设置必要参数：storage等
    CREATE KEY mk_2 (type=master_key, access='./keyfile', protect='$pass1');

    -- 4. 主密钥 设置不支持的参数：keyoid, unkownpara
    CREATE KEY mk_2 (type=master_key, keyoid=1, torage=localkms, access='./keyfile', protect='$pass1');
    CREATE KEY mk_2 (type=master_key, unkownpara=1, torage=localkms, access='./keyfile', protect='$pass1');

    -- 5. 数据密钥 重名
    CREATE KEY dk_1 (type=data_key, protect=mk_1, algorithm=aes_256_cbc);

    --6. 数据密钥 对应的主密钥不存在
    CREATE KEY dk_2 (type=data_key, protect=mk_8, algorithm=aes_256_cbc);

    --7. 数据密钥 不支持的算法
    CREATE KEY dk_2 (type=data_key, protect=mk_1, algorithm=rsa_2048);
    ```

## 4.4 新增语法 CREATE TABLE .. (protect=$data_key)

1.  创建加密表

    ```sql
    CREATE TABLE t1 (c1 INT, c2 TEXT) WITH (protect=dk_1);
    ```

2.  创建加密索引

    ```sql
    CREATE INDEX i1 ON t1 USING btree(c2) WITH (protect=dk_1);
    ```

3.  负向用例

    ```sql
    -- 不设置参数
    CREATE TABLE t2 (c1 INT, c2 TEXT) WITH (protect);

    -- 不存在的数据密钥
    CREATE TABLE t2 (c1 INT, c2 TEXT) WITH (protect=dk_8);

    -- 密钥类型为主密钥
    CREATE TABLE t2 (c1 INT, c2 TEXT) WITH (protect=mk_1);
    ```

## 4.5 对加密对象的数据进行加密

# 参考

-   新增系统表：[https://blog.csdn.net/asmartkiller/article/details/120733642](https://blog.csdn.net/asmartkiller/article/details/120733642)
