+++
title = '海量 11 需求 逻辑复制性能优化'
date = '2026-02-06T14:30:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['逻辑复制', '性能优化', '需求文档']
weight = 1100
ShowToc = true
TocOpen = true
+++
# 1 简介

## 1.1 目的

**逻辑复制**是一种在多个数据库实例之间复制数据的功能，通常用于从一个数据库实例中，将针对指定表的insert、delete、update等写操作，复制到其他另一个数据库实例。在数据库术语中，统一称逻辑复制的发送方为**发布端**，称接收方为**订阅端**。Oracle、Postgresql、Vastbase等数据库产品，均提供逻辑复制功能。

当前版本，逻辑复制性能较低，以tpcc场景为例，发布端40w tmpc时，订阅端的复制速度约10m/s。在滚动升级等场景，通过逻辑复制在不同实例间同步大量数据，要求逻辑复制性能达到70-100m/s。

发布端、订阅端均存在性能瓶颈，均需要优化。但是，由于交付时间较短，以及订阅端方案仍有瑕疵等因素，本版本交付发布端性能优化，下版本交付订阅端性能优化。

## 1.2 适用范围

本文主要用于向开发、测试等角色，介绍G100 3.0.9 psu2及之后版本，逻辑复制的性能优化的设计方向与使用方法。

## 1.3 术语定义、首字母缩写词和缩略语

-   发布端：逻辑复制场景，发送数据方。
-   订阅端：逻辑复制场景，接收数据方。

## 1.3 参考资料

