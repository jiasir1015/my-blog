+++
title = 'PostgreSQL 3-13 逻辑复制性能优化'
date = '2025-11-21T15:18:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '逻辑复制', '性能优化']
weight = 313
ShowToc = true
TocOpen = true
+++
> **2025-11-21：持续更新中…**

# 1 需求概述

## 1.1 原始需求

主备部署模式下，滚动升级时，可能存在主节点未升级，备节点已升级的情况。在该条件下，客户要求主节点持续执行事务，并且主节点及时将数据同步至备节点。目前，存在一下问题：

-   物理复制无法使用：由于主节点、备节点版本不一致，主节点生成的wal，备节点可能无法使用。因此，只能使用逻辑复制方案。
-   逻辑复制性能较低：主节点作为发布端，解码wal。备节点作为订阅端，接收loggic-wal，并且回放logic-wal，可解决主备版本不一致的问题。但是，目前Vastbase的逻辑复制功能性能较低，无法满足及时同步数据的要求。

本需求将针对上述场景，端到端优化逻辑复制功能，让逻辑复制性能整体提升5倍以上，达到100m/s的要求。

-   需求来源：[https://doc.weixin.qq.com/doc/w3_AYsAjQYkADwCNecwqsBM8ShS9YejB?scode=AHUAfwdSAA8UDeKla8AdwAfAa7AFk&roomid=Person%3A1688855660690652%3A1688855164259723&version=5.0.2.6008&platform=win](https://doc.weixin.qq.com/doc/w3_AYsAjQYkADwCNecwqsBM8ShS9YejB?scode=AHUAfwdSAA8UDeKla8AdwAfAa7AFk&roomid=Person:1688855660690652:1688855164259723&version=5.0.2.6008&platform=win)

## 1.2 问题分析

逻辑复制分为多个阶段，openGauss和PostgreSQL在部分阶段中做了优化，但未端到端优化。因此，本文将以早期逻辑复制为基础，指出优化设计。

### 版本一：串行复制

在postgresql 13以及之前版本，逻辑复制的关键设计如下：

-   发布端：
    -   解码日志：wal-sender进程，持续读取wal，串行对wal进行decode，生成logic-wal，并将不同事务的logic-wal，分别存放。
    -   发送日志：对wal进行decode时，如果是事务提交产生的wal，则将该事务的所有logic-wal打包，并发送到订阅端。
-   订阅端：
    -   回放日志：apply-worker进程，一次接收同一事务的一批logic-wal，串行回放本批logic-wal后，重新等待下一个事务的logic-wal。

整体方案如下：

![pg-13](/images/PostgreSQL/3-13-replication/pg-13.png)

以上设计，存在多项性能瓶颈，以常见的tpcc测试为例，可能有400+postgres进程在执行事务，实时产生wal日志。但是，只有1个wal-sender进程在串行解码日志，只有1个apply-workder在串行回放日志。

## 1.3 方案设计

### 版本二：发布端并行解码

在openGauss中，针对发布端的解码日志阶段，进行了优化，引入多个decoder线程，并行解码wal生成logic-wal。方案设计如下：

![og](/images/PostgreSQL/3-13-replication/og.png)

但是，在订阅端，每次对一个事务的一批logica-wal全部回放后，才会接收下一个事务的logic-wal。仅引入并发解码机制，对性能提升较小。发布端和订阅端，均存在负载不均衡的问题，例如，订阅端回放完一个事务的logic-wal之后，需等待下一个事务的logic-wal。

### 版本三：流氏复制协议

在postgrsql 14版本，针对发布端发送日志阶段，进行了优化，引入流式复制协议，即无需一次发送完一个事务完整的一批logic-wal，而是随时发送logic-wal，即使事务未提交。可解决发布端、订阅端负载不均衡的问题。

但是，在订阅端，tpcc场景，发布端400+postgres进程执行事务，订阅端1个apply-worker进程回放日志，仍是瓶颈。

### 版本四：订阅端并行回放

在postgrsql 16版本，针对订阅端回放日志阶段，进行了优化，引入多个apply进程，并行回放logic-wal。方案设计如下：

![pg-16](/images/PostgreSQL/3-13-replication/pg-16.png)

### 版本五：并行复制

-   结论：本需求参考性能测试结果，认为需同时结合：并行解码、流式复制、并行回放机制，才能提升逻辑复制端到端性能。
-   优先级：其中，流式复制、并行回放机制，对性能影响较大，优先级较高。可独立地、优先地实现。
-   其他工作：同时采用上述3个机制，需合理控制发布端解码速率、订阅端回放速率，在实现负载均衡的同事，避免logic-wal堆积。

# 2 设计分析

## 2.1 必要性

根据postgrsql-16的性能测试结果，流式复制和并行回放机制，可达到70Mb/s的复制速度。

### 一、测试场景

-   测试机器：
    -   IP：172.16.103.90
    -   硬件：CPU：鲲鹏920-ARM-128核。缓存L1-L2-L3：8M/64M/256M。内存：760G。磁盘：NVME
    -   系统：openEuler
-   tpcc测试场景（为了快速测试，不太标准）
    -   数据量：100 warhouse
    -   并发：400
    -   执行时间：1 min
-   逻辑复制配置：
    -   部署：发布端、订阅端在同一台机器（找不到2台性能机）
    -   订阅：创建1个publiction，涵盖所有table

## 二、测试数据

由于机器、时间等限制，测试未严格控制变量，但是，和准确结果应该有80%以上符合度。

| 版本 | 配置 | tpmc | 发布端-wal写入速度 | 逻辑复制速度（峰值） | 逻辑复制速度（平均值） |
| --- | --- | --- | --- | --- | --- |
| postgrsql-14 | 串行解码、非流式复制、串行回放 | 约65w | 207 Mb/s | - | 16 Mb/s |
| postgresql-16 | 串行解码、流式复制、串行回放 | 约65w | 212 Mb/s | 117 Mb/s | 55 Mb/s |
| postgresql-16 | 串行解码、流式复制、并行回放(4) | 约65w | 197 Mb/s | 113 Mb/s | 71 Mb/s |

> -   测试：贾旭辉
> -   详细数据和结论见wiki：[https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001007526](https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001007526)

-   尝试修改源码，让订阅端只接受日志，不apply，确定发布端解码和发送的瓶颈，但是，测试结果有点奇怪，有空再继续。

## 2.2 可行性

-   并行解码：openGauss已引入
-   流式复制：postgreql-16版本已成熟
-   并行回放：postgreql-16版本已成熟

## 2.3 潜在风险

### 一、数据有一致性

1.  写写冲突

    ```sql
    -- 前提
    create table t1(c1 text);
    insert into t1 values('a'), ('b'), ('c');

    -- 事务1
    begin;
    insert into t1 values('d');

    -- 事务2
    begin;
    delete from t1 where c1 = 'b';

    -- 事务1
    update t1 set c1 = 'b1' where c1 = 'b';
    -- 阻塞
    ```

2.  写读无冲突

    ```sql
    -- 前提
    create table t1(c1 text);
    insert into t1 values('a'), ('b'), ('c');

    -- 事务1
    begin;
    insert into t1 values('d');

    -- 事务2
    begin;
    insert into t1 values('e');

    -- 事务1
    select * from t1;
    ```

-   并行回放：需验证数据最值一致性，不同事务语句的执行顺序，可能影响发布端、订阅端表数据的一致性。

## 2.4 工作量

# 3 详细设计

# 4 参考资料

-   逻辑复制架构：[https://www.cnblogs.com/wy123/p/18946661](https://www.cnblogs.com/wy123/p/18946661)
-   GaussDB并行逻辑解码：[https://developer.huawei.com/consumer/cn/forum/topic/0201165508224221138](https://developer.huawei.com/consumer/cn/forum/topic/0201165508224221138)
-   pg16并行回放：[https://www.webkt.com/article/7715](https://www.webkt.com/article/7715)
-   openGauss并行解码测试：[https://www.cnblogs.com/jerrywang1983/articles/18375212](https://www.cnblogs.com/jerrywang1983/articles/18375212)
