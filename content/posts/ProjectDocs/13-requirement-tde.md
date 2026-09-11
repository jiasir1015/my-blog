+++
title = '海量 透明加密 需求'
date = '2026-03-20T10:47:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['加密', '需求文档']
weight = 1300
ShowToc = true
TocOpen = true
+++
# 1 简介

## 1.1 目的

透明加密特性提供数据加密功能，核心原理是在数据库将数据存储至磁盘时，先加密再存储。  
本需求将从0设计透明加密特性，在保障功能、性能、易用性、可用性、可维护性、可扩展性等的前提下，让特性达到商用标准。

## 1.2 适用范围

Vastbase V5版本。

## 1.3 术语定义、首字母缩写词和缩略语

-   TDE：Transparent Data Encryption，透明数据加密，由数据库提供的数据加密特性

## 1.4 参考资料

-   oracle 透明加密特性：[https://docs.oracle.com/en/database/oracle/oracle-database/26/dbtde/preface.html](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbtde/preface.html)
-   sql server 透明加密特性：[https://learn.microsoft.com/en-us/sql/relational-databases/security/encryption/transparent-data-encryption?view=sql-server-ver17](https://learn.microsoft.com/en-us/sql/relational-databases/security/encryption/transparent-data-encryption?view=sql-server-ver17)
-   oceanbase 透明加密特性：[https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000004475958](https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000004475958)
-   kingbase 透明加密特性：[https://docs.kingbase.com.cn/cn/KES-V9R1C10/safe/transparent-data-Encyption](https://docs.kingbase.com.cn/cn/KES-V9R1C10/safe/transparent-data-Encyption)
-   dm8 透明加密特性：[https://eco.dameng.com/document/dm/zh-cn/pm/storage-encryption.html#7.1.1%20%E5%85%A8%E5%BA%93%E5%8A%A0%E5%AF%86](https://eco.dameng.com/document/dm/zh-cn/pm/storage-encryption.html#7.1.1%20%E5%85%A8%E5%BA%93%E5%8A%A0%E5%AF%86)
-   gaussdb 透明加密特性：[https://support.huaweicloud.com/intl/zh-cn/fg-gaussdb-dist-v8/gaussdb-18-0019.html](https://support.huaweicloud.com/intl/zh-cn/fg-gaussdb-dist-v8/gaussdb-18-0019.html)

# 2 透明加密

## 2.1 功能简述

### 一、基本原理

通常，用户将数据传输给数据库后，数据库将数据存储到磁盘。攻击者可能利用多种数据库内部或外部漏洞，例如操作系统漏洞等，绕过数据库安全机制，直接从磁盘读取数文件，窃取用户数据。

**透明加密**，是一种由数据库提供的加密特性，可有效解决攻击者从磁盘窃取数据的问题。开启透明加密后，数据库将数据存储到磁盘时，先加密数据，再存储数据密文；数据库从磁盘读取数据时，先解密数据密文，再进行其他计算。用户访问透明加密表时，包括存储、读取数据等，与访问普通表无任何区别，加密和解密过程由数据库自动完成，即对用户透明。

### 二、竞品分析

几乎所有商用关系数据库中，都支持透明加密特性，包括oracle, sql server, oceanbase, kingbase, dm8等，postgresql不支持透明加密特性。  
使用透明加密时，通常包括3个阶段：

1.  定义用于加密的密钥
2.  使用SQL语法，定义哪些对象需加密，不同产品，定义加密对象的粒度不同
3.  使用SQL语法，访问透明加密表，以及进行其他运维等操作

各产品中，定义加密对象的SQL语法如下：

```sql
-- 一、oracle
CREATE TABLE t1(c1 INT, c2 TEXT ENCRYPT);
CREATE TABLESPACE ts1 DATAFILE .. ENCRYPTION USING 'AES192' ENCRYPT;
-- 二、sql server
CREATE DATABASE ENCRYPTION KEY WITH ALGORITHM = AES_256 ..
ALTER DATABASE db1 SET ENCRYPTION ON;
-- 三、oceanbase
CREATE TABLESPACE ts1 encryption = 'y'; -- mysql cmpt
CREATE TABLESPACE ts1 ENCRYPTION USING 'aes-256'; -- oracle cmpt
-- 四、kingbase
CREATE TABLESPACE ts .. WITH (ENCRYPTION = TRUE);
CREATE TABLE ts .. ENCRYPTED BY 'this is a key';
-- 五、dm8
intdb .. ENCRYPT_NAME ..
CREATE TABLESPACE .. ENCRYPT WITH ..
CREATE TABLE t1 (c1 INT, c2 INT ENCRYPT WITH ..);
-- 六、gaussdb
CREATE TABLE t1 .. WITH (enable_tde=on);
```

各产品中，按定义加密对象的粒度，区别如下：

| 产品 | 加密粒度 | 加密范围 |
| --- | --- | --- |
| oracle | tablespace, column | relfile, redo |
| sql server | database | relfile, transaction log |
| oceanbase | tablespace | relfile, clog |
| kingbase | tabpespace, table | relfile, wal |
| dm8 | cluster, tablespace, coulumn | relfile, redo |
| gaussdb | table | relfile, wal |

### 三、实现难点

在第1版本的特性中，出于工作量考虑，部分功能无法满足。

1.  加密范围  
    当用户执行SQL时，例如`INSERT INTO t1 VALUES ('data1')`，在磁盘上，以下多类文件中，都可能存在数据`data1`，本版本只支持加密部分文件中的数据：

    1.  relation file（支持）
    2.  toast file (支持)
    3.  index file (支持)
    4.  materialized view file (不支持)
    5.  double write file (如果有，可以支持)
    6.  catalog file (pg_stats) （不支持）
    7.  wal file （不支持）
        -   物理备份
        -   物理复制流
        -   逻辑复制流

    -   …
2.  密钥管理  
    大部分数据库的加密方案中，数据库只存储密钥密文，高级别的密钥，由第三方密钥管理服务存储。  
    但是，为考虑易用性、可测试性、可扩展性等，本版本暂时只支持数据库本机管理密钥。

## 2.2 功能说明

### 2.2.1 使用流程

#### 场景一、配置透明加密

```sql
-- 1. 创建数据密钥
CREATE ENCRYPTION KEY tde_key WITH (source=local, password='pass.123');
    -- 集群中所有表，都使用同1个密钥加密
    -- 集群中，暂时只允许存在1个密钥，CREATE多余密钥报错
    -- 参考openGauss gs_guc encrypt命令，生成密钥，并简单加密存储
    -- 未来计划：全密态主密钥、数据密钥，审计日志加密密钥，系统表password加密密钥（fdw, replication等）等其他特性， 可统一使用该语法，统一管理密钥

-- 2. 查看数据密钥
SELECT * FROM vb_encryption_key;
     keyoid | keyname  | keyinfo
    --------+----------+-------------
      17000 |tde_key   | type=local
    -- password单独加密存储
```

#### 场景二、为表设置加密属性

```sql
-- 1. 创建表
CREATE TABLE t1 (c1 TEXT, c2 TEXT)；

-- 2. 创建加密策略
CREATE ENCRYPTION POLICY ep1 FOR public.t1 KEY tde_key ALGORITHEM aes_256_ctr MAC ALGORITHM sha256;
    -- ALGORITHEM：   默认aes_256_ctr，可选aes_256_gcm，aes_256_cbc
    -- MAC ALGORITHM：默认无，可选sha256
    -- 未来计划： 可指定密钥来源，指定硬件加密，指定密钥自动乱转等
    -- 暂不支持国密算法

    -- 设置初衷：规范化多个对象安全特性
    -- (1) 审计
    --     CREATE AUDIPT POLICY ap1 OPERATE select,insert,...
    -- (2) 强制访问控制
    --     CREATE ACCESS POLICY acp1 FOR t1 ..
    -- (3) 防篡改
    --     CRATE LEDGER POLICY lp1 FOR ..
    -- (4) 脱敏
    --     CREATE MASK POLLICY mp1 FOR ..
    -- (5) 全密态
    --     CREATE ENCRYPTION POLICY ep1 FOR  ..

-- 3. 查看表加密策略
SELECT * FROM vb_encryption_policy;
    polname  | polkey  | polalgo    | polmacalgo
    ---------+---------+------------+------------
       ep1   | tde_key |aes_256_ctr | sha256

-- 4. 查看加密对象
SELECT * FROM vb_secure_class;
    relid | relname | encryption_policy | access_policy
    ------+---------+-------------------+---------------
    17001 | t1      | ep1               |

-- 5. 向表中存储数据（数据存储至）
INSERT INTO t1 VALUES ('data11', 'data12');

-- 6. 查看表文件路径
SELECT setting || '/' || pg_relation_filepath('t1') FROM pg_settings WHERE name = 'data_directory';
-- 示例输出
                       ?column?
-------------------------------------------------------
 /path/to/data_directory/base/16386/16387

-- 7. 验证数据加密存储
\! hexdump -C /path/to/data_directory/base/16386/16387
-- 预期输出：文件中，查看不到明文数据 ('data11', 'data12')

-- 8. 从表中查询数据
SELECT * FROM t1;
-- 预期输出：查询到数据明文，用户无法直观感受到自动解密过程

-- 9. 清理环境
DROP TABLE t1;
```

#### 场景三、为表修改加密属性

```sql
-- 1. 创建非加密表
CREATE TABLE t1 (c1 TEXT, c2 TEXT)；

-- 2. 为表修改加密属性
CREATE ENCRYPTION POLICY ep1 KEY tde_key ALGORITHEM aes_256_ctr MAC ALGORITHM sha256;
ALTER ENCRYPTION POLICY ep1 ADD public.t1;
-- 预期：表中新生成的page，数据将被加密，旧数据不会立刻被加密

-- 3. 立即加密旧数据
VACUUM FULL t1;

-- 5. 为表取消加密属性
ALTER ENCRYPTION POLICY ep1 REMOVE public.t1;
-- 提示用户：旧数据仍然出于加密状态，用VACUUM FULL等语法，可立即解密旧数据
-- 预期：表中新生成的page，数据不再被加密，旧数据仍然处于加密状态

-- 6. 立即解密旧数据
VACUUM FULL t1;

-- 7. 为表修改其他加密属性
ALTER ENCRYPTION POLICY ep1 ALGORITHEM aes_256_cbc;

-- 8. 清理环境
DROP TABLE t1;
```

#### 场景四、轮转密钥

```sql
-- 1. 创建表
CREATE TABLE t1 (c1 TEXT, c2 TEXT);
INSERT INTO t1 VALUES ('data11', 'data12');

-- 2. 加密表
CREATE ENCRYPTION POLICY ep1 FOR t1;

-- 3. 轮转密钥
ALTER ENCRYPTION KEY tde_key ROTATION;
-- 预期：表中新写入的数据，将使用新密钥加密

-- 4. 重启 或 不重启集群

-- 5. 查询旧数据
SELECT * FROM t1;
    -- 预期：旧数据仍然使用旧密钥，但是可正常解密

-- 8. 清理环境
DROP TABLE t1;
```

#### 场景五、为索引设置加密属性

基表加密时，索引也会默认加密

#### 扩展场景一、为其他类型表设置加密属性

1.  加密toast表

    ```sql
    -- 1. 创建表
    CREATE TABLE t1 (c1 INT, c2 TEXT);
        -- 包含TEXT等可变长度的列
    CREATE ENCRYPTION POLICY ep1 KEY tde_key FOR t1;

    -- 2. 存储超长数据
    INSERT INTO t1 VALUES (1, REPEAT('a', 3000));
    -- 3. 查看toast表的oid
    SELECT reltoastrelid FROM pg_class WHERE relname = 't1';
    -- 4. 查看toast表的物理文件
    SELECT setting || '/' || pg_relation_filenode(xxx) FROM pg_settings WHERE name = 'data_directory';
    -- 预期：t1对应toast表，文件中，数据被加密存储
    ```

2.  加密分区表  
    预期：每个分区对应的文件中，数据被加密存储
3.  临时表  
    预期：临时文件中，数据被加密存储

#### 扩展场景二、主备加密一致性

1.  主机加密数据

    ```sql
    CREATE TABLE t1 (c1 INT, c2 TEXT);
        -- 包含TEXT等可变长度的列
    CREATE ENCRYPTION POLICY ep1 KEY tde_key FOR t1;
    INSERT INTO t1 VALUES (generate_series(1, 2000), 'cipher');
    ALTER ENCRYPTION POLICY ep1 REMOTE t1;
    INSERT INTO t1 VALUES (generate_series(1, 2000), 'plain');
    ```

2.  备机数据需与主机一致  
    在备机上，数据文件需与主机严格一致。
    -   解释：大部分加密场景中，加密数据会产生膨胀，导致文件中page容量变小。例如，主机page 1加密，数据容量为7.9k，备机page 1不加密，数据容量为8k。发生主备切换后，可能出现1个节点的page 1有容量，可以写入数据，另一个阶段的page 1容量不够，无法进行redo。

#### 扩展场景三、加密其他文件

1.  双写文件（如果有）  
    需要加密
2.  wal文件  
    本版本暂不支持加密

#### 异常场景一、关闭透明加密

如果使用第三方密钥服务，可能出现密钥服务异常，影响数据库集群状态的问题，需关闭透明加密以降低影响范围。  
关闭透明加密后，可能出现很多功能问题。比如：无法向表中写数据、无法从表中读数据、无法故障恢复等。  
本版本无复杂场景，不会出现这些问题。

#### 异常场景二、密钥异常

执行`CREATE ENCRYPTION KEY tde_key`语法，会生成密钥文体，存放在数据目录下，同时生成wal日志。基于主备物理复制、物理备份等方式，保证密钥安全。

### 2.2.2 配置参数和文件

1.  新增密钥文件  
    在数据目录下，新增文件夹 /vb_sec，新增文件 /vb_sec/key_info，用于存储数据密钥  
    当执行`CREATE ENCRYPTION KEY`时，生成密钥文件。

### 2.2.3 数据相关性

新增wal类型：当执行`CREATE ENCRYPTION KEY`时，生成密钥文件，产生redo log，用于向备机同步密钥文件。

## 2.3 接口信息

1.  新增密钥管理语法

    ```sql
    CREATE ENCRYPTION KEY $key_name (source = local, password = $password)
    ALTER ENCRYPTION KEY $key_nam ROTATION;
    DROP ENCRYPTION KEY $key_name;
    ```

2.  新增加密策略语法

    ```sql
    CREATE ENCRYPTION POLICY $pollicy_name
        [FOR [TABLE] $table_name [, $table_name ...]]
        KEY $key_name
        [ALGORITHEM {aes_256_ct | aes_256_gcm | aes_256_cbc} ] -- 默认：aes_256_ct
        [MAC ALGORITHM {sha256}] -- 默认：空

    ALTER ENCRYPTION POLICY $pollicy_name
        [ADD [TABLE] $table_name [, $table_name ...]]
        [REMOVE [TABLE] $table_name [, $table_name ...]]
        [ALGORITHEM {aes_256_ct | aes_256_gcm | aes_256_cbc} ]

    DROP ENCRYPTION POLICY $pollicy_name;
    ```

3.  新增系统表vb_encryption_key

    ```sql
    -- 表结构：
    keyoid | keyname | keyinfo
    -------+---------+---------
    ```

4.  新增系统表vb_encryption_policy

    ```sql
    -- 表结构：
    polname  | polkey  | polalgo    | polmacalgo
    ---------+---------+------------+------------
    ```

5.  新增系统表vb_secure_class

    ```sql
    -- 表结构：
    relid | relname | encryption_policy | access_policy
    ------+---------+-------------------+---------------
    ```

## 2.4 正反向行为

### 2.4.1 生效说明

查看系统表，判断密钥、策略等是否设置成功  
查看表物理文件，判断数据是否加密成功

### 2.4.2 提示信息

加密解密异常时，日志中会记录相关错误信息

### 2.4.3 约束和依赖

无

## 2.5 安全性

### 2.5.1 权限控制

使用ENCRYPTION KEY、ENCRYPTION POLICY语法时，需特权用户，例如superuser，sysadmin等，三权分立场景，需安全管理员

### 2.5.2 审计

ENCRYPTION KEY、ENCRYPTION POLICY语法作为通用DDL审计

## 2.6 影响范围

### 2.6.1 对已有UDT,UDF, ECPG的影响

无

### 2.6.2 对系统函数的影响

未新增

### 2.6.3 对系统CATALOG的影响

关于新增系统表的详细信息，请看上文接口信息章节：

1.  新增系统表vb_encryption_key
2.  新增系统表vb_encryption_policy
3.  新增系统表vb_secure_class

### 2.6.4 对xlog日志格式、数据格式的影响

在执行CRETE/ALTER/DROP ENCRYPTION KEY时，参数wal，新增wal类型

### 2.6.5 与其他功能交互时的行为表现

无

### 2.6.6 版本兼容性

-   前向兼容：本版本首次支持透明加密，不涉及兼容性
-   后向兼容：设计阶段，已考虑将来可能接收的需求：
    -   加密算法：支持国密sm4等算法
    -   密钥管理：支持对接第三方密钥管理服务
    -   加密组件：支持对接第三方加密机
    -   加密范围：支持加密wal日志

### 2.6.7 用户行为变更

无

## 2.7 指标相关

### 2.7.1 关键资源指标

-   CPU：开启透明加密，数据存储时，需加密数据，占用CPU。tpcc场景，加密全部表，CPU占用率升高10%以内。
-   内存：额外占用内存可忽略，加密存储时，在page上原地加密即可，无需额外申请内存
-   IO：无占用

### 2.7.2 系统性指标

无

### 2.7.3 性能指标

tpcc场景，加密全部表、索引，与不加密相比，使用默认加密算法aes_256_ctr，性能劣化5%以内。

## 2.8 测试建议

无

## 2.8 其他说明

无
