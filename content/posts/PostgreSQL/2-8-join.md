+++
title = 'PostgreSQL 2-8 join'
date = '2025-02-20T19:26:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '查询优化']
weight = 208
ShowToc = true
TocOpen = true
+++
# 1 介绍JOIN

## 分类

-   INNER JOIN
-   LEFT JOIN
-   RIGHT JOIN
-   FULL JOIN
-   SELF JOIN
-   CROSS JOIN

# 2 使用JOIN

```sql
CREATE TABLE t1 (a1 INT, b1 TEXT);
INSERT INTO t1 VALUES
    (1, 'u1'),

    (2, 'u2'),

    (3, 'u3');

CREATE TABLE t2 (b2 TEXT, c2 TEXT);
INSERT INTO t2 VALUES
    ('u1', 'u1-1'),
    ('u1', 'u1-2'),

    ('u2', 'u2-1'),

    ('u4', 'u4-1');
```

```sql
-- INNER JOIN
SELECT a1, b1, b2, c2
FROM t1 INNER JOIN t2
ON b1 = b2
ORDER BY a1, b1, c2;

 a1 | b1 | b2 |  c2
----+----+----+------
  1 | u1 | u1 | u1-1
  1 | u1 | u1 | u1-2
  2 | u2 | u2 | u2-1
```

```sql
-- LEFT JOIN
SELECT a1, b1, b2, c2
FROM t1 LEFT JOIN t2
ON b1 = b2
ORDER BY a1, b1, c2;

 a1 | b1 | b2 |  c2
----+----+----+------
  1 | u1 | u1 | u1-1
  1 | u1 | u1 | u1-2
  2 | u2 | u2 | u2-1
  3 | u3 |    |
```

```sql
-- RIGHT JOIN
SELECT a1, b1, b2, c2
FROM t1 RIGHT JOIN t2
ON b1 = b2
ORDER BY a1, b1, c2;

 a1 | b1 | b2 |  c2
----+----+----+------
  1 | u1 | u1 | u1-1
  1 | u1 | u1 | u1-2
  2 | u2 | u2 | u2-1
    |    | u4 | u4-1
```

```sql
-- FULL JOIN
SELECT a1, b1, b2, c2
FROM t1 FULL JOIN t2
ON b1 = b2
ORDER BY a1, b1, c2;

 a1 | b1 | b2 |  c2
----+----+----+------
  1 | u1 | u1 | u1-1
  1 | u1 | u1 | u1-2
  2 | u2 | u2 | u2-1
  3 | u3 |    |
    |    | u4 | u4-1
```

```sql
-- SELF JOIN
SELECT a1, b1, b2, c2
FROM t1 SELF JOIN t2
ON b1 = b2
ORDER BY a1, b1, c2;
```

```
-- CROSS JOIN
SELECT a1, b1, b2, c2
FROM t1 CROSS JOIN t2 -- can't use 'ON'
ORDER BY a1, b1, c2;

 a1 | b1 | b2 |  c2
----+----+----+------
  1 | u1 | u1 | u1-1
  1 | u1 | u1 | u1-2
  1 | u1 | u2 | u2-1
  1 | u1 | u4 | u4-1
  2 | u2 | u1 | u1-1
  2 | u2 | u1 | u1-2
  2 | u2 | u2 | u2-1
  2 | u2 | u4 | u4-1
  3 | u3 | u1 | u1-1
  3 | u3 | u1 | u1-2
  3 | u3 | u2 | u2-1
  3 | u3 | u4 | u4-1
```
