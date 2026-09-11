+++
title = 'kkdb 1 预览'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目']
tags = ['项目']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 基本介绍

## 要求

-   数据库基本原理
-   C语言
-   数据结构
-   操作系统

## 数据存储需求

## 数据存储方案

-   文件
-   excel
-   数据库

# 2 kkdb

## 成果展示

-   初始化

    ```bash
    # 系统表
    sys_class: 存储所有表
    sys_attr: 存储所有列

    dbinit
    ls ~/dbdata
    ```

-   基本语法
    -   CREATE

        ```bash
        输入：CREATE TABLE t1 (c1 INT, c2 TEXT);
        语法解析：表名、列名、列数据类型
        系统表：存储表信息、列信息
        表文件：创建文件
        ```

    -   INSERT

        ```bash
        输入：INSERT INTO t1 VALUES (1, 'first')
        语法解析：表名、列数据
        数据处理：封装数据
        表文件：写入数据
        ```

    -   SELECT

        ```bash
        输入：SELECT * FROM t1
        语法解析：表名、列
        表文件：读取数据
        数据处理：解析数据
        ```

    -   UPDATE
    -   DELETE
    -   DROP
-   并发访问
    -   CS模式
        -   服务器

            ```bash
            dbserver start
            ```

        -   客户端

            ```bash
            dbclient 127.0.0.1 8888
            SELECT * FROM t1;
            ```

    -   服务器多线程

        ```bash
        dbclient 127.0.0.1 8888
        dbclient 127.0.0.1 8888
        ```

        > 输出：服务端sprintf，然后发至客户端

-   正确性
    -   原子性、隔离性：事务ID、事务快照、可见性

        ```bash
        # 原子性
        BEGI
        INSERT INTO t1 VALUES (3, 'three')
        INSERT INTO t1 VALUES (4, 'four')
        ROLLBACK

        # 隔离性性
        dbclient
        BEGIN
        INSERT INTO t1 VALUES (5, 'five')
        INSERT INTO t1 VALUES (6, 'six')
        COMMIT

        dbclient
        SELECT * FROM t1
        SELECT * FROM t1
        ```

-   高性能
    -   异步落盘：buffer pool

        ```bash
        dbclient
        CONFIG checkpoint = 10min

        INSERT INTO t1 VALUES (7, 'seven')
        hexdump t1
        CHECKPOINT
        hexdump t1
        ```

-   故障恢复：
    -   预写日志

        ```bash
        dbclient
        INSERT INTO t1 VALUES (8, 'eight')
        cat xlog
        ```

    -   故障恢复

        ```bash
        kill dbserver
        dbserver 127.0.0.1 8888
        hexdump t1
        SELECT * FROM t1
        ```

-   基本运算
    -   投影

        ```bash
        SELECT c2 FROM t2;
        ```

    -   选择
        -   内置函数

            ```bash
            SELECT is_str(c1) FROM t1;
            ```

        -   WHERE子句

            ```bash
            SELECT * FROM t1 WHERE c1 > 10

            SELECT * FROM t1 WHERE is_bigger(c1, 10);
            ```

    -   限制

        ```bash
        SELECT * FROM t1 WHERE c1 > 10 LIMIT 1;
        ```

    -   执行器

        ```bash
        for (;;)
            scan
            filter
            qual
        ```

-   高性能
    -   索引

        ```bash
        CREATE INDEX ON t1(c1);
        SELECT * FROM t1 WHERE c1 = 666;
        ```

-   JOIN
-   优化器
