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

## 数据组织

### 数据库

当初始化一个 PG 实例之后，PGDATA 会自动创建以下三种基础数据库：

- template0: 用来通过逻辑复制，或创建不同编码数据库的原型/样板；
- template1: 用户在此实例下创建所有其他数据库的模版，新建库都基于它；
- postgres: 自带的一个常规库；

![image](/images/uploads/image.png)
