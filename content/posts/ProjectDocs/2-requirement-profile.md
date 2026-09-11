+++
title = '海量 2 需求 profile'
date = '2025-02-19T17:43:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['身份认证', '需求文档']
weight = 200
ShowToc = true
TocOpen = true
+++
# 1 简介

## 1.1 目的

vastbase与oracle都支持设置运行参数：

-   vastbase：支持设置集群级guc参数，例如，guc参数failed_login_attempts用于设置’用户密码错误多少次后锁定账户’，该参数对集群中所有用户（非初始用户）都有效。
-   oracle：也支持failed_login_attempts参数，但是oracle支持为不同用户设置不同的failed_login_attempts值。我们且将此类参数称为用户级参数。

与oracle相比，vastbase的guc参数功能存在2个差异：

1.  作用范围：oracle支持设置用户级参数，vastbase大部分参数都是集群级guc参数
2.  参数个数：23版本的oracle支持18个用户级参数，其中6个可在vastbase找到对应的guc参数
3.  参数取值：vastbase中，6个guc参数的取值范围与oracle profile不同

本文主要介绍以下几点：

1.  oracle用户级参数的个数、设置方法
2.  vastbase中对应集群级guc参数的个数、设置方法
3.  vastbase新需求：尽量实现与oracle一致的用户级guc参数

本文档可指导开发者、测试者熟悉vastbase用户级guc配置参数特性

本文档的内容已被上传至tapd，tapd上，排版更好看，测试用例更方便复制。建议直接从tapd上查看本文档原文: [https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001007196](https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001007196)

## 1.2 适用范围

vastbase 3.0.8及之后版本，vastbase用户级参数profile特性接口设计、使用指导等。

## 1.3 术语定义、首字母缩写词和缩略语

-   GUC：Grand Unifed Configuralion，postgresql和vastbase的配置参数

## 1.3 参考资料

