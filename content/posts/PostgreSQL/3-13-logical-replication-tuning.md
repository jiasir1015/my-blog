+++
title = 'PostgreSQL 3-13 逻辑复制原理与性能优化'
date = '2025-12-29T20:38:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '逻辑复制', '性能优化']
weight = 313
ShowToc = true
TocOpen = true
+++
# 目录

1.  [目录](#%E7%9B%AE%E5%BD%95)
2.  [1 基本概念](#1-%E5%9F%BA%E6%9C%AC%E6%A6%82%E5%BF%B5)
    1.  [1.1 业务场景](#1-1-%E4%B8%9A%E5%8A%A1%E5%9C%BA%E6%99%AF)
    2.  [1.2 逻辑复制](#1-2-%E9%80%BB%E8%BE%91%E5%A4%8D%E5%88%B6)
    3.  [1.3 实现思路](#1-3-%E5%AE%9E%E7%8E%B0%E6%80%9D%E8%B7%AF)
    4.  [1.4 基本概念](#1-4-%E5%9F%BA%E6%9C%AC%E6%A6%82%E5%BF%B5)
3.  [2 使用方法](#2-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95)
    1.  [2.1 发布端：配置参数](#2-1-%E5%8F%91%E5%B8%83%E7%AB%AF%EF%BC%9A%E9%85%8D%E7%BD%AE%E5%8F%82%E6%95%B0)
    2.  [2.2 发布端：创建发布](#2-2-%E5%8F%91%E5%B8%83%E7%AB%AF%EF%BC%9A%E5%88%9B%E5%BB%BA%E5%8F%91%E5%B8%83)
    3.  [2.3 订阅端：创建订阅](#2-3-%E8%AE%A2%E9%98%85%E7%AB%AF%EF%BC%9A%E5%88%9B%E5%BB%BA%E8%AE%A2%E9%98%85)
4.  [3 核心设计](#3-%E6%A0%B8%E5%BF%83%E8%AE%BE%E8%AE%A1)
    1.  [3.1 整体架构](#3-1-%E6%95%B4%E4%BD%93%E6%9E%B6%E6%9E%84)
    2.  [3.2 工作流程](#3-2-%E5%B7%A5%E4%BD%9C%E6%B5%81%E7%A8%8B)
    3.  [3.3 数据格式](#3-3-%E6%95%B0%E6%8D%AE%E6%A0%BC%E5%BC%8F)
5.  [4 实现源码](#4-%E5%AE%9E%E7%8E%B0%E6%BA%90%E7%A0%81)
    1.  [4.1 订阅端：apply-launch](#4-1-%E8%AE%A2%E9%98%85%E7%AB%AF%EF%BC%9Aapply-launch)
    2.  [4.2 订阅端：apply-worker](#4-2-%E8%AE%A2%E9%98%85%E7%AB%AF%EF%BC%9Aapply-worker)
    3.  [4.3 发布端：postmaster](#4-3-%E5%8F%91%E5%B8%83%E7%AB%AF%EF%BC%9Apostmaster)
    4.  [4.4 发布端：wal-sender](#4-4-%E5%8F%91%E5%B8%83%E7%AB%AF%EF%BC%9Awal-sender)
6.  [5 性能优化](#5-%E6%80%A7%E8%83%BD%E4%BC%98%E5%8C%96)
    1.  [5.1 现状](#5-1-%E7%8E%B0%E7%8A%B6)
    2.  [5.2 优化方案](#5-2-%E4%BC%98%E5%8C%96%E6%96%B9%E6%A1%88)
        1.  [优化点一：发布端-流复制协议（逻辑数据）](#%E4%BC%98%E5%8C%96%E7%82%B9%E4%B8%80%EF%BC%9A%E5%8F%91%E5%B8%83%E7%AB%AF-%E6%B5%81%E5%A4%8D%E5%88%B6%E5%8D%8F%E8%AE%AE%EF%BC%88%E9%80%BB%E8%BE%91%E6%95%B0%E6%8D%AE%EF%BC%89)
        2.  [优化点二：订阅段-并行回放机制（逻辑数据）](#%E4%BC%98%E5%8C%96%E7%82%B9%E4%BA%8C%EF%BC%9A%E8%AE%A2%E9%98%85%E6%AE%B5-%E5%B9%B6%E8%A1%8C%E5%9B%9E%E6%94%BE%E6%9C%BA%E5%88%B6%EF%BC%88%E9%80%BB%E8%BE%91%E6%95%B0%E6%8D%AE%EF%BC%89)
        3.  [优化点三：发布端-并行解码机制](#%E4%BC%98%E5%8C%96%E7%82%B9%E4%B8%89%EF%BC%9A%E5%8F%91%E5%B8%83%E7%AB%AF-%E5%B9%B6%E8%A1%8C%E8%A7%A3%E7%A0%81%E6%9C%BA%E5%88%B6)
    3.  [5.3 未来方案](#5-3-%E6%9C%AA%E6%9D%A5%E6%96%B9%E6%A1%88)
        1.  [一、计划优化点一：发布端-事务提交等待](#%E4%B8%80%E3%80%81%E8%AE%A1%E5%88%92%E4%BC%98%E5%8C%96%E7%82%B9%E4%B8%80%EF%BC%9A%E5%8F%91%E5%B8%83%E7%AB%AF-%E4%BA%8B%E5%8A%A1%E6%8F%90%E4%BA%A4%E7%AD%89%E5%BE%85)
    4.  [5.4 方案分析](#5-4-%E6%96%B9%E6%A1%88%E5%88%86%E6%9E%90)
        1.  [一、事务正确性](#%E4%B8%80%E3%80%81%E4%BA%8B%E5%8A%A1%E6%AD%A3%E7%A1%AE%E6%80%A7)
7.  [6 性能测试](#6-%E6%80%A7%E8%83%BD%E6%B5%8B%E8%AF%95)
8.  [参考资料](#%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99)

# 1 基本概念

## 1.1 业务场景

-   **场景一：数据共享（异构数据库）**  
    1个公司，有2个部门：商品库存部门、商品成本部门。2个部门有不同技术栈，使用不同数据库产品:postgresql、mysql。2个部门需共享相同的表：商品信息表。

-   **场景二：数据容灾**  
    应用存储数据时，同时将数据存储至postgresql于mysql中，避免某款数据库出现无法恢复的数据损坏问题。

-   **场景三：版本升级**  
    从postgresql 13版本，升级到postgresql 16版本。

-   **场景四：数据迁移（异构数据库）**  
    从postgresql，将数据库迁移到mysql中。

## 1.2 逻辑复制

从一个数据库中，将针对指定表的insert、delete、update等写操作，复制到其他另一个数据库、工具等。  
复制该场景中，有2种角色：

-   **发布端**：发送端
-   **订阅端**：接收端

## 1.3 实现思路

此处，以postgresql为例，逻辑复制实现思路如下：

上图中，关键流程如下：

1.  执行sql：应用执行insert、delete、update等语句
2.  生成wal：postgres进程执行sql，生成wal，将wal写入文件
3.  发送wal：如果启用逻辑复制，发布端会启动一个用于逻辑复制的wal-sender进程，读取wal，将wal解码为logical-wal，并将logical-wal发送给订阅端
4.  重放logical-wal：订阅端将logical-wal当做单条insert、delete、update语句执行

## 1.4 基本概念

逻辑复制大致流程，与物理复制类似。不过，在复制流程中，差异也很多，以上图为例，关键差异如下：

-   物理复制
    1.  复制粒度：实例产生的所有wal
    2.  发送数据：wal
    3.  发送粒度：流
    4.  回放数据：回放wal
-   逻辑复制：
    1.  复制粒度：指定的一个或多个用户表，或者表中符合指定过滤条件的数据
    2.  发送数据：logical-wal。针对一个写操作，会发送一条对应的logical-wal，即一条message。message中的关键内容包括：操作、数据。
        -   **示例1：**
            -   执行sql：`INSERT INTO t1 VALEUS (1, 'data1')`
            -   生成wal：`[1] [1800 1810 0 1 ..] [1, 'data1'] ...`。格式为：操作类型、filenode、数据等
                -   格式：
            -   发送logical-wal: `[I] [1, 'data1']`
        -   **示例2：**
            -   执行sql：`DELETE FROM t1 WHERE c2 = 'data1'`
            -   生成wal：`[3] [1800 1810 0 1 ..]`。格式为：操作类型、filenode等
            -   发送logical-wal: `[D] ['data1']`
    3.  发送粒度：默认情况下，是一个完整事务包含的多条message
    4.  回放数据：apply logical-wal。提取logical-wal中的操作与数据，调用heapam层接口。示例：
        -   **示例1：**
            -   接收logical-wal: `[I] [1, 'data1']`
            -   回放logical-wal：heap_insert
        -   **示例2：**
            -   接收logical-wal: `[D] ['data1']`
            -   回放logical-wal：heap_beginscan、heap_delete

# 2 使用方法

## 2.1 发布端：配置参数

1.  修改wal级别，多存储一些信息

    ```bash
    echo "wal_level=logical" >> $PGDATA/postgresql.conf
    ```

2.  配置身份认证非核心参数

    ```bash
    echo "max_replication_slots=4" >> $PGDATA/postgresql.conf
    echo "max_wal_senders=4" >> $$PGDATA/postgresql.conf
    echo "max_logical_replication_workers=32" >> $PGDATA/postgresql.conf
    echo "listen_addresses='*'" >> $PGDATA/postgresql.conf

    sed -i '1i host all all 0.0.0.0/0 md5\n' $PGDATA/pg_hba.conf
    echo "host replication all 0.0.0.0/0 md5" >> $PGDATA/pg_hba.conf
    ```

3.  发布端：重启参数生效

## 2.2 发布端：创建发布

1.  创建表

    ```sql
    CREATE TABLE pt1(c1 INT,c2 TEXT);
    CREATE TABLE pt2(c1 INT, c2 TEXT);
    ```

2.  创建发布信息  
    指定哪些表需要复制。

    ```sql
    CREATE PUBLICATION pub1 FOR TABLE pt1,pt2;
    ```

3.  创建复制槽
    -   存储复制状态：wal的位置。
    -   存储数据格式

        ```sql
        SELECT pg_create_logical_replication_slot('pslot1', 'pgoutput');
        ```

4.  创建用户：订阅端通过该用户连接发布端，以进行数据传输

    ```sql
    CREATE USER pu1 REPLICATION SYSADMIN LOGIN ENCRYPTED PASSWORD 'pu1.12345';
    GRANT ALL ON pt1,pt2 TO pu1;
    ```

## 2.3 订阅端：创建订阅

1.  创建表  
    与发布端保持一致

    ```sql
    CREATE TABLE pt1(c1 INT,c2 TEXT);
    CREATE TABLE pt2(c1 INT, c2 TEXT);
    ```

2.  创建订阅信息

    ```sql
    CREATE SUBSCRIPTION sub1
        CONNECTION 'host=127.0.0.1 port=5432 dbname=pubdb user=pu1 password=pu1.12345'
        PUBLICATION pub1
        WITH (create_slot = false, slot_name = 'pslot1', copy_data = true);
    ```

    订阅端自动启动apply-worker进程，与发布端建立连接，接收发布端的logical-wal，并回放logical-wal。

# 3 核心设计

## 3.1 整体架构

逻辑复制架构中，有3类角色：

-   **应用**：发送sql
-   **发布端**：执行sql，生成wal，解码wal生成logical-wal，发送logical-wal
-   **订阅端**：接收logical-wal，回放logical-wal

以2个事务并发执行sql为例，在发布端，关键进程为wal-sender。在订阅端，关键进程为apply-worker。

## 3.2 工作流程

以下是一个典型场景的大致流程：

-   步骤1-9：发布端接收客户端连接，接收与执行sql
-   步骤10-28：订阅端启动实例，检查订阅信息，与发布端建立连接并进行逻辑复制

```bash
[发布端]                                                                                        [订阅端]

postmaster        postgres                     wal-writer    wal-sender              wal-file   postmaster             apply-launch                apply-worker
+-------------------+------------------------------+------------+---------------------------+---+---------------------------+---------------------------+----------------------+
| 1 receive connect |                              |            |                           |   |                           |                           |
| 2 fork postgres ->|                              |            |                           |   |                           |                           |
|                   | 3 receive sql                |            |                           |   |                           |                           |
|                   |   delete .. t1 .. c1=10      |            |                           |   |                           |                           |
|                   | 4 scan tuple from t1         |            |                           |   |                           |                           |
|                   | 5 get tuple pointer          |            |                           |   |                           |                           |
|                   | 6 mark tuple deleted         |            |                           |   |                           |                           |
|                   | 7 generate wal               |            |                           |   |                           |                           |
|                   |   type=delete,xid=11         |            |                           |   |                           |                           |
|                   |   filenode=1700,offset=8-3   |            |                           |   |                           |                           |
|                   |   data='10',column=1         |            |                           |   |                           |                           |
|                   | 8 copy wal to wal-buffer --->|            |                           |   |                           |                           |
|                                                  | 9 write wal--------------------------->|   |                           |                           |
|                                                               |                           |   | 10 startp                 |                           |
|                                                               |                           |   | 11 startup apply-launch ->|                           |
|                                                               |                           |   |                           | 12 read suscription       |
|                                                               |                           |   |                           | 13 calucate worker num    |
|                                                               |                           |   | <-------------------------| 14 register worker info   |
|                                                               |                           |   | 15 read bgworker info                                 |
|                                                               |                           |   | 16 startup apply-worker ----------------------------->|
| <-------------------------------------------------------------+---------------------------+-----------------------------------------------------------| 17 ask publication
| 18 receive connect                                            |                           |                                                           |
| 19 fork postgres as wal-sender ------------------------------>|                           |                                                           |
                                                                | 20 read wal <-------------|                                                           |
                                                                | 21 decod to decode-wal                                                                |
                                                                | 22 send decoded-wal ----------------------------------------------------------------->|
                                                                                                                                                        | 23 receive decoded-wal
                                                                                                                                                        | 24 apply decoded-wal
                                                                                                                                                        | (if is postgresql)
                                                                                                                                                        | 25 scan tuple from t1
                                                                                                                                                        | 26 get tuple pointer
                                                                                                                                                        | 27 mark tuple deleted
                                                                                                                                                        | 28 generate wal
```

## 3.3 数据格式

# 4 实现源码

上述流程中可以看到，逻辑复制由订阅端触发。此处，从订阅端开始，介绍复制流程：

## 4.1 订阅端：apply-launch

## 4.2 订阅端：apply-worker

## 4.3 发布端：postmaster

## 4.4 发布端：wal-sender

# 5 性能优化

## 5.1 现状

首先，以一个简单示例，介绍vastbase当前版本逻辑复制的工作流程，假设：有3个事务并行执行update, insert, delete等操作，复制流程如下：

![base](/images/PostgreSQL/3-13-logical-replication-tuning/base.png)

各关键步骤的解释如下：

-   **发布端**
    1.  **生成wal**: 执行事务，生成wal。产生wal的操作包括：begin, insert, update, delete, commit等
    2.  **读取wal-reacord**: wal-sender线程，按序读取wal-record
    3.  **解码wal-record**：wal-sender线程，提取wal-record中的关键信息，包括操作类型、tuple中的数据等逻辑信息，不包括filenode等物理信息，生成logical-msg。**1条wal-record生成1条logic-msg**
    4.  **缓存logic-msg**：生成logic-msg后，一般不直接发送，而是先缓存，达到特定条件才发送。属于同一事务的logical-msg缓存在一起
    5.  **发送txn-package**：当解码到commit transaction的wal-record时，发送一次txn-package，包含该事务所有的logic-msg
-   **订阅端**
    1.  **接收txn-package**：apply-worker线程，持续接收txn-package
    2.  **回放logic-msg**：从txn-package按序读取logic-msg中，解析操作类型、数据等，调用heapam层接口重放logical-msg

当前版本，几个关键设计如下：

-   **发布端**
    1.  **生成wal**
    2.  **读取wal-record**
    3.  **解码wal-record**
    4.  **发送txn-package**：
        -   发送内容：发送3个txn-package，1个txn-packag包含1个事务的所有logical-msg
        -   发送时机：解码到commit transaction的wal-record后
-   **订阅端**
    1.  **接收txn-package**：串行接收3个txn-package
    2.  **回放logic-msg**：串行回放txn-package中的所有logical-msg

## 5.2 优化方案

### 优化点一：发布端-流复制协议（逻辑数据）

从订阅段角度看，一次接收与处理一个事务的package，复制过程是串行的。

**流复制协议**，主要优化上述流程中的：发送txn-package、接收txn-package步骤，让发布端并行发送多个事务的logical-msg。即同一时刻，订阅端可能存在多个未提交的事务。

复制流程中，改动如下：

-   **发布端**
    1.  **生成wal**
    2.  **读取wal-record**
    3.  **解码wal-record**
    4.  **发送stm-package**：
        -   发送内容：发送3个或更多的stm-package，1个stm-packag包含1个事务的部分logical-msg
        -   发送时机：已缓存的logical-msg总大小达到阈值，以及解码到commit transaction的wal-record后
-   **订阅端**
    1.  **接收stm-package**：接收3个或更多的stm-package
    2.  **回放logic-msg**

流程图如下：

![opt1](/images/PostgreSQL/3-13-logical-replication-tuning/opt1.png)

### 优化点二：订阅段-并行回放机制（逻辑数据）

**并行回放机制**，主要优化上述流程中的：回放logical-msg步骤，让订阅端并行回放多个事务的logical-msg。流复制协议，让发布端并行发送事务数据，并行回放机制，依赖流复制协议。

复制流程中，改动如下：

-   **发布端**
    1.  **生成wal**
    2.  **读取wal-record**
    3.  **解码wal-record**
    4.  **发送stm-package**：
-   **订阅端**
    1.  **接收stm-package**：leader线程，持续接收stm-package，提取、记录事务信息，分发stm-package给worker，由worker完成apply。从package中提取xid，判断事务状态：
        -   事务开始：（即本事务的第1个stm-package）
            -   尝试申请1个空闲的worker，发送stm-package。之后，worker被该事务独占，只接收、回放本事务的stm-package，直到回放完事务commit或abort的logical-msg，才释放worer
            -   如果没有空闲worker，stm-package会暂时缓存，等待空闲worker
        -   事务进程中（即本事务的第2+个stm-package）
            -   查找已占用的worer，发送stm-package
        -   事务结束（package中commit/abort对应的logical-msg）
            -   查找对应的worer，发送stm-package，等待对commit/abort的apply，才继续接收下一个package
    2.  **回放logic-msg**：worker线程，接收stm-package，提取logical-msg中的信息，调用heapam接口回放。

流程图如下：

![opt2](/images/PostgreSQL/3-13-logical-replication-tuning/opt2.png)

另外，事务并行后，需确保**数据一致性**。示例：在发布单，有事务1和2，更新同1个tuple，事务1先更新，事务wal日志如下：

```bash
B: 1
B: 2
U: 1 -- 先更新
C: 1
U: 2 -- 事务1提交后，才更新成功
C: 2
```

在并行回放场景，订阅端，必须确保：C:1限制，U:2后执行。当前方案中，解决该问题的设计如下：

1.  发布端：解码到C后，直接发送
2.  订阅端：接收到C后，等待C回放完成，再继续接收后续的logical-msg

另外，还有一些特殊场景，与核心设计无关，此处不展开讨论，比如：

1.  混合机制：发布端同时发送stm-packpage和txn-package（订阅端启用1个txn-worker和多个stm-worker，txn-worker只处理txn-package）
2.  抢占机制：收到stm-package，内含commit的logical-msg，但是，没有空闲的stm-worker，无法处理commit。（此时txn-worker是空闲的，抢占txn-worker）

### 优化点三：发布端-并行解码机制

高并发场景，在发布端，有数百个线程执行事务并生成wal，而仅有1个线程解码wal。实现流复制协议、并行回放机制后，解码存在瓶颈，因此，需使用**并行解码机制**。

当前版本的vastbase中，已具备并行解码功能，只是无法用于逻辑复制场景，需额外改动适配。

复制流程中，改动如下：

-   **发布端**
    1.  **生成wal**
    2.  **读取wal-record**
        -   以前，读取、解码、发送步骤，由1个wal-sender线程完成。现在，将读取、解码、发送等步骤，拆分为多个线程。该机制非本次新增，此处不再详细介绍。
    3.  **解码wal-record**
    4.  **发送stm-package**
-   **订阅端**
    1.  **接收stm-package**
    2.  **回放logic-msg**

最终，集成3个优化方案后，流程图如下：

![opt3](/images/PostgreSQL/3-13-logical-replication-tuning/opt3.png)

目前，测试数据如下：

-   测试场景：tpcc

    -   部署：单机
    -   warhouse：100
    -   并发：400
    -   tpmc：约40w
-   测试结果

    -   基线：
        -   发布端wal生成速度：约100m/s
        -   端到端逻辑复制：约10m/s
    -   目标：
        -   端到端逻辑复制：70-100m/s
    -   优化后：
        -   端到端逻辑复制：解码、发送、接收、多线程分发、并行回放(60-100个线程)：约50m/s
        -   订阅端只接收：解码、发送、接收：80+m/s
        -   订阅端只多线程分发：解码、发送、接收、多线程分发：70+m/s
-   性能瓶颈

    -   worker饥饿：通过火焰图分析，订阅端的worker线程，大部分时候出于饥饿状态，需继续优化，充分利用worker线程。 ![sub-perf](/images/PostgreSQL/3-13-logical-replication-tuning/sub-perf.png)
    -   负载均衡：tpcc中，1个事务中执行的写操作，从5个到20+个不等，订阅端回放结果如下： ![sub-res](/images/PostgreSQL/3-13-logical-replication-tuning/sub-res.png)

## 5.3 未来方案

### 一、计划优化点一：发布端-事务提交等待

发布端解码事务commit日志后，判断订阅端进行中的事务量，如果事务较少，则先发送一批其他事务的stm-packpage，再发送commit的logical-msg

## 5.4 方案分析

### 一、事务正确性

# 6 性能测试

# 参考资料

-   pg 邮件列表：[https://www.postgresql.org/list/pgsql-hackers/](https://www.postgresql.org/list/pgsql-hackers/)
