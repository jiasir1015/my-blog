+++
title = 'PostgresInternal'
date = '2026-09-11T15:06:30+08:00'
lastmod = '2026-09-11T18:12:00+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', 'Internals']
weight = 10
ShowToc = true
TocOpen = true
+++

# Postgres Internals 14 阅读笔记

Egor Rogov 的 *PostgreSQL 14 Internals* 读书笔记入口。中文在线版方便查阅，英文 PDF 方便离线精读。

## 资料

- 中文在线版：[PostgreSQL 14 Internals（中文）](https://postgres-internals.cn/docs/chapter01/)
- 英文 PDF（本站电子书库）：[postgresql_internals-14_parts1-3_en.pdf](/ebooks/postgresql_internals-14_parts1-3_en.pdf)

{{< pdf src="/ebooks/postgresql_internals-14_parts1-3_en.pdf" title="PostgreSQL 14 Internals (EN, Parts 1–3)" >}}

---

# 介绍

## 1.1 数据组织

### 1.1.1 数据库

当初始化一个 PG 实例之后，PGDATA 会自动创建以下三种基础数据库：

- template0: 用来通过逻辑复制，或创建不同编码数据库的原型/样板；
- template1: 用户在此实例下创建所有其他数据库的模版，新建库都基于它；
- postgres: 自带的一个常规库；

![image](/images/uploads/image.png)

### 1.1.2 系统目录 
所有集簇对象 (例如表、索引、数据类型或函数) 的元数据都存储在属于系统目录 3 的表中。每个数据库都有其自己的一组用于描述该数据库对象的表 (和视图)。有几个系统目录表是整个集簇共有的，它们不属于任何特定的数据库 (从技术上讲，使用的是一个 ID 为零的虚拟数据库)，但可以从所有数据库中访问这些表。

系统目录可以使用常规 SQL 查询进行查看，所有对系统目录的修改都是通过 DDL 命令执行的。psql 客户端还提供了一系列命令，用于显示系统目录的内容。

所有系统目录表的名称都以 pg_ 开头，比如 pg_database。列名通常以对应于表名的三个字母前缀开头，比如 datname。

在所有的系统目录表中，声明为主键的列称之为 oid (对象标识符)，其类型是一个 32 位整数，也被称为 oid。

在 PostgreSQL 中，oid 对象标识符的实现几乎与序列相同，但它出现得更早。其特殊之处在于，由公共计数器生成的唯一 ID 被用于不同的系统目录表。当分配的 ID 超过最大值时，计数器将重置。为了确保特定表中的所有值都是唯一的，下一个生成的 oid 会通过唯一索引进行检查；如果在这个表中已经使用过，计数器就会增加，然后再次检查。4

### 1.1.3 模式 
模式 5 是存储数据库中所有对象的命名空间。除了用户模式，PostgreSQL 还提供了几个预定义的模式：

public 是用户对象的默认模式，除非指定了其他设置。

pg_catalog 用于系统目录表。

information_schema 为 SQL 标准定义的系统目录提供了一个替代视图。

pg_toast 用于与 TOAST 相关的对象。

pg_temp 由临时表所组成。虽然不同的用户在名为 pg_temp_N 的不同模式中创建临时表，但每个用户都使用 pg_temp 别名来访问他们的对象。

每个模式都限定在特定的数据库中，并且所有数据库对象都属于其中一个模式。

如果在访问对象时没有明确指定模式，PostgreSQL 会从搜索路径中选择第一个合适的模式。搜索路径基于 search_path 参数的值，该参数隐式扩展了 pg_catalog 和 (如有需要) pg_temp。这意味着不同的模式可以包含具有相同名称的对象。

### 1.1.4 表空间 
不同于决定对象逻辑分布的数据库和模式，表空间定义了物理数据布局。表空间实际上是文件系统中的一个目录。你可以在表空间之间分布数据，使得归档数据存储在低速磁盘上，而频繁更新的数据则存储在快速磁盘上。

同一个表空间可以被不同数据库使用，并且每个数据库可以在多个表空间中存储数据。这意味着逻辑结构和物理数据布局并不相互依赖。

每个数据库都有所谓的默认表空间。除非指定了其他位置，否则所有数据库对象都在此表空间中创建。与该数据库相关的系统目录对象也存储在那里。

![image](/images/uploads/1-2-20260915025055.png)

在集簇初始化期间，会创建两个表空间：

pg_default 位于 PGDATA/base 目录中；除非明确选择了另一个表空间，否则它会被用作默认表空间。

pg_global 位于 PGDATA/global 目录中；它存储着整个集簇公共的系统目录对象。

在创建自定义表空间时，你可以指定任意目录；PostgreSQL 会在 PGDATA/pg_tblspc 目录中创建指向该目录位置的符号链接。实际上，PostgreSQL 使用的所有路径都是相对于 PGDATA 目录的，这允许你将其移动到不同的位置 (当然，前提是你已经停止了服务)。

前一页的插图将数据库、模式和表空间放在了一起。此处， postgres 数据库使用表空间 xyzzy 作为默认表空间，而 template1 数据库使用 pg_default。表空间和模式的交叉处展示了各种数据库对象。