-   原始需求： [https://www.tapd.cn/60475194/prong/stories/view/1160475194001074627](https://www.tapd.cn/60475194/prong/stories/view/1160475194001074627)
-   tapd上本需求文档链接： [https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001007196](https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001007196)
-   tapd上6个与密码相关的guc参数的使用参考： [https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001007200](https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001007200)
-   oracle 23 profile语法以及相关参数： [https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/CREATE-PROFILE.html](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/CREATE-PROFILE.html)
-   mysql 8.0 create user语法以及相关参数： [https://mysql.net.cn/doc/refman/8.0/en/create-user.html](https://mysql.net.cn/doc/refman/8.0/en/create-user.html)
-   mysql 配置参数列表：[https://mysql.net.cn/doc/refman/8.0/en/server-system-variable-reference.html](https://mysql.net.cn/doc/refman/8.0/en/server-system-variable-reference.html)
-   vastbase g100 create user语法以及相关参数： [https://docs.vastdata.com.cn/zh_CN/VastbaseG100/V3.0.8/1/6a4766151e29496b9f88cd2d9dd3db2e](https://docs.vastdata.com.cn/zh_CN/VastbaseG100/V3.0.8/1/6a4766151e29496b9f88cd2d9dd3db2e)

# 2 支持oracle用户级配置profile

## 2.1 功能简述

### 【需求来源】桂林银行

-   需求链接：[https://www.tapd.cn/60475194/prong/stories/view/1160475194001074627](https://www.tapd.cn/60475194/prong/stories/view/1160475194001074627)
-   需求描述：桂林银行客户指出，目前对于数据库用户的管理方式不够便捷，无法像oracle profile方式为用户赋予一组安全策略。一些属性如密码有效期、密码过期天数、密码尝试次数等也只能全局设定，无法指定用户配置。- 需求范围：桂林银行使用的数据库兼容模式包括oracle和mysql两种兼容模式。

### 【需求背景】oracle 23的profile功能

通俗来讲，oracle的profle可理解为细粒度的配置参数。1个profile包含1组配置参数，不同用户可使用不同的profile。按上述例子，要单独控制某个用户的密码有效期，操作步骤如下：

1.  创建用户

    ```sql
    CREATE USER u1 IDENTIFIED BY "u1.1234";
    ```

2.  创建profile，同时设置用户级参数  
    此处，以设置密码有效期参数为例：

    ```sql
    CREATE PROFILE pro1 LIMIT FAILED_LOGIN_ATTEMPTS 10;
    ```

3.  设置用户u1使用profile pro1

    ```sql
    ALTER USER u1 PROFILE pro1;
    ```

4.  查看用户u1使用的profile

    ```sql
    SELECT username, profile FROM dba_users WHERE username = 'U1';

         USERNAME  |   PROFILE
        -----------+--------------
         U1        | PRO1
    ```

5.  查看profile pro1中的全部配置参数  
    oracle 8版本中，有16个用户级配置参数，oracle 23本中，有18个用户级配置参数。

    ```sql
    SELECT * FROM dba_profiles WHERE profile = 'PRO1' ORDER BY resource_type;

                PROFILE  |       RESOURCE_NAME       | RESOURCE_TYPE |   LIMIT
        -----------------+---------------------------+---------------+-----------
        PRO1             | FAILED_LOGIN_ATTEMPTS     | PASSWORD      | 10  
        PRO1             | PASSWORD_LIFE_TIME        | PASSWORD      | DEFAULT
        PRO1             | PASSWORD_REUSE_TIME       | PASSWORD      | DEFAULT
        PRO1             | PASSWORD_REUSE_MAX        | PASSWORD      | DEFAULT
        PRO1             | PASSWORD_LOCK_TIME        | PASSWORD      | DEFAULT
        PRO1             | PASSWORD_GRACE_TIME       | PASSWORD      | DEFAULT
        PRO1             | INACTIVE_ACCONT_TIME      | PASSWORD      | DEFAULT
        PRO1             | PASSWORD_VERIFY_FUNCTION  | PASSWORD      | DEFAULT
        PRO1             | PASSWORD_ROLLOVER_TIME    | PASSWORD      | DEFAULT
        PRO1             | SESSIONS_PER_USER         | KERNEL        | DEFAULT
        PRO1             | CPU_PER_SESSION           | KERNEL        | DEFAULT
        PRO1             | CPU_PER_CALL              | KERNEL        | DEFAULT
        PRO1             | CONNECT_TIME              | KERNEL        | DEFAULT
        PRO1             | IDLE_TIME                 | KERNEL        | DEFAULT
        PRO1             | LOGICAL_READS_PER_CALL    | KERNEL        | DEFAULT
        PRO1             | LOGICAL_READS_PER_SESSION | KERNEL        | DEFAULT
        PRO1             | PRIVATE_SGA               | KERNEL        | DEFAULT
        PRO1             | CONPOSITE_LIMIT           | KERNEL        | DEFAULT
    ```

在oracle 23版本中，profile功能支持的18个用户级参数中，这些参数分为2类，详见本文<1.3 参考资料>

-   系统资源类：比如1个用户可建立多少连接
-   身份认证类：比如密码有效期等  
    但是，在vastbase中，仅能找到6个与之对应的参数

    | 编号 | oracle profile 参数 | oracle取值范围 | vastbase guc 参数 | vb取值范围 | 参数分类 | 参数功能 |
    | --- | --- | --- | --- | --- | --- | --- |
    | 1 | FAILED_LOGIN_ATTEMPTS | [1, max] unlimited | failed_login_attempts | [1,1000] | 认证类 | 登录数据库时，如果密码错误次数超过<本参数>，则账号会被锁定，短期内无法再登录 |
    | 2 | PASSWORD_LOCK_TIME | [1, max] unlimited | password_lock_time | [1,525600]min | 认证类 | 如果因密码错误次数过多，导致账号被锁，将锁定<本参数>的时间 |
    | 3 | PASSWORD_LIFE_TIME | [1, max] unlimited | password_effect_time | [30,36500]day | 认证类 | 设置或更新用户密码时，超过<本参数>的时间，密码会过期（oracle与vastase表现不同） |
    | 4 | PASSWORD_GRACE_TIME | \- | \- | \- | 认证类 | 如果密码过期，在<本参数>的时间内，密码仍可使用 |
    | 5 | PASSWORD_REUSE_TIME | [1, max] unlimited | password_reuse_time | [30, 90]day | 认证类 | 用户设置密码时，如果密码在过去的<本参数>的时间内别用过，则密码不能复用，opengauss [0,3650] |
    | 6 | PASSWORD_REUSE_MAX | \- | password_reuse_max | [1,100] | 认证类 | 用户设置密码时，如果密码已被重复使用过<本参数>的次数，则密码不能复用 |
    | 7 | INACTIVE_ACCONT_TIME | \- | \- | \- | 认证类 | 如果一个账号在<本参数>的时间内，未登录过，则锁定账号 |
    | 8 | PASSWORD_VERIFY_FUNCTION | \- | \- | \- | 认证类 | 用户设置密码时，调用<本参数>指定的函数，检查密码是否符合要求 |
    | 9 | PASSWORD_ROLLOVER_TIME | \- | \- | \- | 认证类 | 新旧密码滚动更新天数 |
    | 10 | SESSIONS_PER_USER | \- | \- | \- | 资源类 | 1个用户可建立的最大连接数 |
    | 11 | CPU_PER_SESSION | \- | \- | \- | 资源类 | 1个连接可使用CPU时间数 |
    | 12 | CPU_PER_CALL | \- | \- | \- | 资源类 | 1个调用（比如1个SQL）可使用CPU时间数 |
    | 13 | CONNECT_TIME | \- | \- | \- | 资源类 | 1个连接可持续的时间 |
    | 14 | IDLE_TIME | [1, max] unlimited | session_timeout | [0,86400] | 资源类 | 1个连接空闲时间限制 |
    | 15 | LOGICAL_READS_PER_CALL | \- | \- | \- | 资源类 | 1次调用（比如1个SQL）允许读写的page数量 |
    | 16 | LOGICAL_READS_PER_SESSION | \- | \- | \- | 资源类 | 1个连接允许读取的page数量 |
    | 17 | PRIVATE_SGA | \- | \- | \- | 资源类 | 1个连接可使用的共享内存空间大小 |
    | 18 | CONPOSITE_LIMIT | \- | \- | \- | 资源类 | 1个连接可可使用的总资源：按cpu时间、连接时间、page读写数等加权求和 |

### 【需求背景】mysql 8的密码安全策略

经调研，mysql无类似profile的功能，仅支持global或session级的参数，可通过以下语法设置参数：（详见本文<1.3 参考资料>）

```sql
SET GLOBAL default_password_lifetime = 90;
```

mysql无法单独为某个用户设置参数。但是，可通过语法，设置某些属性（详见本文<1.3 参考资料>）

```sql
CREATE USER user .. [password_option]

password_option: {
    PASSWORD EXPIRE [DEFAULT | NEVER | INTERVAL N DAY] -- 与oracle的password_effect_time参数等效
  | PASSWORD HISTORY {DEFAULT | N}
  | PASSWORD REUSE INTERVAL {DEFAULT | N DAY} -- 与oracle的password_reuse_time参数等效
  | PASSWORD REQUIRE CURRENT [DEFAULT | OPTIONAL]
  | FAILED_LOGIN_ATTEMPTS N -- 与oracle的failed_login_attempts参数等效
  | PASSWORD_LOCK_TIME {N | UNBOUNDED}
}
```

同时，vastbase也支持通过`CREATE USER`等语法设置少数几个与密码相关的参数：（详见本文<1.3 参考资料>）

```sql
CREATE USER username [option] PASSWORD 'password';

option {
    ..
    | VALID BEGIN 'timestamp'
    | VALID UNTIL 'timestamp'
    | TEMP SPACE 'tmpspacelimit' -- 临时表的存储空间
    | ..
}
```

### 【需求说明】vastbase如何实现profile功能

从用户的角度看，本特性将实现与oracle功能接近的profile功能，该特性的核心分为以下3个部分：

1.  支持管理profile（语法与oracle一致）  
    包括创建、更新、查询、删除profile。1个profile存储1组guc参数，当前版本仅能支持6个用户级GUC（下文介绍），这些guc参数可看做用户级guc参数，只针对部分用户生效，作用范围与原有的集群级guc参数不同

    ```sql
    CREATE PROFILE pro1; -- 创建
    ALTER PROFILE pro1 LIMIT failed_login_attempts 10；-- 更新：仅支持更新profile的中的配置项，不支持更新profile本身的名称等元信息，在pro1中更新配置项failed_login_attempts的值
    SELECT proname FROM vb_profile_settings; -- 查询
    DROP PROFILE pro1; -- 删除
    ```

2.  支持管理用户的profle（语法与oracle一致）  
    包括为用户设置、查询、撤销profile。如果为用户设置profile，该用户使用profile中guc的优先级大于集群级guc

    ```sql
    CREATE USER u1 .. PROFILE pro1; -- 设置
    ALTER USER u1 PROFILE pro1; -- 设置
    SELECT rolname, profname FROM vb_profiles; -- 查询
    ALTER USER u1 PROFILE default; -- 删除，即用户恢复使用集群级guc
    ```

3.  支持管理profile中的配置项（语法与oracle一致）  
    包括新增、更新、查询、删除配置项目。1个配置项即1个guc参数。名称、取值范围等与原guc一致、只是作用范围不一致。

    ```sql
    CREATE PROFILE pro1 LIMIT failed_login_attempts 10;  -- 新增（可一次新增多个）
    ALTER PROFILE pro1 LIMIT password_lock_time 20; -- 新增（可一次新增多个）
    ALTER PROFILE pro1 LIMIT failed_login_attempts 20 password_lock_time 20; -- 更新
    SELECT proname, name, setting FROM vb_profile_settings; -- 查询
    ALTER PROFILE pro1 LIMIT failed_login_attempts default; -- 删除
    ```

此外，需确认几个问题：

1.  profile guc数量：当前版本，仅支持上表中6个vb已存在的guc
    -   failed_login_attempts
    -   password_lock_time
    -   password_effect_time (oracle PASSWORD_LIFE_TIME)
    -   password_reuse_time
    -   password_reuse_max
    -   session_timeout (oracle IDLE_TIME)
2.  profile guc名称：6个guc中，2个参数的参数名与oracle不一致，即上表中第3和第14个，仍采用当前vb的guc名称
3.  profile guc取值范围：6个guc的取值范围与集群级guc的取值范围一致
4.  特性兼容性：在[oracle兼容性、mysql兼容性、postgresql兼容性、sqlserver兼容性]模式下，仅oracle兼容性下支持该特性
    -   show sql_comp..

## 2.2 功能说明

### 2.2.1 使用流程

#### 场景一、管理profile

1.  **创建**profile  
    profile可理解为1组用户级GUC配置参数。

    ```sql
    CREATE PROFILE pro1;
    -- 新增语法 CREATE PROFILE
    ```

2.  **创建**profile，同时，设置配置参数

    ```sql
    CREATE PROFILE pro2 LIMIT failed_login_attempts 2 password_effect_time 20； -- 当前版本，支持6个guc参数
    ```

3.  **更新**profile  
    仅支持更新中profile中的配置项，比如新增、删除配置项，更新配置的值等。  
    可一次更新1个或多个用户级配置参数。此处以2个配置参数为例：

    ```sql
    ALTER PROFILE pro2 LIMIT failed_login_attempts 3 password_effect_time 30;
    -- 新增语法 ALTER PROFILE
    ```

    此处，并未设置用户使用pro1，pro1暂时无任何作用。
4.  **查询**profile

    ```sql
    SELECT * FROM vb_profile_settings;
    -- 新增系统表 vb_profile_settings

        proname     |   setname                 |      setting       | settype
        ------------+---------------------------+--------------------+------------
        pro1        | profile_status            | active             | enum -- 此时，pro1无任何配置项，但是，需要存储1行特殊行，表示profile存在
        pro2        | profile_status            | active             | enum
        pro2        | failed_login_attempts     | 3                  | int
        pro2        | password_effect_time      | 30                 | int
    ```

5.  **删除**profile

    ```sql
    DROP PROFILE pro1, pro2;
    DROP PROFILE IF EXISTS pro1, pro2;
    -- 新增语法 DROP PROFILE
    ```

#### 场景二、管理用户的profile

1.  前置：创建profile

    ```sql
    CREATE PROFILE pro1 failed_login_attempts 4 password_effect_time 10;
    ```

2.  用户**设置**profile  
    在创建用户时，即可指定profile

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1;
    -- 扩展语法：CREATE USER/ROLE .. PROFILE ..
    ```

3.  用户**设置**profile  
    对于已存在的用户，设置profile的语法如下

    ```sql
    CREATE USER u2 PASSWORD 'u2.12345';
    ALTER USER u2 PROFILE pro1;
    -- 扩展语法 ALTER USER .. PROFILE ..
    ```

4.  用户**查询**profile  
    假设存在用户u3，但是未为u3设置profile，则系统表中不存储u3的信息

    ```sql
    SELECT * FROM vb_profiles;
    -- 新增系统表 vb_profiles

        roloid | rolname | profile
        -------+---------+----------
        1600   | u1      | pro1
        16001  | u2      | pro2
    ```

5.  验证profile与user的denpendcy关系

    ```sql
    SELECT * FROM pg_depend;

    DROP PROFILE pro1;
    -- 预期输出 DROP失败，u1与u2依赖profile1
    ```

6.  验证profile与user的denpendcy关系

    ```sql
    DROP USER u1;

    SELECT * FROM vb_profiles;
    -- 预期输出
        roloid | rolname | profile
        -------+---------+----------
        16001  | u2      | pro2
    ```

7.  清理环境

    ```sql
    DROP USER u2;
    DROP PROFILE pro1;
    ```

#### 场景三、管理profile中的配置项

1.  前置：创建profile

    ```sql
    CREATE PROFILE pro1 failed_login_attempts 1;
    ```

2.  在profile**新增**配置项

    ```sql
    ALTER PROFILE pro1 password_effect_time 10;
    ```

3.  在profile**查询**配置项

    ```sql
    SELECT * FROM vb_profile_settings;
        proname     |   setname                 |      setting       | settype
        ------------+---------------------------+--------------------+------------
        pro1        | profile_status            | active             | enum
        pro1        | failed_login_attempts     | 1                  | int
        pro1        | password_effect_time      | 10                 | int

    -- 以下语法可查询集群级GUC参数的值
    SELECT name, setting FROM pg_settings WHERE name in (
        'failed_login_attempts',
        'password_effect_time',
        'password_reuse_time',
        'password_reuse_max',
        'password_lock_time',
        'session_timeout');
    ```

4.  在profile**更新**配置项

    ```sql
    ALTER PROFILE pro1 LIMIT failed_login_attempts 20 password_lock_time 20;
    ```

5.  在profile**删除**配置项  
    将配置项设置为默认值，即与集群级guc参数保持一致，此时，系统表vb_profile_settings中将不再重复存储配置项的值。

    ```sql
    ALTER PROFILE pro1 LIMIT password_lock_time default;
    ```

6.  清理环境

    ```sql
    DROP PROFILE pro1;
    ```

#### 场景四、验证约束场景

1.  前置：创建profile

    ```sql
    CREATE PROFILE pro1;
    ```

2.  约束：仅支持设置6个白名单中的guc参数  
    即不支持的guc参数

    ```sql
    ALTER PROFILE pro1 LIMIT password_min_length 3;
    -- 预期输出 不支持在profile中设置此参数
    ```

3.  约束：不支持在设置配置项的值时使用表达式  
    由于（配置项、配置项取值）之间使用空格隔开，(配置项、配置项)之间也使用空格隔开，使用表达式时，可能会存在语法规约冲突的问题

    ```sql
    ALTER PROFILE pro1 LIMIT failed_login_attempts 2 + 1;
    -- 预期输出 ERROR: 语法解析错误

    CREATE TABLE t1 (c1 INT);
    INSERT INTO t1 VALUES (3);
    ALTER PROFILE pro1 LIMIT failed_login_attempts (SELECT c1 FROM t1);
    -- 预期输出 ERROR: 语法解析错误
    ```

4.  约束：具有管理员权限的账号，才能设置profile的配置项的值

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1';

    gsql -d postgresql -U u1 -W 'u1.pass1' -c "ALTER PROFILE pro1 LIMIT password_min_length 3;"
    -- 预期输出 ERROR: 权限不足
    ```

5.  约束：该特性只在oracle兼容性模式下生效

    ```sql
    -- 设置mysql兼容性

    CREATE PROFILE pro1;
    -- 预期输出 ERROR: profile特性仅在oracle兼容性模式下生效
    ```

6.  配置项的值不符合数据类型约束

    ```sql
    ALTER PROFILE pro1 LIMIT failed_login_attempts 'a_string';
    -- 预期输出 ERROR: 参数值的数据类型错误
    ```

7.  清理环境

    ```sql
    DROP TABLE t1;
    DROP USER u1;
    DROP PROFILE pro1;
    ```

#### 场景五、验证参数1: failed_login_attempts

1.  设置profile参数failed_login_attempts

    ```sql
    CREATE PROFILE pro1 failed_login_attempts 2;

    -- 为做对照，确保集群级guc参数failed_login_attempts的值不是2
    show failed_login_attempts;
    ```

2.  为用户设置profile

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1;
    ```

3.  验证profile参数failed_login_attempts  
    首先，输入2次错误密码，达到failed_login_attempts的阈值，再输入正确密码

    ```sql
    -- 错误密码2次
    gsql -d postgresql -U u1 -W '1.wrong_pass'
    gsql -d postgresql -U u1 -W '2.wrong_pass'

    -- 正确密码
    gsql -d postgresql -U u1 -W '2.wrong_pass'
    -- 预期输出 FATAL: The account has been locked.
    ```

    从系统表中，使用其他用户，查看用户u1的失败登录次数

    ```sql
    gsql -d postgres -c "
    SELECT * FROM pg_user_status WHERE roloid = (SELECT oid FROM pg_authid WHERE rolname = 'u1');"

    roloid | failcount |           locktime            | rolstatus | permspace | tempspace | passwordexpired
    -------+-----------+-------------------------------+-----------+-----------+-----------+-----------------
     16411 |         2 | 2025-02-21 12:05:10.199257+08 |         0 |         0 |         0 |               0
    ```

    解锁方法：等一会，或者手动解锁

    ```sql
    gsql -d postgres -c "ALTER USER u1 ACCOUNT UNLOCK;"
    ```

4.  对照组：验证集群级guc参数failed_login_attempts  
    首先，设置集群级guc参数

    ```bash
    export DATA_DIR=数据库安装目录

    gs_guc reload -D $DATA_DIR -c "failed_login_attempts=5"
    ```

    然后，创建新用户，新用户不指定profile，即新用户将使用集群级guc参数

    ```sql
    CREATE USER u2 PASSWORD 'u2.pass1';
    ```

    接下来，新用户连续输入多次错误密码

    ```sql
    -- 错误密码2次
    gsql -d postgresql -U u2 -W '1.wrong_pass' -c "SELECT 1"
    gsql -d postgresql -U u2 -W '2.wrong_pass' -c "SELECT 1"

    -- 正确密码
    gsql -d postgresql -U u2 -W 'u2.pass1' -c "SELECT 1"
    -- 预期输出 登录成功
    ```

5.  清理环境

    ```sql
    DROP USER u1,u2;
    DROP PROFILE pro1;

    gs_guc reload -D $DATA_DIR -c "failed_login_attempts=default"
    ```

#### 场景六、验证参数2: password_lock_time

该参数与failed_login_attempts结合使用，只能用来解锁自动锁定场景，即出发密码错误次数导致的锁定，不能解锁主动锁定场景

1.  设置profile参数password_lock_time

    ```sql
    -- 1天 = 24 * 60 * 60 = 86400秒，0.0001天是 8.64秒
    CREATE PROFILE pro1 password_lock_time 0.0001;

    -- 设置failed_login_attempts，方便更好触发password_lock_time
    gs_guc reload -D $DATA_DIR -c "failed_login_attempts=2"

    -- 为做对照，确保集群级guc参数password_lock_time的值不是0.0001
    show password_lock_time;
    ```

2.  为用户设置profile

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1;
    ```

3.  验证profile参数

    ```sql
    -- 密码错误2次，触发账号锁定
    gsql -d postgresql -U u1 -W '1.wrong_pass' -c "SELECT 1"
    gsql -d postgresql -U u1 -W '2.wrong_pass' -c "SELECT 1"

    -- 密码正确，账号被锁
    gsql -d postgresql -U u1 -W 'u1.pass1' -c "SELECT 1"

    -- 等约8秒左右，即pro1 password_lock_time的值后，账号自动解锁
    gsql -d postgresql -U u1 -W 'u1.pass1' -c "SELECT 1"
    -- 预期输出 登录成功
    ```

4.  对照组：验证集群级guc参数password_lock_time  
    集群级guc password_lock_time的默认值是1天，不用额外设置

    ```sql
    show password_lock_time;
    ```

    创建新用户，新用户不指定profile，即新用户将使用集群级guc参数

    ```sql
    CREATE USER u2 PASSWORD 'u2.pass1';
    ```

    接下来，新用户连续输入多次错误密码，触发密码锁定

    ```sql
    -- 错误密码2次
    gsql -d postgresql -U u2 -W '1.wrong_pass' -c "SELECT 1"
    gsql -d postgresql -U u2 -W '2.wrong_pass' -c "SELECT 1"

    -- 正确密码
    gsql -d postgresql -U u2 -W 'u2.pass1' -c "SELECT 1"
    -- 预期输出 账号被锁，即使等待很久，远超8秒，账号仍然被锁
    ```

#### 场景七、验证参数3: password_effect_time

1.  设置profile参数password_effect_time

    ```sql
    CREATE PROFILE pro1 password_effect_time 10; -- 10天

    -- 为做对照，确保集群级guc参数password_effect_time的值不是10
    show password_effect_time;
    ```

2.  为用户设置profile

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1;
    ```

3.  验证profile参数  
    首先，修改系统时间到11天后

    ```bash
    data -s "+10 day"
    ```

    然后，连接数据库

    ```sql
    vsql -d postgres -U u1 -W 'u1.pass1' -r
    -- 预期输出 连接失败 密码过期
    ```

    > 这里和opengauss不一致，opengauss密码过期后，只会打印一条提示，但是不会锁定账户

4.  对照组：验证集群级guc参数password_effect_time  
    请参考上述2个guc参数验证方式，为节约篇幅，此处不再继续给示例
5.  清理环境

    ```sql
    DROP USER u1;
    DROP PROFILE pro1;
    ```

#### 场景八、验证参数4: password_reuse_max

在修改密码的场景中，如果新密码与曾经的旧密码相同，password_reuse_max参数，用于设置不用重复使用过去几次的密码，从参数名上，判断不出参数的具体作用，看下面的示例方便一些。

1.  设置profile参数password_reuse_max

    ```sql
    CREATE PROFILE pro1 password_reuse_max 3;

    -- 为做对照，确保集群级guc参数password_reuse_max的值不是3
    show password_reuse_max;
    ```

2.  为用户设置profile

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1;
    ```

3.  验证profile参数

    ```sql
    ALTER USER u1 PASSWORD 'u1.pass2';
    ALTER USER u1 PASSWORD 'u1.pass3';

    -- 重复倒数第3次使用的密码
    ALTER USER u1 PASSWORD 'u1.pass1';
    -- 预期输出 ERROR:  The password cannot be reused.

    -- 再修改1次密码
    ALTER USER u1 PASSWORD 'u1.pass4';

    -- 重读倒是读4次使用的密码
    ALTER USER u1 PASSWORD 'u1.pass1';
    -- 预期输出 修改密码成功
    ```

4.  对照组：验证集群级guc参数password_reuse_max  
    请参考上述2个guc参数验证方式，为节约篇幅，此处不再继续给示例  
    查看用户曾使用过的密码的语法如下，但是该语法查到的rolpassword列是`sha256(password || salt)`的值，无法从肉眼判断password是否相同

    ```sql
    SELECT * FROM pg_auth_history WHERE roloid = (SELECT oid FROM pg_authid WHERE rolname = 'u1');

         roloid |         passwordtime          | rolpassword
        --------+-------------------------------+------------------------------------
         16419  | 2025-02-21 15:20:50.308879+08 | sha256c84795e1631bbb8bf1ecf923...
         16419  | 2025-02-21 15:22:06.754397+08 | sha2562939db0b3ffc71ee3115e010...
    ```

5.  清理环境

    ```sql
    DROP USER u1;
    DROP PROFILE pro1;
    ```

#### 场景九、验证参数5: password_reuse_time

在修改密码的场景中，如果新密码与曾经的旧密码相同，password_reuse_max参数，用于设置不能重复使用过去一段时间内使用的密码

1.  设置profile参数password_reuse_time

    ```sql
    -- 1天 = 24 * 60 * 60 = 86400秒，0.0001天是 8.64秒
    CREATE PROFILE pro1 password_reuse_time 0.0001;

    -- 为做对照，确保集群级guc参数password_reuse_max的值不是3
    show password_reuse_time;
    ```

2.  为用户设置profile

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1;
    ALTER USER u1 PASSWORD 'u1.pass2';
    ```

3.  验证profile参数

    ```sql
    -- 使用不太古老的密码（确保不要超过8.64秒）
    ALTER USER u1 PASSWORD 'u1.pass3';
    ALTER USER u1 PASSWORD 'u1.pass3';
    -- 预期输出 ERROR:  The password cannot be reused.

    -- 再等几秒，超过8.64秒再改回pass3
    ALTER USER u1 PASSWORD 'u1.pass3';
    -- 预期输出 修改成功
    ```

4.  对照组：验证集群级guc参数password_reuse_time  
    请参考上述2个guc参数验证方式，为节约篇幅，此处不再继续给示例  
    查看用户曾使用过的密码的语法如下，passwordtime是密码使用时间

    ```sql
    SELECT * FROM pg_auth_history WHERE roloid = (SELECT oid FROM pg_authid WHERE rolname = 'u1');

         roloid |         passwordtime          | rolpassword
        --------+-------------------------------+------------------------------------
         16419  | 2025-02-21 15:20:50.308879+08 | sha256c84795e1631bbb8bf1ecf923...
         16419  | 2025-02-21 15:22:06.754397+08 | sha2562939db0b3ffc71ee3115e010...
    ```

    password_reuse_time与password_reuse_max参数，在新密码与旧密码相同的场景中，只要满足二者中任意一个条件，都可以修改成功
5.  清理环境

    ```sql
    DROP USER u1;
    DROP PROFILE pro1;
    ```

#### 场景十、验证参数6: session_timeout

1.  设置profile参数session_timeout

    ```sql
    CREATE PROFILE pro1 session_timeout '8s';

    -- 为做对照，确保集群级guc参数session_timeout的值不是8s
    show session_timeout;
    ```

2.  为用户设置profile

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1;
    ```

3.  验证profile参数

    ```sql
    gsql -d postgres -U u1 -W 'u1.pass1' -r

    SELECT 1;

    -- 等8秒

    SELECT 1;
    -- 预期输出 WARNING:  Session unused timeout.
    ```

4.  对照组：验证集群级guc参数session_timeout  
    请参考上述2个guc参数验证方式，为节约篇幅，此处不再继续给示例
5.  清理环境

    ```sql
    DROP USER u1;
    DROP PROFILE pro1;
    ```

#### 场景十一、其他场景

-   前向兼容：升级旧版本数据库，即可使用profile
-   备机生效：备机的参数生效机制，与集群级guc参数类似，只是特定用户的参数值采用profile中的参数值

### 2.2.2 配置参数和文件

### 2.2.3 数据相关性

-   GUC参数：未新增guc参数。6个guc参数的生效范围，由 [集群级] 变为 [集群级，用户级]
-   兼容性模式：仅oracle兼容性模式生效

## 2.3 接口信息

-   新增guc  
    resource_limit = on / off
-   新增3个SQL语法：

    ```sql
    CREATE PROFILE profilename LIMIT [setting_name {setting_value | UNLIMITED} ...]
    ALTER PROFILE profilename  LIMIT [setting_name {setting_value | UNLIMITED} ...]
    DROP PROFILE [IF EXISTS] profilename [, profilename, ..]
    ```

-   扩展2个SQL语法

    ```sql
    CREATE USER .. [PROFILE profilename] ..
    ALTER USER .. [PROFILE profilename] ..
    ```

-   新增2个系统表
    -   pg_user_settings  
        新安装或升级到3.0.8版本的vastbase时，有一个默认的profile，profile中有7个配置项：
        -   新安装：7个配置项的默认值如下
        -   升级：7个配置项中，5个配置项的默认值来源于旧版本数据库的guc参数的取值

            ```sql
            setgroup    |   setname                 |      setval        | valunit | valtype  | valmin  | valmax     | valdefault | settype  |
            ------------+---------------------------+--------------------+---------+--------------------+------------+------------+----------+
            default     | failed_login_attempts     | unlimited          | times   | int      | 1       | 2147483646 | 10         | password |
            default     | password_lock_time        | unlimited          | days    | double   | 0.00001 | 2147483646 | 1          | password |
            default     | password_life_time        | unlimited          | days    | double   | 0.00001 | 2147483646 | 180        | password |
            default     | password_grace_time       | unlimited          | days    | double   | 0.00001 | 2147483646 | 7          | password |
            default     | password_reuse_time       | unlimited          | days    | double   | 0.00001 | 2147483646 | 1          | password |
            default     | password_reuse_max        | unlimited          | times   | int      | 1       | 2147483646 | 1          | password |
            default     | idle_time                 | unlimited          | minutes | double   | 0.00001 | 2147483646 | 10         | kernel   |
            ```

    -   pg_auth_profile

        ```sql
        roloid | rolname | profile
        -------+---------+----------
        ```

-   新增1个系统视图
    -   dba_profiles

        ```sql
        CREATE OR REPLACE VIEW dba_profiles AS
            SELECT
                setgroup profile
                setname resource_name
                settype resource_type
                setval  limit
            FROM pg_user_settings;
        ```

        默认查询结果如下：

        ```sql
        SELECT * FROM dba_profiles;
        SELECT * FROM user_profiles; -- oracle 无此视图
        SELECT * FROM all_profiles; -- oracle 无此视图

        profile | resource_name         | resource_type | limit
        ---------+-----------------------+---------------+-----------
        default  | failed_login_attempts | password      | unlimited
        default  | password_lock_time    | password      | unlimited
        default  | password_life_time    | password      | unlimited
        default  | password_grace_time   | password      | unlimited
        default  | password_reuse_time   | password      | unlimited
        default  | password_reuse_max    | password      | unlimited
        default  | idle_time             | kernel        | unlimited
        default  | failed_login_attempts | password      | unlimited
        ```

| 编号 | 参数名 | 取值范围 | 默认值 | 功能 |
| --- | --- | --- | --- | --- |
| 1 | failed_login_attempts | [1, 2147483646], unlimited | 10 | 登录数据库时，如果密码错误次数超过<本参数>，则账号会被锁定，短期内无法再登录 |
| 2 | password_lock_time | [0.00001, 2147483646], unlimited | 1(day) | 如果因密码错误次数过多，导致账号被锁，将锁定<本参数>的时间 |
| 3 | password_life_time | [0.00001, 2147483646], unlimited | 180(day) | password_effect_time, 设置或更新用户密码时，超过<本参数>的时间，密码会过期 |
| 4 | password_grace_time | [0.00001, 2147483646], unlimited | 7(day) | 如果密码过期，在<本参数>的时间内，密码仍可使用 |
| 5 | password_reuse_time | [0.00001, 2147483646], unlimited | 1(day) | 用户户设置密码时，如果密码在过去的<本参数>的时间内别用过，则密码不能复用 |
| 6 | password_reuse_max | [1, 2147483646], unlimited | 1 | 用户设置密码时，如果密码已被重复使用过<本参数>的次数，则密码不能复用 |
| 7 | idle_time | [0.00001, 2147483646], unlimited | 10(min) | session_timeout 1个连接空闲时间限制 |

default

## 2.4 正反向行为

### 2.4.1 生效说明

-   特性可用  
    数据库可解析以下语法，则说明特性生效

    ```sql
    CREATE PROFILE profilename;
    ```

-   特性生效  
    系统表vb_profiles与vb_profile_settings不为空，系统表中指定的用户使用系统表中的用户级GUC参数

### 2.4.2 提示信息

-   新增DDL语法，正确执行时，符合DDL的显示格式`CREATE PROFILE`，`ALTER PROFILE`, `DROP PROFILE`
-   设置不符合约束的参数、参数取值类型等时，有明显的报错信息

### 2.4.3 约束和依赖

1.  参数类型范围：在profile中，仅支持设置6个参数：[failed_login_attempts, password_effect_time, password_reuse_time, password_reuse_max, password_lock_time, session_timeout]
2.  参数取值范围：profile支持的参数的取值类型、取值范围与对应的集群级guc参数相同
3.  参数赋值约束：设置profile参数的值时，不支持使用表达式，例如`CREATE PROFILE pro1 LIMIT failed_login_attempts 2 + 1`，`CREATE PROFILE pro1 LIMIT failed_login_attempts (SELECT num FROM t1)`
4.  特性生效模式：本特性在oracle兼容性模式下可用，在其他兼容性模式下不可用
5.  特性权限约束：本特性中的`CREATE PROFILE / ALTER PROFILE / DROP PROFILE`的权限约束，与`CREATE USER / ALTER USER / DROP USER`一致

## 2.5 安全性

### 2.5.1 权限控制

本特性中的`CREATE PROFILE / ALTER PROFILE / DROP PROFILE`的权限约束，与`CREATE USER / ALTER USER / DROP USER`一致

### 2.5.2 审计

适配统一审计，记录`CREATE PROFILE / ALTER PROFILE / DROP PROFILE`语法中的关键信息

## 2.6 影响范围

### 2.6.1 对已有UDT,UDF, ECPG的影响

不涉及

### 2.6.2 对系统函数的影响

未新增系统函数

### 2.6.3 对系统CATALOG的影响

新增2个系统表

-   vb_profile_settings

    ```sql
    proname     |   setname                 |      setting       | settype
    ------------+---------------------------+--------------------+------------
    ```

-   vb_profiles

    ```sql
    roloid | rolname | profile
    -------+---------+----------
    ```

### 2.6.4 对xlog日志格式、数据格式的影响

未新增xlog类型，未修改现有xlog格式

### 2.6.5 与其他功能交互时的行为表现

不涉及

### 2.6.6 版本兼容性

本特性在oracle兼容性模式下可用，在其他兼容性模式下不可用

## 2.7 指标相关

### 2.7.1 关键资源指标

-   内存占用：非常小。本特性将在内存中缓存系统表vb_profile_settings与vb_profiles的部分字段，假设有100个用户设置profile，每个用户设置3个参数，内存占用为100 \* 3 \* 100bytes = 30k
-   外存占用：非常小。与内存占用接近，数据级一般为几十到几百k
-   CPU占用：非常小。仅在每个用户建立连接时，判断使用集群级还是用户级GUC参数检查密码登信息
-   网络占用：非常小

### 2.7.2 系统性指标

本特性是功能特性，无其他指标

### 2.7.3 性能指标

仅影响建立连接的过程，不影响tpcc， tpch等指标。  
如果原来存在户与数据库建立连接的性能，该场景整体劣化不超过10%

## 2.8 测试建议

可对比集群级GUC参数的值，验证用户级GUC参数（即profile功能）是否生效

## 2.8 其他说明

无
