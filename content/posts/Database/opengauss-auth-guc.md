+++
title = 'openGauss 身份认证 GUC参数'
date = '2025-02-28T16:43:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['openGauss', '身份认证']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 身份认证

-   身份认证  
    大部分数据库都支持基于口令的身份认证，以vastbase为例，身份认证的流程如下：

    1.  高权限用户创建新用户

        ```sql
        CREATE USER u1 PASSWORD 'u1.pass1';
        ```

    2.  数据库在`pg_authid`系统表中存储用户以及密码的哈希

        ```sql
        SELECT oid, rolname, rolvalidbegin, rolpassword FROM pg_authid WHERE rolname = 'u1';

             oid   | rolname | rolvalidbegin |     rolpassword
            -------+---------+---------------+--------------------------------------------------------------------------
             24576 | u1      |               | sha2565e3b533ca5db32acdffdb6aea03395af163ac3cfdc9ddb.......
        ```

    3.  数据库在`pg_auth_history`系统表中存储密码创建时间

        ```sql
        SELECT roloid, passwordtime FROM pg_auth_history;

              oid  |         passwordtime
            -------+-------------------------------
             24576 | 2025-02-11 12:17:02.969642+08
        ```

    4.  新用户登录数据库

        ```sql
        gsql -d postgres -U u1 -W 'u1.pass1' -r
        ```

    5.  数据库校验新用户信息：数据库接收用户建立连接的请求时，会进行一系列身份鉴别操作，包括：检查用户提供的密码与pg_authid中的值是否匹配，检查pg_auth_history中记录的密码生成日期与当前日期是否间隔较久等
-   身份认证配置参数  
    大部分数据库都支持配置密码有效期等与密码有关的参数。比如，oracle中，控制密码有效期的参数为`PASSWORD_LIFE_TIME`，vastbase中，控制密码有效期的参数为`password_effect_time`。

-   数据库配置参数  
    在vastbase中，数据库的配置参数称为GUC参数，`password_effect_time`是用于控制密码有效期的GUC参数，包括password_effect_time等大部分GUC参数的作用范围是整个集群，即所有用户的密码有效期都由1个GUC参数控制。  
    在oracle中，针对密码有效期等少部分参数，支持按用户级配置参数，即每个用户都可以配置独立的PASSWORD_LIFE_TIME参数，该功能称为profile。本文主要讨论的内容，只包含用户级配置参数。

# 2 GUC参数的使用方法

在opengauss中，有6个GUC参数与profile中的参数一致。

```sql
SELECT name, setting, vartype, context FROM pg_settings WHERE name in (
    'failed_login_attempts',
    'password_effect_time',
    'password_reuse_time',
    'password_reuse_max',
    'password_lock_time',
    'session_timeout');

            name          | setting | vartype | context
    ----------------------+---------+---------+---------
    failed_login_attempts | 3       | integer | sighup
    password_effect_time  | 90      | real    | sighup
    password_lock_time    | 0.0001  | real    | sighup
    password_reuse_max    | 0       | integer | sighup
    password_reuse_time   | 0.0001  | real    | sighup
    session_timeout       | 600     | integer | user
```

此处，先介绍各参数的功能，以及如何验证参数的功能。

## 一、failed_login_attempts

用户使用账号和密码登录数据库时，如果密码连续失败多次，则账号将被锁定一段时间。  
failed_login_attempts用于设置出发锁定的连续失败次数的阈值。

1.  设置参数

    ```sql
    export DATADIR=$GAUSSHOME/data1
    gs_guc reload -D $DATADIR -c "failed_login_attempts=3"
    ```

