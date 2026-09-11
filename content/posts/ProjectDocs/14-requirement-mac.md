+++
title = '海量 mac 需求'
date = '2026-03-23T21:40:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['访问控制', '需求文档']
weight = 1400
ShowToc = true
TocOpen = true
+++
# 1 简介

## 1.1 目的

本文主要包括以下关键内容：

1.  介绍访问控制的基本概念
2.  调研其他厂商实现强制控制的方式
3.  设计Vastbase强制访问控制特性，介绍如何使用强制访问特性

## 1.2 适用范围

Vastbase V5版本。

## 1.3 术语定义、首字母缩写词和缩略语

-   MAC：Mandatory Access Control，强制访问控制，主体访问客体时，基于主体、客体属性，强制控制访问权限。
-   DAC：Discretionary Access Control，自主访问控制，数据拥有者可自行设置访问权限。

## 1.4 参考资料

-   oracle 强制访问控制（标签访问控制 RLS）：[https://docs.oracle.com/en/database/oracle/oracle-database/26/olsag/part1.html#GUID-C20C62AE-2A30-45F9-AEEA-52A0D3286FBA](https://docs.oracle.com/en/database/oracle/oracle-database/26/olsag/part1.html#GUID-C20C62AE-2A30-45F9-AEEA-52A0D3286FBA)
-   oceanbase 强制访问控制（兼容oracle）：[https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000004475944](https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000004475944)
-   kingbase 强制访问控制：[https://bbs.kingbase.com.cn/kingbase-doc/v8.6.7.24/safety/safety-guide/label-and-mac.html](https://bbs.kingbase.com.cn/kingbase-doc/v8.6.7.24/safety/safety-guide/label-and-mac.html)
-   dm 强制访问控制：[https://eco.dameng.com/document/dm/zh-cn/pm/mandatory-access-control.html](https://eco.dameng.com/document/dm/zh-cn/pm/mandatory-access-control.html)
-   GB/T-20009-数据库管理系统安全评估准则：[https://drive.weixin.qq.com/s?k=AHUAfwdSAA82aDcvvD](https://drive.weixin.qq.com/s?k=AHUAfwdSAA82aDcvvD)
-   postgresql 行级访问控制 RLS：[https://www.postgresql.org/docs/current/ddl-rowsecurity.html](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

# 2 强制访问控制

## 2.1 功能简述

### 一、基本概念

**访问控制**的定义：对主体访问客体的行为，系统按照安全策略进行限制与管理的安全机制。  
按安全策略分类，可将访问控制分为很多类，其中，常见的策略有：

-   自主访问控制DAC：客体的拥有者，可自行向其他主体赋予访问权限。
-   强制访问控制MAC：系统为主体、客体分配安全标签，通过主体、客体的安全标签控制访问权限，很多情况下，即使客体的拥有者也无法向其他主体赋予访问权限。
-   角色访问控制RBAC：不在本文讨论范围。

在数据库领域，主体通常指数据库用户，客体通常指数据库对象，例如DATABASE、SCHEMA、TABLE、COLUMN、ROW、FUNCTION等。  
自主访问控制比较成熟，几乎所有关系数据库，都提供自主访问控制特性，例如，TABLE（客体）的属主（主体），可通过`GRANT .. TO ..`等语法，为其他用户（主体）赋予权限。  
强制访问控制理论比较成熟，但是，除oracle支持强制访问控制，以及oceanbase等几款产品兼容oracle强制访问控制之外，大部分关系数据库不支持强制访问控制。

实现强制访问控制时，通常将主体、客体的安全标签，简化为安全等级，当主体访问客体时，比较主体、客体等级高低，以判断访问权限。在机密性场景，遵循不上读、不下写原则。在完整性场景，遵循不下读、不上写原则。

本需求将从0设计强制访问控制特性，在保障功能、性能、易用性、可用性、可维护性、可扩展性等的前提下，让特性达到商用标准。

### 二、竞品分析

oracle支持强制访问控制，客体是ROW，即行级强制访问控制。oceanbase、kingbase、dm的访问控制，与oracle一致。sql server、postgresql等其他产品不支持强制访问控制。  
oracle强制访问控制使用示例如下：

```sql
-- 1 定义策略
SA_SYSDBA.CREATE_POLICY(policy_name => 'p1', column_name => 'lab_col1')
-- 2 定义级别
SA_COMPONENTS.CREATE_LEVEL(policy_name => 'p1', level_num => 1, short_name => 'x1', long_name => 'x1');
SA_COMPONENTS.CREATE_LEVEL('p1', 20, 'x2', 'x2');
SA_COMPONENTS.CREATE_LEVEL('p1', 30, 'x3', 'x3');
-- 3 定义组件
SA_COMPONENTS.CREATE_LEVEL(policy_name =>'p1', comp_num => 100, short_name => 'sec', long_name => 'security');
SA_COMPONENTS.CREATE_LEVEL('p1', 200, 'stg', 'storage');
-- 4 创建标签
SA_SYSDBA.CREATE_LABEL(policy_name => 'p1', label_tag => 'sec_normal', label_value => 'x1:security', data_label => TRUE);
SA_SYSDBA.CREATE_LABEL('p1', 'sec_leader', 'x3:security', false);
-- 5 为主体设置属性
SA_USER_ADMIN.SET_LEVELS(policy_name => 'p1', user_name => 'user1', max_level => 'x2', min_level => 'x1', default_level => 'x1', row_level => 'x1');
SA_USER_ADMIN.SET_COMPARTMENTS(policy_name => 'p1', user_name => 'user1', read_comps => 'sec', write_comps => 'sec', default_comps => 'sec', row_comps => 'sec');
-- 6 为客体设置属性
CREATE TABLE t1(c1 INT);
SA_USER_ADMIN.APPLY_TABLE_POLICY(policy_name=> 'p1', shema_name => 's1', table_name => 't1', table_options => 'READ_CONTROL, WRITE_CONTROL, CHECK_CONTROL', label_function => 'f_create_t1_label(level, comp)');
-- 7 插入数据（主动定义标签）
INSERT INTO t1 (c1, lab_col1)
VALUES (1, CHAR_TO_LABEL('p1', 'x1:sec'));
```

### 三、实现思路

在数据库领域，除oracle外，没有其他可借鉴的方案。oracle的设计，太复杂，易用性太低。  
本需求将参考oracle的思想，简化oracle设计。

## 2.2 功能说明

### 2.2.1 使用流程

#### 场景一、基于等级的强制访问控制

```sql
-- 1. 定义访问策略
CREATE ACCESS POLICY p1
    LEVLE l1=10, l2=20, l3=30
    LABEL lab1=l1, lab2=l2;

-- 2. 为表（客体）设置访问策略
CREATE TABLE t1 (c1 INT, c2 TEXT) WITH (access_policy = p1);

-- 3. 为用户（主体）设置访问策略
CREATE USER u1 PASSWORD 'u1.pass'
    ACCESS POLICY p1
        WRITE LABEL lab1,lab2 -- 第1个标签是默认标签
        READ LABEL lab1,lab2;

-- 4. 为主体设置临时标签
SET write_label = lab1;
SET read_label = lab1;

-- 5. 写数据
INSERT INTO t1 VALUE (1, 'a');
INSERT INTO t1 VALUE (2, 'b', lab2);

-- 6. 读数据
SELECT *,access_label FROM t1;
    -- 预期输出
    c1   |   c2 | access_label
    -----+------+---------------
      1  |  a   |  1:              -- 未主动指定label，使用默认的lab1
    -- 还有一行不可见：(2, 'b', '2:')，该行主动指定label为lab2，lab2的等级高于读等级read_label
    -- 内核会自动将本SQL语法改写为：
    -- SELECT *,access_label FROM t1 WHERE has_mac_permission(access_label, read_label);

-- 7. 清理
DROP TABLE t1;
DROP USER u1;
DROP ACCESS POLICY p1;
```

#### 场景二、基于标记的强制访问控制

```sql
-- 1. 定义访问策略
CREATE ACCESS POLICY p1
    MARK ma, mb
    LABEL laba=ca, labb=cb;

-- 2. 为表（客体）设置访问策略
CREATE TABLE t1 (c1 INT, c2 TEXT) WITH (access_policy = p1);

-- 3. 为用户（主体）设置访问策略
CREATE USER u1 PASSWORD 'u1.pass'
    ACCESS POLICY p1
        WRITE LABEL laba,labb
        READ LABEL laba,labb;

-- 4. 为主体设置临时标签
SET write_label = laba;
SET read_label = laba;

-- 5. 写数据
INSERT INTO t1 VALUE (1, 'a');
INSERT INTO t1 VALUE (2, 'b', labb);

-- 6. 读数据
SELECT *,access_label FROM t1;
    -- 预期输出
    c1   |   c2 | access_label
    -----+------+---------------
      1  |  a   |  :ma             -- 未主动指定label，使用默认的laba
    -- 还有一行不可见：(2, 'b', ':mb')，该行主动指定label为lab2，lab2的标记为labb，读标记为laba

-- 7. 清理
DROP TABLE t1;
DROP USER u1;
DROP ACCESS POLICY p1;
```

#### 场景三、基于等级与标记的强制访问控制

```sql
-- 1. 定义访问策略
CREATE ACCESS POLICY p1
    LEVLE l1=10, l2=20, l3=30
    MARK ma, mb
    LABEL lab1=l1, lab2=l2, laba1=l1:ma, labb1=l1:mb;

-- 用户读数据时，不仅要比较level的大小，还要比较mark是否相等
-- 详细步骤省略
```

#### 场景四、查看访问控制策略

```sql
-- 1 创建访问策略
CREATE ACCESS POLICY p1
    LEVLE l1=10, l2=20, l3=30
    MARK ma, mb
    LABEL lab1=l1, lab2=l2, laba1=l1:ma, labb1=l1:mb;

-- 2 查看访问控制策略
SELECT * FROM vb_access_policy;
  poloid | polname
  -------+---------
  17001  | p1

-- 3 查看 LEVEL
SELECT * FROM vb_access_level;
  polid | levname | levelnum
  ------+---------+--------
  17001 | l1      | 10
  17001 | l2      | 20
  17001 | l3      | 30

-- 4 查看 MARK
SELECT * FROM vb_access_mark;
    polid | mark
    ------+------
    17001 | ma
    17001 | mb

-- 5 查看 LABEL
SELECT * FROM vb_access_label;
    polid | labbel | levelname | mark
    ------+--------+-----------+-------
    17001 | lab1   | l1         | ma

-- 6 为表（客体）设置访问策略
CREATE TABLE t1 (c1 INT, c2 TEXT) WITH (access_policy = p1);

-- 7 查看表（客体）的访问策略
SELECT relname,reloptions FROM pg_class WHERE relname = 't1';
    relname | reloptions
    --------+------------------
    t1      | access_policy=p1

-- 8 为用户（主体）设置访问策略
CREATE USER u1 PASSWORD 'u1.pass'
    ACCESS POLICY p1
        WRITE LABEL laba,labb
        READ LABEL laba,labb;

-- 9 查看用户（主体）设置访问策略
SELECT * FROM pg_authid;
   rolname | rolaccpol | rolacclab
   --------+-----------+---------------------
      u1   | p1        | lab1:lab2,lab1:lab2
```

#### 场景五：修改访问控制策略

```sql
-- 1 创建访问策略
CREATE ACCESS POLICY p1
    LEVLE l1=10, l2=20, l3=30
    MARK ma, mb
    LABEL lab1=l1, lab2=l2, laba1=l1:ma, labb1=l1:mb;

-- 2. 为表（客体）设置访问策略
CREATE TABLE t1 (c1 INT, c2 TEXT) WITH (access_policy = p1);
INSERT INTO t1 VALUES(1,'lab1');

-- 3. 为用户（主体）设置访问策略
CREATE USER u1 PASSWORD 'u1.pass'
    ACCESS POLICY p1
        WRITE LABEL lab1,lab2
        READ LABEL lab1,lab2;

-- 3 新增 LEVEL (1次只允许新增、修改、删除单个LEVEL、MARK、LABEL)
ALTER ACCESS POLICY p1 ADD LEVLE l4=40;

-- 4 修改 LEVEL
ALTER ACCESS POLICY p1 ALTER LEVLE l1=15;

-- 5 删除 LEVEL
ALTER ACCESS POLICY p1 DROP LEVLE l3;
ALTER ACCESS POLICY p1 DROP LEVLE l1 CASCADE;
    -- 预期：同时删除lab1。如果不带CASCADE，由于lab1依赖l1，会删除失败
    -- 本示例场景中，以前，u1使用了lab1，现在，u1执行SELECT时，不能用访问控制策略了，INSERT时，使用lab2。

-- 5 新增 MARK
ALTER ACCESS POLICY p1 ADD MARK mc,md;

-- 6 删除 MARK
ALTER ACCESS POLICY p1 DROP MARK mc;

-- 7 新增 LABEL
ALTER ACCESS POLICY p1 ADD LABEL lab3=l3;

-- 8 修改 LABEL
ALTER ACCESS POLICY p1 ALTER LABEL lab1=l2;

-- 9 删除 LABEL
ALTER ACCESS POLICY p1 DROP LABEL lab1;
    -- 在表中，存储的是label的值，即level与mark，即使删除label，仍然可以正常比较levle与mark
```

#### 场景六：删除访问策略

#### 扩展场景一：explain

#### 扩展场景二：index_scan

#### 扩展场景三：subquery

#### 扩展场景六：sublink

#### 扩展场景四：join

#### 扩展场景五：view

#### 扩展场景六：copy

#### 扩展场景七：vb_dump

#### 异常场景一：边界场景

```sql
-- 1 LEVEL 超过最大值 100
CREATE ACCESS POLICY p1
    LEVLE l1=101;

-- 2 LEVEL 数量超过限制 100个
CREATE ACCESS POLICY p1
    LEVLE l1=1, l2=2, [此处省略98个], l101=101;

-- 3 MARK 数量超过限制 100个
CREATE ACCESS POLICY p1
    MARK m1, m2, [此处省略98个], m101;

-- 3 LABEL 数量超过限制 100个

-- 4 ...
```

#### 异常场景二：逻辑错误

```sql
-- 1 不存在的 LEVEL 和 MARK
CREATE ACCESS POLICY p1
    LEVLE l1=1
    MARK ma
    LABEL lab2=l2, labb=mb;

-- 2 重复的 LEVLE, MARK, LABEL
CREATE ACCESS POLICY p1
    LEVLE l1=1,l1=2,l2=1 -- 名称不能重复，取值可以重复
    MARK ma,ma
    LABEL lab1=l1,lab1=l2;

-- 3 不存在的策略
CREATE USER u1 .. ACCESS POLICY p_not_exist ..;
CREATE TABLE t1 .. SECURED BY (access_policy=p_not_exist);

-- 4 重复的策略
CREATE USER u1 .. ACCESS POLICY p1 ACCESS POLICY p2;
CREATE TABLE t1 .. SECURED BY (access_policy=p1, access_policy=p2);

-- 5 ..
```

### 2.2.2 配置参数和文件

1.  新增GUC参数write_label  
    会话级，默认为空，控制用户向表中写数据时，为数据赋予的标签
2.  新增GUC参数read_label  
    会话级，默认为空，控制用户从表中读数据时，使用的标签

### 2.2.3 数据相关性

无

## 2.3 接口信息

1.  新增SQL语法：ACCESS POLICY

    ```sql
    CREATE ACCESS POLICY $policy_name
        [LEVEL $level_name=$level_number [, $level_name=$level_number ...]]
        [MARK $mark_name [, $mark_name ...]]
        LABEL $label_name={$level_name | $mark_name | $level_name:$mark_name [, ...]}

    ALTER ACCESS POLICY $policy_name
        [ADD LEVEL $level_name=$level_number [, $level_name=$level_number ...]]
        [ALTER LEVEL $level_name=$level_number [, $level_name=$level_number ...]]
        [DROP LEVEL $level_name [, $level_name ...]]
        [ADD MARK ..]
        [ALTER MARK ..]
        [DROP MARK ..]
        [ADD LABEL ..]
        [ALTER LABEL ..]
        [DROP LABEL ..]

    DROP ACCESS POLICY [IF EXISTS] $policy_name [, $policy_name];
    ```

2.  扩展SQL语法：CREATE/ATLER USER

    ```sql
    CREATE/ALTER USER $user_name
        [ACCESS POLICY $policy_name WRITE $label_list READ $label_list]
    ```

3.  扩展SQL语法：CREATE/ALTER TABLE

    ```sql
    CREATE TABLE $table_name .. WITH (access_policy = $policy_name);
    ALTER TABLE $table_name .. WITH (access_policy = none);
    ```

4.  新增会话级GUC参数write_label
5.  新增会话级GUC参数read_label
6.  新增系统表vb_access_policy
7.  新增系统表vb_access_level
8.  新增系统表vb_access_mark
9.  新增系统表vb_access_label
10.  扩展系统表pg_authid：新增2列rolaccpol，rolacclab
11.  新增系统函数has_mac_permission(uint64, uint64)

## 2.4 正反向行为

### 2.4.1 生效说明

直接通过SQL语法，可创建、设置访问策略。并通过查看系统表，判断是否操作成功，相关系统表包括：vb_access_policy、vb_access_level、vb_access_mark、vb_access_label、pg_class、pg_authid  
SELECT、UPDATE、DELETE表时，判断查询结果、操作结果，判断访问控制是否生效。

### 2.4.2 提示信息

### 2.4.3 约束和依赖

1.  为表设置访问策略：当前版本，只支持在创建表阶段，设置访问策略，不支持为已存在的表设置访问策略。
2.  修改表的访问策略：只支持取消表的访问策略，不支持修改表的访问策略

## 2.5 安全性

### 2.5.1 权限控制

强制访问控制，与自主访问控制、行级访问控制共存，即当主体访问客体时，同时生效。

### 2.5.2 审计

审计新增的DDL语法：CREATE/ALTER/DROP ACCESS POLICY。

## 2.6 影响范围

### 2.6.1 对已有UDT,UDF, ECPG的影响

无

### 2.6.2 对系统函数的影响

无

### 2.6.3 对系统CATALOG的影响

1.  新增vb_access_policy
2.  新增vb_access_level
3.  新增vb_access_mark
4.  新增vb_access_label
5.  扩展pg_authid：新增2列rolaccpol，rolacclab

### 2.6.4 对xlog日志格式、数据格式的影响

无

### 2.6.5 与其他功能交互时的行为表现

与自主访问控制、行级访问控制交互：三者同时生效，互不影响

### 2.6.6 版本兼容性

本版本第1次支持，新创建表时，支持设置访问策略，不支持为存量表设置访问策略。

### 2.6.7 用户行为变更

1.  新增SQL语法：ACCESS POLICY
2.  扩展SQL语法：CREATE/ATLER USER
3.  扩展SQL语法：CREATE/ALTER TABLE
4.  新增会话级GUC参数write_label
5.  新增会话级GUC参数read_label
6.  新增系统表vb_access_policy
7.  新增系统表vb_access_level
8.  新增系统表vb_access_mark
9.  新增系统表vb_access_label
10.  扩展系统表pg_authid：新增2列rolaccpol，rolacclab

## 2.7 指标相关

### 2.7.1 关键资源指标

CPU：  
内存：  
外存：

### 2.7.2 系统性指标

### 2.7.3 性能指标

## 2.8 测试建议

## 2.8 其他说明