-   Vastbase G100产品文档中逻辑复制使用介绍：[https://docs.vastdata.com.cn/zh_CN/VastbaseG100/V3.0.8/1/f5c2ae8eb9744d429ad39c02438addf6](https://docs.vastdata.com.cn/zh_CN/VastbaseG100/V3.0.8/1/f5c2ae8eb9744d429ad39c02438addf6)

# 2 G100审计功能重构

## 2.1 功能简述

### 需求背景：逻辑复制使用

使用逻辑复制的流程如下：

1.  发布端：配置逻辑复制

    ```bash
    # 设置wal日志详细级别，设计身份等参数，重启集群
    gs_guc set -D $PGDATA -c 'wal_level=logical'
    gs_guc set -D $PGDATA -h "host all all 0.0.0.0/0 md5"
    gs_guc set -D $PGDATA -h "host replication all 0.0.0.0/0 md5"
    vb_ctl restart -D $PGDATA
    ```

2.  发布端：创建表

    ```sql
    CREATE TABLE pt1(c1 INT,c2 TEXT);
    CREATE TABLE pt2(c1 INT, c2 TEXT);
    ```

3.  发布端：创建发布，即指定哪些表需复制

    ```sql
    CREATE PUBLICATION pub1 FOR TABLE pt1,pt2;
    ```

4.  发布端：创建逻辑复制槽，用于存储复制状态等信息

    ```sql
    SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
    ```

5.  发布端：创建用户。订阅端通过该用户连接发布端，以进行数据传输

    ```sql
    CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';
    GRANT ALL ON pt1,pt2 TO pu1;
    ```

6.  订阅端：创建表，需与发布端表结构一致

    ```sql
    CREATE TABLE pt1(c1 INT,c2 TEXT);
    CREATE TABLE pt2(c1 INT, c2 TEXT);
    ```

7.  订阅端：创建订阅信息

    ```sql
    CREATE SUBSCRIPTION sub1
        CONNECTION 'host=127.0.0.1 port=5432 dbname=pubdb user=pu1 password=pu1.12345'
        PUBLICATION pub1
        WITH (create_slot = false, slot_name = 'pslot1', copy_data = true);
    ```

8.  复制数据  
    发布端操作数据时，逻辑复制会自动复制操作、数据等至订阅端。

    ```sql
    -- 发布端变更数据
    INSERT INTO pt1 VALUES (1, 'data1');
    SELECT * FROM pt1;
    ```

    逻辑复制自动同步数据，订阅端数据与发布端保持一致。

    ```sql
    -- 订阅端：预期查询结果与发布端保持一致
    SELECT * FROM pt1;
    ```

### 需求背景：逻辑复制原理

逻辑复制功能，本质是复制解码之后的wal。此处，如下图所示，以一个实际场景为例，梳理完整的复制流程：

![rep](/images/ProjectDocs/11-requirement-logical-replication/rep.png)

上图中，关键流程如下：

-   发布端
    -   (1) 生成wal  
        在发布端，应用执行insert、delete、update等语句，产生wal
    -   (2) 解码wal  
        启用逻辑复制时，发布端会启动一个独立的wal-sender线程，持续读取wal，解码wal，即提取wal中的操作、数据等关键信息，最终生成logical-wal
    -   (3) 发送logical-wal  
        wal-sender线程持续将logical-wal发送给订阅端
-   订阅端
    -   (4) 接收loigcal-wal  
        在订阅端，持续接收logical-wal
    -   (5) 重放logical-wal  
        从logical-wal提取操作、数据等关键信息，将其看做单条insert、delete、update等语句并执行。

本需求主要优化上述流程中的两个阶段：(2)解码wal、(3)发送logical-wal

### 需求概述：一、并行解码

当前版本，发布端支持并行解码，但是，不可用于逻辑复制场景，订阅端只能是工具，不能是数据实例。本需求将修改并行解码，以用于逻辑复制场景。

本需求的第一个修改如下：

-   修改前：逻辑复制场景，只能1个线程并行解码wal
-   修改后：逻辑复制场景，支持[1，32]个线程解码wal

### 需求概述：二、流复制协议

当前版本，发布端解码wal生成logical-wal之后，会暂时缓存logical-wal，同一事务的所有logical-wal缓存在一起。当处理到事务commit/abort的wal时，才统一发送本事务的所有logical-wal。

从订阅端的角度看，发布端依次地、串行地发送事务的logical-wal。为确保事务正确性，订阅端无法并行回放logical-wal。

pg-14以及之后版，支持流复制协议，设计思想是发送为完成事务的logical-wal，让订阅端会同时存在多个未提交事务的logical-wal，让其并行回放。本需求引入流复制协议，并进行优化。

本需求的第二个修改如下：

-   修改前：只能使用事务复制协议，1次复制1个完整的事务。
-   修改后：
    -   新增混合流复制协议（与pg保持一致）：1次复制1个完整的事务，或者1个不完整的事务
        -   原理：发布端缓存事务logical-wal，当缓存大小达到阈值时，发送logical-wal最多的事务的所有loigcal-wal，即使该事务未commit或abort
    -   新增完全流复制协议（性能远高于pg）：1次发送1条logical-wal，即与事务无关。
        -   不缓存logical-wal，生成logical-wal后，直接发送logial-wal。

### 需求概述：下版本工作计划

当前版本，订阅端只有1个线程回放logical-wal，无法使用处理流复制协议。下一版本，订阅端支持多线程并行回放logical-wal，并行回放的前提条件是发布端使用流复制协议发送logical-wal。

![next](/images/ProjectDocs/11-requirement-logical-replication/next.png)

## 2.2 功能说明

### 2.2.1 使用流程

#### 场景一、使用混合流复制协议

todo

#### 场景二、使用完全流复制协议

todo

### 2.2.2 配置参数和文件

1.  CREATE/ALTER SUBSCRIPTION语法中，主动指定参数，控制是否启用流复制协议
2.  pg_recvlogical工具中，主动指定参数，控制是否使用流复制协议

### 2.2.3 数据相关性

无

## 2.3 接口信息

1.  修改CREATE/ALTER SUBSCRIPTION语法

    -   修改前

        ```sql
        CREATE SUBSCRIPTION subname
            CONNECTION '连接参数'
            PUBLICATION pubname
            WITH (参数)
        ```

    -   修改后

        ```sql
        CREATE SUBSCRIPTION subname
            CONNECTION '连接参数'
            PUBLICATION pubname
            WITH (参数)
        ```

2.  修改pg_recvlogical工具

    -   修改前
    -   修改后

## 2.4 正反向行为

### 2.4.1 生效说明

### 2.4.2 提示信息

### 2.4.3 约束和依赖

无

## 2.5 安全性

### 2.5.1 权限控制

已有语法新增参数，不涉及权限变更

### 2.5.2 审计

已有语法新增参数，无需单独适配审计

## 2.6 影响范围

### 2.6.1 对已有UDT,UDF, ECPG的影响

无

### 2.6.2 对系统函数的影响

无

### 2.6.3 对系统CATALOG的影响

无

### 2.6.4 对xlog日志格式、数据格式的影响

无

### 2.6.5 与其他功能交互时的行为表现

逻辑复制协议：todo

### 2.6.6 版本兼容性

旧版本升级：todo

### 2.6.7 用户行为变更

1.  修改CREATE/ALTER SUBSCRIPTION语法
2.  修改pg_recvlogical工具

## 2.7 指标相关

### 2.7.1 关键资源指标

-   CPU：
-   内存：
-   IO：
-   磁盘：

### 2.7.2 系统性指标

无

### 2.7.3 性能指标

使用pg_recvlogial工具测试，发送速度大于70m/s

## 2.8 测试建议

无法端到端使用逻辑复制，只能使用pg_recvlogical验证，建议等下版本合入订阅端优化后，再详细测试。

## 2.9 其他说明
