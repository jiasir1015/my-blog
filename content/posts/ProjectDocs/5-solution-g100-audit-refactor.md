+++
title = '海量 5 方案 G100审计重构'
date = '2025-04-23T18:00:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['审计', '设计文档']
weight = 500
ShowToc = true
TocOpen = true
+++
1.  [1 审计特性介绍](#1-%E5%AE%A1%E8%AE%A1%E7%89%B9%E6%80%A7%E4%BB%8B%E7%BB%8D)
    1.  [1.1 核心功能](#1-1-%E6%A0%B8%E5%BF%83%E5%8A%9F%E8%83%BD)
    2.  [1.2 整体架构（308.3）](#1-2-%E6%95%B4%E4%BD%93%E6%9E%B6%E6%9E%84%EF%BC%88308-3%EF%BC%89)
    3.  [1.3 工作流程（308.3）](#1-3-%E5%B7%A5%E4%BD%9C%E6%B5%81%E7%A8%8B%EF%BC%88308-3%EF%BC%89)
    4.  [1.4 文件组织](#1-4-%E6%96%87%E4%BB%B6%E7%BB%84%E7%BB%87)
2.  [2 使用审计特性](#2-%E4%BD%BF%E7%94%A8%E5%AE%A1%E8%AE%A1%E7%89%B9%E6%80%A7)
    1.  [2.1 配置审计特性](#2-1-%E9%85%8D%E7%BD%AE%E5%AE%A1%E8%AE%A1%E7%89%B9%E6%80%A7)
    2.  [2.2 启动数据库](#2-2-%E5%90%AF%E5%8A%A8%E6%95%B0%E6%8D%AE%E5%BA%93)
    3.  [2.3 生成审计日志](#2-3-%E7%94%9F%E6%88%90%E5%AE%A1%E8%AE%A1%E6%97%A5%E5%BF%97)
    4.  [2.4 查询审计日志](#2-4-%E6%9F%A5%E8%AF%A2%E5%AE%A1%E8%AE%A1%E6%97%A5%E5%BF%97)
    5.  [2.5 异常管理](#2-5-%E5%BC%82%E5%B8%B8%E7%AE%A1%E7%90%86)
3.  [3 审计特性变更点](#3-%E5%AE%A1%E8%AE%A1%E7%89%B9%E6%80%A7%E5%8F%98%E6%9B%B4%E7%82%B9)
    1.  [3.1 问题分析](#3-1-%E9%97%AE%E9%A2%98%E5%88%86%E6%9E%90)
    2.  [2.2 重构目标](#2-2-%E9%87%8D%E6%9E%84%E7%9B%AE%E6%A0%87)
    3.  [2.3 问题分析（当前版本）](#2-3-%E9%97%AE%E9%A2%98%E5%88%86%E6%9E%90%EF%BC%88%E5%BD%93%E5%89%8D%E7%89%88%E6%9C%AC%EF%BC%89)
        1.  [一、存储日志慢](#%E4%B8%80%E3%80%81%E5%AD%98%E5%82%A8%E6%97%A5%E5%BF%97%E6%85%A2)
        2.  [二、检索日志慢](#%E4%BA%8C%E3%80%81%E6%A3%80%E7%B4%A2%E6%97%A5%E5%BF%97%E6%85%A2)
        3.  [三、文件问题多](#%E4%B8%89%E3%80%81%E6%96%87%E4%BB%B6%E9%97%AE%E9%A2%98%E5%A4%9A)
    4.  [2.4 重构方案](#2-4-%E9%87%8D%E6%9E%84%E6%96%B9%E6%A1%88)
        1.  [一、存储日志重构](#%E4%B8%80%E3%80%81%E5%AD%98%E5%82%A8%E6%97%A5%E5%BF%97%E9%87%8D%E6%9E%84)
        2.  [二、检索日志](#%E4%BA%8C%E3%80%81%E6%A3%80%E7%B4%A2%E6%97%A5%E5%BF%97)
    5.  [2.5 重构开销](#2-5-%E9%87%8D%E6%9E%84%E5%BC%80%E9%94%80)
    6.  [2.6 重构影响](#2-6-%E9%87%8D%E6%9E%84%E5%BD%B1%E5%93%8D)
    7.  [2.7 性能测试](#2-7-%E6%80%A7%E8%83%BD%E6%B5%8B%E8%AF%95)
4.  [3 审计特性详细设计](#3-%E5%AE%A1%E8%AE%A1%E7%89%B9%E6%80%A7%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)
    1.  [3.1 架构设计](#3-1-%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1)
        1.  [一、整体架构](#%E4%B8%80%E3%80%81%E6%95%B4%E4%BD%93%E6%9E%B6%E6%9E%84)
        2.  [二、工作流程](#%E4%BA%8C%E3%80%81%E5%B7%A5%E4%BD%9C%E6%B5%81%E7%A8%8B)
        3.  [三、文件组织](#%E4%B8%89%E3%80%81%E6%96%87%E4%BB%B6%E7%BB%84%E7%BB%87)
    2.  [3.2 详细设计](#3-2-%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)
        1.  [一、配置审计特性](#%E4%B8%80%E3%80%81%E9%85%8D%E7%BD%AE%E5%AE%A1%E8%AE%A1%E7%89%B9%E6%80%A7)
        2.  [二、审计文件管理](#%E4%BA%8C%E3%80%81%E5%AE%A1%E8%AE%A1%E6%96%87%E4%BB%B6%E7%AE%A1%E7%90%86)
    3.  [三、 启动数据库](#%E4%B8%89%E3%80%81-%E5%90%AF%E5%8A%A8%E6%95%B0%E6%8D%AE%E5%BA%93)
    4.  [四、生成审计日志](#%E5%9B%9B%E3%80%81%E7%94%9F%E6%88%90%E5%AE%A1%E8%AE%A1%E6%97%A5%E5%BF%97)
    5.  [五、存储审计日志](#%E4%BA%94%E3%80%81%E5%AD%98%E5%82%A8%E5%AE%A1%E8%AE%A1%E6%97%A5%E5%BF%97)
    6.  [六、审计日志一致性](#%E5%85%AD%E3%80%81%E5%AE%A1%E8%AE%A1%E6%97%A5%E5%BF%97%E4%B8%80%E8%87%B4%E6%80%A7)
    7.  [七、归并审计日志](#%E4%B8%83%E3%80%81%E5%BD%92%E5%B9%B6%E5%AE%A1%E8%AE%A1%E6%97%A5%E5%BF%97)
    8.  [八、查询审计日志](#%E5%85%AB%E3%80%81%E6%9F%A5%E8%AF%A2%E5%AE%A1%E8%AE%A1%E6%97%A5%E5%BF%97)
5.  [4 审计后续重构计划](#4-%E5%AE%A1%E8%AE%A1%E5%90%8E%E7%BB%AD%E9%87%8D%E6%9E%84%E8%AE%A1%E5%88%92)

**摘要**

> 介绍审计特性，分析性能问题，提出优化方案，评审优化方案，规划其他计划

# 1 审计特性介绍

## 1.1 核心功能

-   审计特性：记录数据库内的各种事件，事件包括：

    -   启动、恢复、切换、停止集群
    -   登录、注销账号
    -   创建、修改、删除数据库对象，包括：DATABASE、SCHEMA、TABLE等
    -   插入、更新、删除、查询关系表
    -   …
-   描述事件：数据库内发生的事件，都可描述为<主体><操作><客体>

    -   主体：一般是数据库用户
    -   客体：集群、账号、数据对象等
    -   操作：不同客体操作类型不一样。比如，对于TABLE，操作类型有：CREATE, INSERT, SELECT等。
-   审计日志：针对每个事件，审计模块都会生成一条或多条审计日志，审计日志中记录事件关键信息，包括：

    -   主体信息：用户名、客户端IP、登入的数据库名、线程id等
    -   操作信息：操作的类型、操作的时间、操作的SQL语句等
    -   客体信息：客体类型、客体名称、客体属于哪个database、客体属于哪个schema

## 1.2 整体架构（308.3）

审计架构如下图所示，按模块划分，可将审计划分为5个模块：

1.  管理模块：管理审计配置，相关配置由GUC控制，可分为3类：审计范围、日志传输、审计文件。管理审计内存、锁等资源，启停审计线程
2.  事件模块：发生关键事件时，如启停集群、执行SQL语句等，收集事件关键信息，即主体、操作、客体关键信息，将各类事件封装为统一格式的审计日志，并将其发送至审计线程
3.  存储模块：
    -   审计写线程：接收审计日志，按文件格式组织日志，将日志存储至文件中。如果有多个写线程，每个写线程都有独立的日志缓冲区、日志文件。同一时间段内生成的多条日志，可能存储于多个文件中
    -   审计归并线程：读取同一时间段内多个审计文件，排序日志，合并为同1个审计文件
4.  文件模块：管理多种状态的审计文件，包括：正在写、待归并、已归并等
5.  查询模块：
    -   在线查询：通过内置函数，查询一段时间内的日志
    -   离线查询：通过离线工具，解析二进制格式的日志文件

## 1.3 工作流程（308.3）

审计特性的工作流程如下图所示：

1.  用户：通过GUC参数，配置审计特性，包括审计范围、日志传输、审计文件等。
2.  主线程：启动审计线程
3.  工作线程：在关键流程中，收集审计事件。以执行DML为例，审计处理流程包括：
    -   在清理计划阶段，收集审计事件，事件包括主体、操作、客体等信息。然后，将事件封装为日志后，发送给审计写线程。由审计线程负责将日志落盘
    -   在事务提交阶段，如果开启日志同步落盘机制，则等待审计线程将日志落盘
4.  审计writer线程：不断将接收到的日志写至磁盘
5.  审计merger线程：存在多个审计写线程的情况下，将同一时间段内的多个已写完的文件，合并为1个文件

## 1.4 文件组织

在存在多个writer线程的场景，日志文件有3种状态：

-   正在写：writer线程正在写的文件
-   已写完：writer线程已写完的文件，merger未归并或者归并中
-   已归并：merger归并多个已写完的文件，生成的最终文件

1个审计文件，由多个page组成。1个page由header和多条log组成，log可跨page存储

# 2 使用审计特性

## 2.1 配置审计特性

1.  开启审计特性

    ```bash
    vb_guc set .. "audit_enable=on"
    ```

2.  设置文件管理参数

    ```bash
    # 1 日志目录
    vb_guc set .. "audit_directory='/pato/to/audit_log'"
    # 2 归档目录
    vb_guc set .. "audit_dump_directory=on"
    # 3 日志目录空间限制
    vb_guc set .. "audit_space_limit=10G"
    ```

3.  设置日志同步参数

## 2.2 启动数据库

## 2.3 生成审计日志

## 2.4 查询审计日志

## 2.5 异常管理

# 3 审计特性变更点

## 3.1 问题分析

-   关键问题：目前，客户使用审计特性时，最严重的2个问题如下：

    -   性能问题：开启审计特性，设置审计范围包括DML，TPCC测试，单个审计线程性能劣化90%以上（不开审计40w+，开DML审计2-3w）
    -   功能问题：审计缺陷数量多，已识别缺陷20+，未识别的缺陷至少20+，很多缺陷会导致集群coredump、无法启动等
-   审计来源：opengauss审计特性来源：

    -   2019年，华为高斯以色列团队向国内交付审计demo
    -   2020年，高斯2名新员工将demo交付到gaussdb，并开源到opengauss
    -   2021年-2024年，高斯陆续有3人全职解决审计的问题单，至少50+，包括5+现网问题

## 2.2 重构目标

-   提高审计性能：以tpcc场景为例，1主1备，1000仓，500并发：
    -   基线：默认不开启审计特性
    -   场景一：开启审计特性，设置关键设计范围，审计DDL等，不审计DML，性能劣化很小，在5%以内
    -   场景二：开启审计特性，设置最大审计范围，审计DDL等，xxDML、SELECT等，性能劣化可控，在20%
-   降低审计缺陷
    -   重构前：曾解决10+审计文件类问题，未识别问题10+。因设计太复杂，无法控制风险
    -   重构后：审计文件管理类问题，新增问题不超过5。简化设计，风险可控

## 2.3 问题分析（当前版本）

在审计架构中，主要线程分为业务线程、审计线程。  
一般情况下，业务线程生成日志，通过管道将日志发送给审计线程，审计线程存储日志至审计文件。  
在分析问题时，为方便描述，本章以常规tpcc为例，假设：并发数为400，审计线程数为20，1个事务执行3次UPDATE。

### 一、存储日志慢

线程、管道、文件的数量关系如下：

1.  线程数：400个业务线程，默认1个审计线程，最高可配置48个。二者使用管道通信
2.  管道数：管道数与审计线程数相等
3.  文件数：每个审计线程，都独立写文件，即正在写的文件数与审计线程数相等

![adt_old](/images/ProjectDocs/5-solution-g100-audit-refactor/adt_old.png)

当前方案，存在多个设计问题。以常规tpcc为例，假设：：

| 编号 | 设计 | 方案 | 问题 |
| --- | --- | --- | --- |
| 1 | 线程通信 | 管道 | 平均20个业务线程，使用1个管道，管道很容易满。线程阻塞、上下切换等开销高 |
| 2 | IO模型 | 同步IO | 1个事务执行3次UPATE，生成3条日志，阻塞等待3次管道空闲、管道传输、日志落盘 |
| 3 | IO粒度 | Record级 | 同1时刻，20个并发，20个事务，生成60条日志，需串行等待60次IO |
| 4 | 加密粒度 | Record级 | 同1时刻，20个并发，20个事务，生成60条日志，需串行加密60次，哈希60次 |

### 二、检索日志慢

目前，用户只能通过SQL语句检索日志，查询出的日志，默认情况不是按时间顺序排列的：

```sql
SELECT query_audit('开始时间'， '结束时间')；
```

存储日志时，存在多个问题。

-   日志分布（多文件）：20个审计线程，分别写20个审计文件。同一时刻，400个业务线程，生成的日志被随机写入20个文件中。
-   日志顺序（乱序）：假设，在时刻1，线程1生成日志1，但是发生线程切换。在时刻2，线程2生成日志2，并存储至文件中。在时刻3，日志1落盘。此时，日志1先生成，但是后落盘
-   文件信息（索引文件）：1个数据库节点，维护1个审计索引文件，索引文件记录所有日志关键的生成时间

如下图所示，不同线程写不同日志文件，每个日志文件写完，生成新的日志文件：

![adt_read_old](/images/ProjectDocs/5-solution-g100-audit-refactor/adt_read_old.png)

检索日志时，流程如下：

1.  用户查询：指定’开始时间’、’结束时间’查询日志
2.  查找文件：遍历索引文件，判断所有日志文件的’创建时间’，找到符合条件的日志文件。（20审计线程，最少需查找20个文件）
3.  查找日志：分别遍历每个日志文件，判断所有日志的’生成时间’，找到符合条件的日志（假设1个文件64M = 8192 \* 8k）

检索结果中，日志并不是按时间顺序排列的。

### 三、文件问题多

在存储日志时，生成新日志文件，需更新索引文件。检索日志时，需遍历索引文件。索引文件丢失、损坏等，集群无法正常运行。但是，索引文件存在以下问题：

1.  无备份
2.  无一致性保证：无双写机制
3.  只初始1次：第1次使用审计，生成1次索引文件，与初始化约10万个索引节点，不可扩张。即最多可生成10万个日志文件。

## 2.4 重构方案

### 一、存储日志重构

新方案中，线程、管道、文件的数量关系如下：

1.  线程数：400个业务线程，只需1个审计线程即可。参考wal-writer设计
2.  管道数：删除管道通信机制。参考wal-buffer设计
3.  文件数：同1时刻，只有1个正在写的日志文件

针对各关键设计，重构思路如图所示：

![adt_new](/images/ProjectDocs/5-solution-g100-audit-refactor/adt_new.png)

重构方案如下：

| 编号 | 设计点 | 旧方案 | 新方案 | 优化分析 |
| --- | --- | --- | --- | --- |
| 1 | 线程通信 | 管道 | 堆内存 | 参考wal-buffer，新增alog-buffer，业务线程直接将日志写入alog-buffer。同1时刻，20个线程无需阻塞等待管道串行传输，直接将日志写入alog-buffer |
| 2 | IO模型 | 同步IO | 异步IO | 参考wal-writer，同1时刻，20个并发，20个事务执行共60次UPDATE，无需串行阻塞等待60次管道传输、日志落盘，只需60次将日志写入alog-buffer，并在提交事务时，检查20次日志是否已落盘，理论上阻塞次数小于5次 |
| 3 | IO粒度 | record级 | page级 | 参考wal-writer，1次落盘1个或多个page。 同1时刻，20个并发，20个事务，生成60条日志，无需串行等待60次IO，只需按page执行1次或多次IO即可 |
| 4 | 加密粒度 | record级 | page级 | 同1时刻，20个并发，20个事务，生成60条日志，需串行加密60次，哈希60次，只需按page执行1次加密、哈希即可 |

### 二、检索日志

存储日志时，重构思路如下：

1.  日志分布（单文件）：同一时刻，400个业务线程，生成的日志，被写入同1日志文件，或者下1个日志文件中
2.  日志顺序（顺序）：每个日志文件中，日志严格按照从前往后的顺序排列。参考xlog按照lsn顺序排列。
3.  文件信息（系统表）：新增系统表，vb_audit_files，记录每个审计日志的创建时间。另外，还可记录是否归档、是否备份等信息。

另外，还有以下优化：

1.  日志页：引入日志页的概念。1个日志文件，由多个日志页组成，1个日志页记录多条日志。页头记录：日志版本、日志时间、加密参数、LSN、上一个日志页未存完的日志长度等信息。
2.  文件命名：旧方案中命名方式是1_adt, 2_adt, 3_adt, ..，新方案以时间为文件命名。例如adt_2025-0501-1200-00.log

新系统表内容如下，其中，aftime列记录日志文件创建时间，该列上建立btree索引：

```sql
SELECT * FROM vb_audit_files;

afnum | aftime              | afname                  | isarchive | isbackup | isencrypt
------+---------------------+-------------------------+-----------+----------+-----------
 1    | 2025-04-20 12:00:00 | adt_2025_0420_1200_0000 | false     | fasle    | false
 2    | 2025-04-20 12:01:23 | adt_2025_0420_1201_2300 | false     | fasle    | false
-- 1T日志文件，系统表总大小1M
-- 计算：1个日志文件64M，64T有1024 * 1024个文件，系统表有1024 * 1024条记录，假设1条记录64字节。
```

重构思路如下图所示：

![adt_read_new](/images/ProjectDocs/5-solution-g100-audit-refactor/adt_read_new.png)

检索日志时，流程如下：

1.  用户查询：指定’开始时间’、’结束时间’查询日志
2.  查找文件：使用btree索引，从系统表vb_audit_files中查找符合条件的日志文件
3.  查找日志：在日志文件中，使用二分查找，先获取文件第1个、最后1个日志页，判断日志页时间，最多需要13次IO（假设1个文件64M = 8192 \* 8k）

## 2.5 重构开销

预估重构开销：

-   工作量：2人月
-   代码量：3k
-   质量提升：提前规避30+问题，包括现网问题。降低问题发现、定位、修复时间

## 2.6 重构影响

-   删除审计索引文件
-   重构审计日志文件：文件名变化，文件内容变化（使用page和record机制）。旧版本日志文件，仅在检索审计日志时被读取
-   GUC配置参数：删除部分
    -   审计线程

        | 参数 | 功能 | 变化 |
        | --- | --- | --- |
        | audit_thread_num | 写日志的线程数 | 删除 |
        | audit_buffer_size | 日志缓存大小 | 删除，参考wal-buffer设置 |
        | audit_buffer_fflush_interval | 日志缓存刷盘间隔 | 删除，参考wal-writer设置 |

    -   日志格式

        | 参数 | 功能 | 变化 |
        | --- | --- | --- |
        | audit_data_format | 日志格式，仅支持二进制 | 删除 |
        | audit_hash_enabled | 日志中是否记录哈希值 | \- |
        | get_acl_for_audit | 是否从系统表中，获取当前操作对象的ACL信息 | \- |
        | audit_xid_info | 日志中是否记录xid | \- |

    -   日志文件

        | 参数 | 功能 | 变化 |
        | --- | --- | --- |
        | audit_space_limit | 文件总空间 | \- |
        | audit_directory | 文件目录 | \- |
        | audit_dump_directory | 文件复制目录 | \- |
        | audit_backup_directory | 文件备份目录 | \- |
        | audit_file_remain_threshold | 文件数量最大值（问题大） | 删除 |
        | audit_file_remain_time | 日志保留时间 | \- |
        | audit_rotation_interval | 生成新文件的时间间隔 | 删除 |
        | audit_stop_policy | 文件大小或时间达到阈值时，删除旧日志，还是停止写新日志 | 删除 |
        | audit_resource_policy | 文件阈值类型，大小还是时间 | 删除 |
        | audit_rotation_size | 生成新文件的文件大小阈值 | 删除，使用默认值 64M |
        | vb_audit_space_alarm_threshold | 是否对文件大小达到阈值时告警 | 删除 |
        | get_auditindex_file_lock | 读取索引文件时，不加锁（只是为了测性能时不加锁） | 删除 |

-   系统表：新增vb_audit_files

## 2.7 性能测试

-   测试场景：tpcc, 1000仓，1主1备，400并发
    -   场景一：不开启审计特性
    -   场景二：开启审计特性，默认审计范围，不审计DML
    -   场景三：开启审计特性，最大审计范围，审计DML
-   测试流程：

    ```bash
    ssh shenkun@172.16.103.90
    # gauss@123

    不开审计：43.3857，cpu利用率80% 39.4989
    开审计：3.19，cpu利用率80%
    ```

# 3 审计特性详细设计

## 3.1 架构设计

### 一、整体架构

### 二、工作流程

### 三、文件组织

## 3.2 详细设计

### 一、配置审计特性

当前版本中，与审计相关的GUC参数有近60个，本次重构中，主要修改文件管理、线程管理相关参数，修改点如下：

1.  文件目录管理

    | 编号 | 变更 | 参数名 | 功能 | 参数类型 | 数据类型 | 取值范围 | 默认值 | 变更点 |
    | --- | --- | --- | --- | --- | --- | --- | --- | --- |
    | 1 | \- | audit_directory | 审计文件路径 | postmaster | 字符串 | 绝对路径或相对路径 | pg_audit | \- |
    | 2 | \- | vb_audit_dump_directory | 审计文件归档路径，audit_directory目录下的旧文件，定期move到归档路径 | postmaster | 字符串 | 绝对路径 | 空 | \- |
    | 3 | 删除 | vb_audit_backup_directory | 审计文件备份路径，audit_directory目录下新增文件，同时再copy到vb_audit_backup_directory目录 | postmaster | 字符串 | 绝对路径 | 空 | 删除 |
    | 4 | 删除 | audit_resource_policy | 审计目录下，所有日志文件总阈值，是按时间，还是按文件大小 | sighup | bool | on,off | on | 删除 |
    | 5 | 删除 | audit_file_remain_time | 审计目录下，保留一段时间内的日志文件 | sighup | int | [0,730] day | 90 | 删除 |
    | 6 | 修改 | audit_space_limit | 审计目录下，保留日志文件总大小 | sighup | int | [1024,1073741824] kb | 1048576(1GB) | 修改：取值范围为[1MB, 1TB]，默认1GB |
    | 7 | 删除 | audit_file_remain_threshold | 审计目录下，保留日志文件数量 | sighup | int | [100, 1048576] | 1048576 | 删除 |
    | 8 | 删除 | vb_audit_space_alarm_threshold | 审计空间达到阈值前，提前在pg_log告警 | sighup | double | [0,1] | 0 | 删除 |

2.  文件管理

    | 编号 | 变更 | 参数名 | 功能 | 参数类型 | 数据类型 | 取值范围 | 默认值 | 变更点 |
    | --- | --- | --- | --- | --- | --- | --- | --- | --- |
    | 9 | 删除 | audit_data_format | 审计文件格式，只支持2进制 | postmaster | 字符串 | binary | binary | 删除 |
    | 10 | 删除 | audit_rotation_interval | 创建新审计文件的时间间隔 | sighup | int | [1, 35791394] min | 1440 (1day) | 删除 |
    | 11 | 删除 | vb_audit_stop_policy | 日志文件总大小达到阈值，是停止写入新日志，还是保留旧日志 | sighup | bool | on,off | off | 删除 |
    | 12 | 删除 | audit_rotation_size | 单个日志文件最大值 | sighup | int | [1024, 1048576] KB | 10240 (10 MB) | 删除 |

3.  线程管理

    | 编号 | 变更 | 参数名 | 功能 | 参数类型 | 数据类型 | 取值范围 | 默认值 | 变更点 |
    | --- | --- | --- | --- | --- | --- | --- | --- | --- |
    | 13 | 修改 | audit_thread_num | 审计线程数 | postmaster | int | [1,48] | 1 | 修改：取值范围[1, 10] |

4.  IO管理

    | 编号 | 变更 | 参数名 | 功能 | 参数类型 | 数据类型 | 取值范围 | 默认值 | 变更点 |
    | --- | --- | --- | --- | --- | --- | --- | --- | --- |
    | 14 | 删除 | vb_audit_buffer_size_kb | 将日志写到buffer中，不直接write | postmaster | int | [0, 51200] kb | 0 |  |
    | 15 | 删除 | vb_audit_buffer_fflush_interval_sec | 定期对buffer中的日志进行write | sighup | [1,1800] s | 120 | 删除 |  |
    | 16 | 删除 | vb_enable_get_auditindexfile_lock | 每次write时，对索引文件加锁，为了检查有人修改系统时间 | sighup | bool | on,off | on | 删除 |
    | 17 | 新增 | audit_buffer_size | 日志缓冲区大小 | postmaster | int | [1M, 1G] | 64M | 新增 |
    | 18 | 新增 | audit_sync_log | 事务提交时，是否确保审计日志同步落盘 | postmaster | bool | true, false | false | 新增 |

5.  审计范围管理  
    通过GUC参数，设置哪类事件需被审计。相关控制参数较多，设计混乱，由于时间限制，不在本次重构范围内：

    1.  vb_audit_crypt_func
    2.  vb_audit_sequence_enabled
    3.  vb_enable_get_acl_for_audit
    4.  audit_login_logout
    5.  audit_database_process
    6.  audit_user_locked
    7.  audit_user_violation
    8.  audit_grant_revoke
    9.  audit_user
    10.  full_audit_users
    11.  no_audit_client
    12.  audit_user
    13.  audit_system_object
    14.  audit_dml_state
    15.  audit_dml_state_select
    16.  audit_function_exec
    17.  audit_system_function_exec
    18.  audit_copy_exec
    19.  audit_set_parameter
    20.  audit_xid_info
    21.  vb_audit_insufficient_space
    22.  vb_audit_network_error
    23.  vb_audit_query_cancel
    24.  vb_audit_tool_error
    25.  vb_enable_separation_of_duty
    26.  enable_nonsysadmin_execute_direct
    27.  enable_access_server_directory
    28.  vb_audit_transaction_enabled
6.  其他审计参数

    1.  vb_audit_hash_enabled
    2.  其他

### 二、审计文件管理

-   审计文件夹
    -   由GUC参数audit_direcotry控制，默认存储在data_directory/pgaudit目录
-   审计文件
    -   背景：
    -   有2种类型的文件

        ```bash
        |-- audit_direcotry
            |-- adt_2025_0420_1200_0000.blog # 已归并的日志
            |-- adt_2025_0420_1201_1234.blog
            |-- adt_unmerge_2025_0420_1203_2222.blog # 正在写的日志，多个写线程，
            |-- adt_unmerge_2025_0420_1203_2222.blog
            |-- adt_unmerge_2025_0420_1203_2222.blog
        ```

## 三、 启动数据库

## 四、生成审计日志

```python
PostgresMain
    exec_simple_query(sql)          # 1. 执行SQL
        parse_query_auto_gram()     # 2. 解析语法、分析语义、重写查询、生成计划
        pg_analyze_and_rewrite()
        pg_plan_queries()
        PortalRun(plan)             # 3. 执行计划
            ...
                ExecutorRun(plan)
                ExecutorEnd(plan)  # 4. 清理计划
                    # -------------------------------------------------------------------------------
                    pos = audit_dml(plan) # 5. DML审计
                        event = parse_plan(plan.rte)    # 5.1 生成事件：从执行计划、会话控制等中获取信息
                        log = assemble_event(event)     # 5.2 封装日志
                        pos = send_log(log)             # 5.3 发送日志
                            buf = get_buffer()              # 随机获取1个adtbuffer并缓存，1个事务复用1个adtbuffer
                                buf = (buf == NULL ? get_random_buffer() : buf)
                            pos = copy_log(buf, log)
                                read_lock_buffer(buf)       # 获取读锁
                                    spin_lock_buffer(buf)       # 申请空间，返回偏移
                                    pos = buf.sendpos
                                    buf.sendpos += pos              # 偏移一直在递增
                                    time = current_time()       # 偏移越大，时间越大
                                    spin_unlock_buffer(buf)
                                memcpy(buf, log， pos % buf.size)
                                read_unlock_buffer(buf)     # 释放读锁
        finish_xact_command()  # 5. 提交事务
            CommitTranscationCommand()
                XLogFlush(XactLastRecEnd) # 等待本事务最后1条xlog落盘
                # ----------------------------------------------------
                audit_flush(pos)          # 如果设置了同步落盘日志：等待本事务最后1条adtlog落盘
```

## 五、存储审计日志

```python
audit_main(buf)
    for (;;)
        write_lock_buffer(buf)
        len = buf.sendpos - buf.writepos
        write_unlock_buffer(buf)

        write(buf.writepos, len)
        buf.writepos += len

        sleep(count_sleep(len))
```

## 六、审计日志一致性

## 七、归并审计日志

## 八、查询审计日志

# 4 审计后续重构计划

目前，审计特性还存在较多问题，但出于时间、成本、收益等考虑，暂不重构：

1.  设计问题（功能冗余）：
    -   传统审计：通过40+个guc参数，控制审计哪类对象、审计哪类操作、管理审计文件等，日志存储于指定文件夹
    -   统一审计：通过`CREATE AUDIT POLICY`语法，控制哪个对象、哪类操作需审计。日志存储于syslog
2.  设计问题（设置审计范围）
    -   传统审计
        -   主体

            | 参数 | 功能 |
            | --- | --- |
            | audit_user | 对白名单内的用户进行审计 |
            | full_audit_users | 对白名单内的用户的所有操作进行审计 |
            | no_audit_client | 对黑名单内的IP的用户不审计 |

        -   操作

            | 参数 | 功能 |
            | --- | --- |
            | audit_copy_exec | 是否审计 COPY |
            | audit_dml_state | 是否审计 INSERT、UPDATE、DELETE |
            | audit_dml_state_select | 是否审计 SELECT |
            | audit_set_parameter | 是否审计 SET |

            -   操作结果

                | 参数 | 功能 |
                | --- | --- |
                | audit_user_violation | 是否越权操作 |
                | audit_operation_result | 只记录操作：成功、失败、成功和失败 的日志 |
                | audit_network_error | 是否审计网络连接错误 |
                | audit_query_cancel | 是否审计用户取消SELECT操作 |
                | audit_insufficient_space | 是否记录SPACE：达到限额 |
                | audit_tool_error | 是否审计 vb_dump、vb_dumpall、vb_restore 的异常 |

        -   客体

            | 参数 | 功能 |
            | --- | --- |
            | audit_system_object | 审计OBJECT的范围：DATABASE、SCHEMA、TABLE、…等CREATE、DROP、ALTER操作 |
            | audit_database_process | 是否审计CLUSTER：启动、停止、切换和恢复 |
            | audit_function_exec | 是否审计FUNCTION：执行 |
            | audit_systerm_function_exec | 是否审计FUNCTION：执行（内核写了一个白名单，共61个，例如pg_stat_activity，pg_switch_xlog等） |
            | audit_sequence_enabled | 是否审计语句序列 |
            | audit_crypt_func | 是否审计FUNCION （密码运算函数） |
            | audit_security_policy | 是否审计POLICY |
            | audit_transcation | 是否审计TANSCATITON：提交、回滚 |
            | audit_login_logout | 审计CLUSTER：{登录、注销} x {成功、失败} |
            | audit_user_locked | 是否审计USER：锁定、解锁 |
            | audit_grant_revoke | 是否审计USER：赋权、收权 |

3.  代码质量问题
4.  可扩展性：新增SQL语法、事件，适配审计特性难度

其他优化：

1.  易用性（审计日志文件）：新增工具，离线解析日志文件功能，将日志解析为可见字符串，比如日志生成时间等

```bash
insert
    alrec = adt_assemble_record()

    atomic_lock(abuff)
    alrecpos = adt_alloc_buffer(size)
    alrectime = adt_get_time()
    atomic_unlock(abuff)

commit
    adt_flush_buffer(myask)

+---------------------------------------+-----------+----------+--------
|             |     al1    |    al2     |           |          |
+---------------------------------------+-----------+----------+--------
    disk         iobuffer     albuffer     writing     alloced
              |     writer              |  postgres            |
                                 ^    ^
                                ask maxask

t1 p1 --> write p1
t2 p2 --> write p4
t3 p3 --> ok -
t4 p4 --> ok -

t5 p5 --> write p6
t6 p6 --> ok -

```