2.  创建用户

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1';
    ```

3.  连续失败登录

    ```sql
    gsql -d postgresql -U u1 -W '1.wrong_pass'
    gsql -d postgresql -U u1 -W '2.wrong_pass'
    gsql -d postgresql -U u1 -W '3.wrong_pass'
    ```

4.  查看失败次数  
    从系统表中，查看用户的失败登录次数

    ```sql
    gsql -d postgres -c "
    SELECT * FROM pg_user_status WHERE roloid = (SELECT oid FROM pg_authid WHERE rolname = 'u1');"

    roloid | failcount |           locktime            | rolstatus | permspace | tempspace | passwordexpired
    -------+-----------+-------------------------------+-----------+-----------+-----------+-----------------
     16411 |         3 | 2025-02-21 12:05:10.199257+08 |         0 |         0 |         0 |               0
    ```

    由于密码错误次数达到限制，接下来，账号将被锁定

    ```sql
    gsql -d postgres -U u1 -W 'u1.pass1' -r
    -- 预期输出 FATAL: The account has been locked.

    -- 解锁方法
    gsql -d postgres -c "ALTER USER u1 ACCOUNT UNLOCK;"
    ```

5.  清理环境

    ```sql
    DROP USER u1;
    ```

## 二、password_lock_time

用户使用账号和密码登录数据库时，如果密码连续失败多次，则账号将被锁定一段时间  
password_lock_time用于设置账号锁定时间  
该参数与failed_login_attempts结合使用，只能用来解锁自动锁定场景，即触发密码错误次数导致的锁定，不能解锁主动锁定场景`ALTER USER .. ACCOUNT LOCK`

1.  账号被锁定后，自动解锁的时间

    ```bash
    # 1天 = 24 * 60 * 60 = 86400秒，0.0001天是 8.64秒
    export DATADIR=$GAUSSHOME/data1
    gs_guc reload -D $DATADIR -c "password_lock_time=0.0001d"

    gs_guc reload -D $DATADIR -c "failed_login_attempts=3"
    ```

2.  创建用户

    ```sql
    CREATE USER u1 PASSWORD 'u1@pass1';
    ```

3.  锁定用户

    ```bash
    gsql -d postgres -c "
    SELECT * FROM pg_user_status WHERE roloid = (SELECT oid FROM pg_authid WHERE rolname = 'u1');"

    gsql -d postgres -r -U u1 -W 'u1@error' -c "SELECT 1"
    gsql -d postgres -r -U u1 -W 'u1@error' -c "SELECT 1"
    gsql -d postgres -r -U u1 -W 'u1@error' -c "SELECT 1"

    # 连续失败3次，账号被短暂锁定，无法登录
    gsql -d postgres -r -U u1 -W 'u1@pass1' -c "SELECT 1"
    # 预期输出 FATAL:  The account has been locked.

    gsql -d postgres -c "
    SELECT * FROM pg_user_status WHERE roloid = (SELECT oid FROM pg_authid WHERE rolname = 'u1');"
    # 预期输出
          roloid | failcount |           locktime            | rolstatus | permspace | tempspace | passwordexpired
        --------+-----------+-------------------------------+-----------+-----------+-----------+-----------------
          16477 |         3 | 2025-02-21 16:57:21.263935+08 |         1 |         0 |         0 |               0

    # 等几秒钟，超过8.64秒

    # 系统表中的锁定状态被自动清理
    gsql -d postgres -c "
    SELECT * FROM pg_user_status WHERE roloid = (SELECT oid FROM pg_authid WHERE rolname = 'u1');"
    # 预期输出
         roloid | failcount |           locktime            | rolstatus | permspace | tempspace | passwordexpired
        --------+-----------+-------------------------------+-----------+-----------+-----------+-----------------
          16477 |         0 | 2025-02-21 16:57:21.263935+08 |         0 |         0 |         0 |               0

    # 现在可以连接成功了
    gsql -d postgres -r -U u1 -W 'u1@pass1' -c "SELECT 1"
    # 预期输出 连接成功
    ```

## 三、password_effect_time

为用户设置密码时，密码都有有效期。  
password_effect_time用于设置有效期的时间。但是，在vastbaes和opengauss中，密码达到有效期之后，即密码过期后，密码仍然可以正常使用，没有任何功能上的影响。

1.  创建用户

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1';
    ```

2.  查看密码创建日期

    ```sql
    SELECT roloid, passwordtime FROM pg_auth_history;

            oid   |         passwordtime
        ----------+-------------------------------
            24576 | 2025-02-11 12:17:02.969642+08
    ```

3.  查看密码有效期  
    用户主动调用函数，查看当前用户的密码过期剩余天数

    ```sql
    SELECT gs_password_deadline();
    ```

4.  密码过期的表现  
    每次使用gsql连接数据库时，gsql会自动执行`gs_password_deadline()`函数，获取密码有效期。如果密钥过期，则打印一条提醒  
    除此之外，没有其他地方使用password_effect_time参数，即使密码过期，相关账号依然可以正常使用，而且也只是gsql会打印提醒，libpq/JDBC/ODBC等都不会打印
5.  主动让密码过期  
    在vastase中，主动让密码过期，与password_effect_time这个GUC参数无任何关系  
    用户可主动执行`ALTER USER .. EXPIRED`设置密码过期，此时，系统表pg_user_status中，用户对应的passwordexpired列的值将由0变为1，即代表用户密码过期

    ```sql
    ALTER USER u1 PASSWORD EXPIRED;

    -- 主动让密码过期后，用户无法连接数据库，也无法执行gs_password_deadline函数
    gsql -d postgres -U u1 -W 'u1.pass1' -c "SELECT gs_password_deadline()"
    -- 输出 ERROR:  Please use "ALTER ROLE user_name IDENTIFIED BY 'password' REPLACE 'old password';" to modify the expired password of user u1 before operation!
    ```

