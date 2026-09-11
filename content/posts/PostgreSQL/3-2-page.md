+++
title = 'PostgreSQL 3-2 Page'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '存储引擎']
weight = 302
ShowToc = true
TocOpen = true
+++
# 1 Page的概念

## 1.1 前置概念

首先，简单介绍一些基本概念：

1.  **关系 Relation**：PostgreSQL是一款关系型数据库，在数据库中，1个表对应关系代数中的1个关系，即1个Relation。本博客中，将1个Relation指1个表
2.  **数据文件 RelFile**：通过`CREATE TABLE t1 (c1 INT, c2 TEXT)`等语法创建1个表时，PostgreSQL会生成1个与表对应的数据文件，表中数据都将被存储至数据文件中
3.  **数据库页 Page**：1个数据文件，由1个或多个大小为8192字节（即8k）的数据页组成
4.  **行 Row**：在SQL语法`INSERT INTO t1 VALUES (1, 'data1')`中，`(1, 'data1')`是表中的1行数据
5.  **元组 Tuple**：在PostgreSQL中，1个Tuple存储1行数据，数据越长，Tuple越长。1个Page可以存储多个Tuple

## 1.2 Page

Page的格式如下：

![page](/images/PostgreSQL/3-2-page/page.png)
