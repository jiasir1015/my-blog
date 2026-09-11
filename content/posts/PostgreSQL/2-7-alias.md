+++
title = 'PostgreSQL 2-6 Alias'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL']
weight = 207
ShowToc = true
TocOpen = true
+++
# SQL.别名

**摘要**

> 本文以实际使用为例，介绍SQL语法中别名的使用约束

**目录**  

1.  [SQL.别名](#SQL-%E5%88%AB%E5%90%8D)
    1.  [1 介绍](#1-%E4%BB%8B%E7%BB%8D)
    2.  [2 示例](#2-%E7%A4%BA%E4%BE%8B)
    3.  [3 复杂场景](#3-%E5%A4%8D%E6%9D%82%E5%9C%BA%E6%99%AF)

## 1 介绍

什么是别名：

别名语法:

> 表名 | 列名 | 表名.列名 [AS] 别名

## 2 示例

0 建表

```SQL
CREATE TABLE t1 (
    c1 INT,
    c2 INT,
    c3 INT
);

INSERT INTO t1 VALUES (1, 1, 1), (2, 2, 2);
```

1 [列] 别名：

```SQL
SELECT
    c1 AS col1
FROM
    t1;
```

2 [表] 别名：

```SQL
SELECT
    c1
FROM
    t1 AS tbl1;
```

3 [表.列] 别名：

```SQL
SELECT
    t1.c1 tbl1_col1
FROM
    t1;
```

4 [表别名.列] 别名：

```SQL
SELECT
    tbl1.c1 tbl1_col1
FROM
    t1 tbl1;

-- error
SELECT
    t1.c1 tbl1_col1
FROM
    t1 tbl1;
```

5 [表别名.列别名]

```SQL
-- error
SELECT
    c1 col1,
    tbl1.col1
FROM
    t1 tbl1;

-- error
SELECT
    tbl1.c1 tbl1_col1,
    tbl1.tbl1_col1
FROM
    t1 tbl1;
```

6 [别名] 别名

```SQL
-- error
SELECT
    tbl1.c1 tbl1_col1,
    tbl1_col1 copy_col1
FROM
    t1 tbl1;
```

7 总结

> -   别名处理顺序：先处理FROM子句，再处理TARGET子句
> -   别名嵌套：可在别名上取别名

## 3 复杂场景

0 建表

```SQL
DROP TABLE t1;

CREATE TABLE t1 (
    c1 INT,
    c2 INT,
    c3 INT
);
CREATE TABLE t2 (
    c1 INT,
    c2 INT,
    c4 INT
);

INSERT INTO t1 VALUES (1, 1, 1), (2, 2, 2);
INSERT INTO t2 VALUES (2, 2, 2), (3, 3, 3);
```

1 多表JOIN

```SQL
SELECT
    *
FROM
    t1 JOIN t2
        ON c3 = c4       -- succeed
        -- ON c1 = c1;  -- error
        -- ON c1 = c2;  -- error
        -- ON c1 = c4;  -- error
;

SELECT
    -- c1       -- error
    c3,
    -- t1.c1    -- error
    tbl1.c1,
    t2.c1,
    tbl1.c1 tbl1_c1,
    t2.c1 tbl2_c1,
    t2.c1
FROM
    t1 tbl1 JOIN t2
        -- ON t1.c1 = t2.c1 -- error
        ON tbl1.c1 = t2.c1
;
```

2 多表JOIN，ORDER BY

```SQL
    SELECT
        c3,
        c4 col4,

        tbl1.c1,
        t2.c1,
        tbl1.c1 tbl1_c1,
        t2.c1 tbl2_c1,
        t2.c1
    FROM
        t1 tbl1 JOIN t2
            ON tbl1.c1 = t2.c1
    ORDER BY
        c3,
        col4,

        tbl1.c1,
        t2.c1,
        tbl1_c1,
        tbl2_c1,
        t2.c1

        -- c1 -- error
        -- t1.c1 -- error

        -- t2.col4 -- error
        -- tbl1.col4 -- error
;
```

3 多表JOIN，GROUP BY

```SQL
SELECT
    tbl1.c1 tbl1_c1
FROM
    t1 tbl1 JOIN t2
        ON tbl1.c1 = t2.c1
GROUP BY
    tbl1.c1
    -- tbl1_c1 --succeed
ORDER BY
    tbl1.c1,
    tbl1_c1
;

SELECT
    tbl1.c2 tbl1_c2,
    tbl1.c2
FROM
    t1 tbl1 JOIN t2
        ON tbl1.c1 = t2.c1
GROUP BY
    -- tbl1.c2 -- succeed
    tbl1_c2
ORDER BY
    tbl1.c2,
    tbl1_c2
;
```

4 语法解析  
解析结果：  
方式二

5 总结

> -   表别名强约束，列别名弱约束
> -   多表查询时，列名无冲突时，可直接使用列名
> -   别名处理顺序：FROM (alias) -> TARGET -> JOIN -> GROUP BY -> ORDER BY
> -   ORDER BY中别名约束，与TARGET中约束一致