6.  清理环境

    ```sql
    DROP USER u1;
    ```

## 四、 password_reuse_max

1.  创建用户

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1';
    ```

2.  设置GUC参数，不能重复使用最近3次使用的密码

    ```bash
    export DATADIR=$GAUSSHOME/data1
    gs_guc reload -D $DATADIR -c "password_reuse_max=3"
    ```

3.  修改密码

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

## 五、password_reuse_time

1.  确保其他GUC参数不影响测试

    ```bash
    export DATADIR=$GAUSSHOME/data1
    gs_guc reload -D $DATADIR -c "password_reuse_max=0"
    ```

2.  设置集群级GUC参数

    ```bash
    # 1天 = 24 * 60 * 60 = 86400秒，0.0001天是 8.64秒
    gs_guc reload -D $DATADIR -c "password_reuse_time=0.0001"
    ```

3.  创建用户

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1';

    ALTER USER u1 PASSWORD 'u1.pass2';
    ```

4.  查看用户曾使用过的密码

    ```sql
    SELECT * FROM pg_auth_history WHERE roloid = (SELECT oid FROM pg_authid WHERE rolname = 'u1');

         roloid |         passwordtime          | rolpassword
        --------+-------------------------------+------------------------------------
         16419  | 2025-02-21 15:20:50.308879+08 | sha256c84795e1631bbb8bf1ecf923...
         16419  | 2025-02-21 15:22:06.754397+08 | sha2562939db0b3ffc71ee3115e010...
    ```

5.  使用旧密码

    ```sql
    -- 使用不太古老的密码（确保不要超过8.64秒）
    ALTER USER u1 PASSWORD 'u1.pass3';
    ALTER USER u1 PASSWORD 'u1.pass4';
    ALTER USER u1 PASSWORD 'u1.pass3'; -- 8.64秒内快速改回pass3
    -- 预期输出 ERROR:  The password cannot be reused.

    -- 使用更古老一点的密码（确保已超过8.64秒）
    ALTER USER u1 PASSWORD 'u1.pass3';
    -- 预期输出 修改成功
    ```

6.  清理环境

    ```sql
    DROP USER u1;
    ```

## 六、session_timeout

1.  设置回话过期时间

    ```sql
    export DATADIR=$GAUSSHOME/data1
    gs_guc reload -D $DATADIR -c "session_timeout=8s"
    ```

2.  创建用户

    ```sql
    CREATE USER u1 PASSWORD 'u1.pass1';
    ```

3.  连接数据库

    ```sql
    gsql -d postgres -U u1 -W 'u1.pass1' -r

    SELECT 1;

    -- 睡10秒，保证睡眠充足

    SELECT 1;
    -- 预期输出 WARNING:  Session unused timeout.
    ```

    opengauss与vastbase中，当用户的密码过期时，只有2个表现：
    -   gsql：每次使用gsql连接数据库时，gsql会自动执行`gs_password_deadline()`函数，获取密码有效期。如果密钥过期，则打印一条提醒。
    -   内置函数：主动调用`SELECT gs_password_deadline()`函数会显示密码过期  
        除此之外，没有其他地方使用password_effect_time参数，即使密码过期，相关账号依然可以正常使用，只是gsql会打印一条提醒。
4.  对照组：验证集群级guc参数password_effect_time  
    请参考上述2个guc参数验证方式，为节约篇幅，此处不再继续给示例  
    查看密码创建日期的语法如下：

    ```sql
    SELECT roloid, passwordtime FROM pg_auth_history;

            oid  |         passwordtime
        -------+-------------------------------
    ```

    opengauss和vastbase中，密码的另一种强制过期，是通过是否主动执行`ALTER USER .. EXPIRED`设置的，此时，系统表pg_user_status中，用户对应的passwordexpired列的值将由0变为1，即代表用户密码过期。密码创建时间、密码有效期天数设置等，并不会导致密码真的过期。

    ```sql
    ALTER USER u1 PASSWORD EXPIRED;

    -- 主动让密码过期后，用户无法连接数据库，也无法执行gs_password_deadline函数
    gsql -d postgres -U u1 -W 'u1.pass1' -c "SELECT gs_password_deadline()"
    -- 输出 ERROR:  Please use "ALTER ROLE user_name IDENTIFIED BY 'password' REPLACE 'old password';" to modify the expired password of user u1 before operation!
    ```

# 3 pg md5

```python
ClientAuthentication
    hba_getauthmethod
        case uaMD5:
            CheckPWChallengeAuth
        case uaPassword:
            CheckPasswordAuth
                sendAuthRequest
                recv_password_packet
                get_role_password
                plain_crypt_verify
                    pg_md5_encrypt
```
