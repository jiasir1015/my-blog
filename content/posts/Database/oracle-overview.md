+++
title = 'Oracle 基本介绍'
date = '2025-01-25T11:24:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['Oracle']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 Oracle 集群管理

## 1.2 登录数据库

```bash
sqlplus / as sysdba
```

# 2 Oracle 语法

## 2.1 数据类型

仅列举常见数据类型：

| 大类 | 类型 | 解释 |
| --- | --- | --- |
| 数值 | INT or INTGER | 整数 |
| - | NUMBESR(p, s) | p: 精度，整数和小数总位数，s: 小数位数 |
| - | SMALLINT | 等于 NUMBESR(38) |
| - | FLOAT(p) | 浮点数，p: 二进制精度，最大126 |
| 字符 | CHAR(n) | 固定长度字符，n: 长度，不足n用空格填充 |
| - | VARCHAR2(n) | 可变长度字符，n: 最大长度，最大4000 |
| 时间 | DATE | 日期 |
| - | TIMESTAMP | 日期和时间 |
| 二进制 | CLOB | 长文本数据 |

## 2.2 常用SQL

-   常见语法

    ```sql
    -- 1 创建表
    CREATE TABLE t1 (c1 INT, c2 VARCHAR2(10));

    -- 2 插入数据
    INSERT INTO t1 VALUES (1, 'abcc');
    INSERT INTO t1 VALUES (2, 'ddee');

    -- 3 查询数据
    SELECT * FROM t1 WHERE c1 > 0;

    -- 4 更新数据
    UPDATE t1 SET c2 = 'abbc' WHERE c1 = 1;

    -- 5 删除数据
    DELETE FROM t1 WHERE c1 = 2;

    -- 6 删除表
    DROP TABLE t1;
    ```

-   内置函数

    ```sql
    CREATE TABLE t1 (c1 INT, c2 VARCHAR2(10));

    INSERT INTO t1 VALUES (1, upper('abcc'));

    SELECT c1,c2,lower(c2) FROM t1;
    ```

## 2.3 常用系统表

```sql
-- 查看所有表
SELECT * FROM user_tables;

-- 查看lorand用户有权访问的表
SELECT owner,table_name FROM all_tables WHERE owner = 'lorand';

-- 查看t1表的列信息
SELECT column_name,data_type FROM user_tab_columns WHERE table_name = 't1';

-- 查看所有索引
SELECT * FROM user_indexes;

-- 查看所有用户
SELECT * FROM dba_users;

-- 查看数据库信息
SELECT * FROM v$database;

-- 查看实例信息
SELECT * FROM v$instance;
```

# 常用设置

```sql
SET LINESIZE 200
SET PAGESIZE 100
SET COLSEP ' | '
SET NUMWIDTH 15
SET HEADING ON
SET FEEDBACK OFF
```

1.  查看表的所有列

    ```sql
    SELECT column_name,data_type,data_length,nullable FROM all_tab_columns WHERE table_name = UPPER('dba_profiles');
    ```
