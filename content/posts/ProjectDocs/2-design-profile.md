+++
title = '海量 2 设计 profile'
date = '2025-03-06T11:32:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['身份认证', '设计文档']
weight = 200
ShowToc = true
TocOpen = true
+++
# 1 Oracle兼容性-支持profile功能

## 1.1 功能简述

本特性实现与oracle profile相同的功能，支持为不同用户设置7个不同的配置参数：

1.  failed_login_attempts
2.  password_lock_time
3.  password_life_time
4.  password_grace_time
5.  password_reuse_time
6.  password_reuse_max
7.  idle_time

简单使用示例如下：

```sql
CREATE PROFILE pro1 LIMIT failed_login_attempts 10;
CREATE USER u1 PASSWORD 'u1.pass1';
ALTER USER u1 PROFILE u1;
```

## 1.2 实现方案

### 一、元数据

本特性的关键实现为：对用户提供DDL接口，在内核中存储配置数据。因此，在介绍代码流程前，先介绍接口与元数据。

1.  新增GUC参数resource_limit (与oracle参数名一致)  
    控制是否启用oracle profile功能。  
    如果该参数为on，以下5个guc参数则不再生效：[failed_login_attempts, password_lock_time, password_effect_time, password_reuse_time, password_reuse_max]。另外，对于已经过身份认证的连接，session_timeout也不再生效，相关功能均由profile中的用户级参数控制。  
    对于新安装的集群、旧版本升级的集群，该参数的值存在差异：
    -   新安装：新安装的数据库，即3.0.8版本及之后，该guc参数值默认为on（初始值为off，由initdb自动设置为on）
    -   升级：从3.0.8之前版本，升级到3.0.8版本时，在升级的过程中，该参数的值仍然是off，即升级上来默认不可用profile功能

        ```sql
        SELECT * FROM pg_settings WHERE name = 'resource_limit';

            -[ RECORD 1 ]-------------------------------------------
            name       | resource_limit
            setting    | on         -- 默认为on （由initdb设置为on，从旧版本升级到新版本时，升级脚本会将该参数设置为off）
            unit       |
            category   | Ungrouped
            short_desc | Used to enable profile feature
            extra_desc | default on
            context    | postmaster -- 需重启生效
            vartype    | bool
            source     | default
            min_val    |
            max_val    |
            enumvals   |
            boot_val   | off
            reset_val  | off
            sourcefile |
            sourceline |
        ```

2.  修改6个GUC参数的生效条件  
    当GUC参数resource_limit取值为on时，以下6个GUC参数不再生效：[failed_login_attempts, password_lock_time, password_effect_time, password_reuse_time, password_reuse_max, session_timeout]
3.  新增3个PROFILE的SQL语法 (与oracle语法格式一致)

    ```sql
    CREATE PROFILE profilename LIMIT {setting_name {setting_value | UNLIMITED} ...}
    ALTER PROFILE profilename LIMIT {setting_name {setting_value | UNLIMITED} ...}
    DROP PROFILE [IF EXISTS] profilename [, profilename, ...]
    ```

4.  扩展2个SQL语法（与oracle语法格式一致）

    ```sql
    CREATE USER ... [PROFILE profilename] ...
    ALTER USER ... [PROFILE profilename] ...
    ```

5.  新增系统表 vb_user_profiles  
    存储用户与profile的对应关系  
    新增系统表索引 btree(roloid)

    ```sql
    -- 示例语法 ALTER USER user1 PROFILE profile1;
    roloid | rolname | profile  
    -------+---------+---------
    16384  | user1   | profile1  -- 示例行
    ```

6.  新增系统表 vb_profiles  
    该系统表存储profile中各个配置项的值，以及值的约束。  
    新增系统表索引 btree(profile, setname)。  
    备注：oracle对应的系统表为dba_profiles，本需求还会新增一个名为dba_profiles的系统视图，本质就是查询该表中的4列

    ```sql
    -- 示例语法 CREATE PROFILE profile1 LIMIT failed_login_attempts 10;
    profile     |   setname                 |      setval        | valunit | valtype  | valmin  | valmax     | valdefault | settype
    ------------+---------------------------+--------------------+---------+----------+---------+------------+------------+----------
    profile1    | failed_login_attempts     | 10                 | times   | int      | 1       | 2147483646 | 10         | password  -- 示例行
    ```

    该系统表中，有7行初始数据，即7个profile配置项，以及默认参数，默认参数的取值与oracle一致，都为unlimited。

    ```sql
    profile     |   setname                 |      setval        | valunit | valtype  | valmin  | valmax     | valdefault | settype     -- unlimit含义
    ------------+---------------------------+--------------------+---------+--------------------+------------+------------+----------
    default     | failed_login_attempts     | unlimited          | times   | int      | 1       | 2147483646 | 10         | password    -- 等价INT_MAX，允许无限次登录失败
    default     | password_lock_time        | unlimited          | days    | double   | 0.00001 | 24855      | 1          | password    -- 等价0，账号永远不锁
    default     | password_life_time        | unlimited          | days    | double   | 0.00001 | 24855      | 180        | password    -- 等价DBL_MAX，密码永远有效
    default     | password_grace_time       | unlimited          | days    | double   | 0.00001 | 24855      | 7          | password    -- 等价DBL_MAX，密码过期也永远可用
    default     | password_reuse_time       | unlimited          | days    | double   | 0.00001 | 24855      | 1          | password    -- 等价0，密码可无限复用
    default     | password_reuse_max        | unlimited          | times   | int      | 1       | 2147483646 | 1          | password    -- 等价INT_MAX，密码可无限复用
    default     | idle_time                 | unlimited          | minutes | double   | 0.00001 | 2147483646 | 10         | kernel      -- 等价0，会话永远不过期 (与guc session_timeout 一致)
    -- 0.00001 day = 约0.8 second
    -- 24855 day = 约70 year
    ```

    参考：以下是原guc参数的取值范围

    ```sql
    SELECT name,setting, unit, vartype, short_desc, extra_desc, min_val, max_val, boot_val, reset_val FROM pg_settings
    WHERE name in ('failed_login_attempts', 'password_lock_time', 'password_effect_time', 'password_reuse_time', 'password_reuse_max', 'session_timeout');
             name         | setting |                       short_desc                        |             extra_desc              | min_val | max_val | boot_val | reset_val
    ----------------------+---------+---------------------------------------------------------+-------------------------------------+---------+---------+----------+-----------
    int     failed_login_attempts | 10      | max number of login attempts.                           |                                     | 1       | 1000    | 5        | 5
    reeal   password_effect_time  | 90 day  | password effective time.                                |                                     | 30      | 36500   | 36500    | 30 -- 天
    int     password_lock_time    | 1 min   | password lock time                                      |                                     | 1       | 525600  | 1440     | 1440 -- 分钟
    int     password_reuse_max    | 0       | max times password can reuse.                           |                                     | 1       | 100     | 3        | 3
    real    password_reuse_time   | 60      | max days password can reuse.                            |                                     | 30      | 90      | 90       | 90 -- 天
    int     session_timeout       | 600     | Set the maximum allowed duration of any unused session. | A value of 0 turns off the timeout. | 0       | 86400   | 600      | 600 -- 秒
    ```

7.  新增系统视图 dba_profiles (与oracle视图名与视图结构一致)  
    oracle只有dba_profiles，无user_profiles和all_profiles

    ```sql
    CREATE OR REPLACE VIEW SYS.DBA_PROFILES AS
        SELECT
            profile
            setname resource_name
            settype resource_type
            setval  limit
        FROM vb_profiles;
    ```

    默认查询结果如下：

    ```sql
    SELECT * FROM dba_profiles;

        profile  | resource_name         | resource_type | limit
        ---------+-----------------------+---------------+-----------
        default  | failed_login_attempts | password      | unlimited
        default  | password_lock_time    | password      | unlimited
        default  | password_life_time    | password      | unlimited
        default  | password_grace_time   | password      | unlimited
        default  | password_reuse_time   | password      | unlimited
        default  | password_reuse_max    | password      | unlimited
        default  | idle_time             | kernel        | unlimited
    ```

8.  修改系统视图 DBA_USERS
    -   旧视图

        ```sql
        CREATE OR REPLACE VIEW SYS.DBA_USERS AS
            SELECT
                CAST(quote_ident_redwood(pga.rolname) AS VARCHAR2(64)) AS username,
                pga.oid AS user_id,
                ...,
                NULL::character varying(30) AS profle, -- 修改点
                ...
            FROM pg_authid pga, pg_database pgd, pg_tablespace pgt, pg_user_status pgus -- 修改点
            WHERE ((pgd.datname = current_database()) AND (pgd.dattablespace = pgt.oid) AND (pgus.roloid = pga.oid)); -- 修改点
        ```

    -   新视图

        ```sql
        CREATE OR REPLACE VIEW SYS.DBA_USERS AS
            SELECT
                CAST(quote_ident_redwood(pga.rolname) AS VARCHAR2(64)) AS username,
                pga.oid AS user_id,
                ...,
                pgp.profile varying(64) AS profle,
                ----------------------- 修改
                ...
            FROM pg_authid pga, vb_user_profiles pgp, pg_database pgd, pg_tablespace pgt, pg_user_status pgus
                                -------------------- 新增
            WHERE ((pgd.datname = current_database()) AND (pgd.dattablespace = pgt.oid) AND (pgus.roloid = pga.oid)) AND (pgp.roloid = pga.oid);
                                                                                                                     -------------------------- 新增
        ```

9.  影响系统视图 USER_USERS 与 ALL_USERS：这两个视图本质是从DBA_USERS，DBA_USERS中profile列内容变化，查询结果也会发生变化。

### 二、数据库启动流程

在启动数据库时，需检查是否需要初始化pg_profiles系统表。一个集群中，该初始化操作永远只会触发一次。

此处初始化的意义是，用户查询DBA_USERS视图时，profile列的表现与oralce一致，即所有用户都有profile，未主动设置profile的用户，其profile为default。对于已存在的旧用户，pg_profiles系统表中还未记录其profile信息，需要在pg_profiles中记录其profile为default。

同步流程如下：

```bash
1. 启动数据库
2. 读取GUC参数resource_limit
3. 如果resource_limit为on，且pg_profiles系统表为空，则表示首次使用profile功能，此时需初始化pg_profiles：
    1. 遍历pg_authdid系统表，读取所有的[roloid, rolname]
    2. 依次构造pg_profiles系统表tuple [roloid=roloid, rolname=rolname, profile=default]
    3. 以此将tuple插入至pg_profiles系统表中
```

之后，每次CREATE USER时，即使用户未为用户指定profile，也会默认向pg_profiles中插入一行，表示用户默认使用default profile。

### 三、定义PROFILE参数流程

1.  CREATE PROFILE

    ```bash
    1. 用户执行SQL: CREATE PROFILE profilename LIMIT {setting_name {setting_value | UNLIMITED} ...}
    2. 内核解析SQL：生成CreateProfileStmt语法树
    3. 内核执行SQL：在DDL处理主函数中，处理CreateProfileStmt语法树
        1. 检查resource_limit参数是否开启
        2. 检查用户是否有CreateRole权限
        3. 检查profilename是否已存在
        4. 检查setting_name是否在7个配置项白名单中
        5. 检查setting_value的值是否符合约束
        6. 构造pg_profile_settings系统表tuple：[profile=profilename, setname=setting_name, setval=setting_value]，剩下的值[valunit,valtype,valmin,valmax,valdefault,settype]来自默认值
        7. 将tuple插入到pg_profile_settings中
    ```

2.  ALTER PROFILE

    ```bash
    1. 用户执行SQL: ALTER PROFILE profilename  LIMIT [setting_name {setting_value | UNLIMITED} ...]
    2. 内核解析SQL：生成AlterProfileStmt语法树
    3. 内核执行SQL：在DDL处理主函数中，处理AlterProfileStmt语法树
        1. 检查resource_limit参数是否开启
        2. 检查用户是否有CreateRole权限
        3. 检查profilename是否已存在
        4. 检查setting_name是否在7个配置项白名单中
        5. 检查setting_value的值是否符合约束
        6. 如果系统表pg_profile_settings中未存在对应的setting_name
            构造系统表tuple：[profile=profilename, setname=setting_name, setval=setting_value],剩下的值[valunit,valtype,valmin,valmax,valdefault,settype]来自默认值
            将tuple插入至系统表
        7. 如果系统表中已存在对应的setting_name
            则更新tuple中的setting_value
    ```

3.  ALTER USER .. PROFILE

    ```bash
    1. 用户执行SQL：ALTER USER username ... [PROFILE profilename] ...
    2. 内核解析SQL：生成AlterRoleStmt语法树
    3. 内核执行SQL：在DDL处理主函数中，处理AlterRoleStmt语法树，首先检查用户是否有CreateRole权限，然后处理profile参数：
        1. 检查resource_limit参数是否开启
        2. 检查profilename是否已存在
        3. 获取用户对应的roleid
        4. 如果系统表pg_profiles中未存在对应的role与profile关系
            构造系统表tuple，[roloid=roloid, rolname=username, profile=profilename]
            将tuple插入至系统表
        5. 如果系统表pg_profiles中已存在对应的role与profile关系
            则更新tuple中的profile
    ```

### 四、使用PROFILE参数流程

首先，需要统计哪些场景中会使用到相关GUC

-   场景一：用户建立连接  
    在该场景中，可能使用到4个GUC参数

    ```python
    # 此处以未开启线程池为例
    PostgresMain
        # 第一阶段：接受用户的密码，并进行一系列检查
        InitBackendWorker
            InitSession
                CheckAuthentication
                    PerformAuthentication
                        port->protocol_config->fn_authenticate
                            ClientAuthentication
                                # 1. 从pg_hba.conf中，读取password校验方式
                                hba_getauthmethod
                                sendAuthRequest
                                # 2. 接收客户端的password，检查password是否正确
                                recv_and_check_password_packet
                                    crypt_verify
                                # 3. 从系统表pg_user_status中，获取rolstatus字段，判断用户是否被锁
                                GetAccountLockedStatus
                                    SearchSysCache1('pg_user_status')
                                # 4. 无论密码正确与否，更新与锁定账号相关的参数
                                if role is lock or unlock:
                                    TryUnlockAccount
                                        GetPasswordTimeOfTuple
                                            transform 'password_lock_time'
                                        UpdateUnlockAccountTuples
                                # 5. 如果密码失败次数较多，锁定账户
                                if passwrong:
                                    if master:
                                        TryLockAccount
                                            if > 'failed_login_attempts'
                                                tableam_tops_modify_tuple('pg_user_status')
                                    elif standby:
                                        UpdateFailCountToHashTable
                                        if > 'failed_login_attempts'
                                            lock
        # 6. 如果密码正确，检查密码有效期（仅vastbase有此函数）
        checkPasswordEffect
            getLeftEffectSpan
                transform 'password_effect_time'
            if leftday < 0:
                'ERROR: password expired'

        # 第二阶段：循环接收用户的其他数据，比如SQL语句
        for (;;)
            ReadCommand
                # 此处，每接收一条客户端的消息，都会检查一次 session_timeout
                # 如果开启profile，此处需要缓存该用户的profile idle_time参数，否则，每次都从profile系统表中读取，对性能影响较大
                # 理论上，如果无用户更新profile idle_time参数，一个连接缓存一次即可，即一个连接仅需读取一次系统表
                if > 'session_timeout':
                    'ERROR: timeout'
            exec_simple_query('SQL')
    ```

-   场景二、用户执行DDL  
    在该场景中，可能使用到2个GUC参数

    ```python
    exec_simple_query('CREATE USER ..')
        ...
            CreateRole
                AddAuthHistory
                    transform 'password_reuse_time'
                    systable_beginscan('pg_auth_history')
                    if password > 'password_reuse_time' or 'password_reuse_max':
                        ok
    exec_simple_query('ALTER USER ..')
        AlterRole
            AddAuthHistory
    ```

在所有使用guc参数的地方，均能获取到当前登录用户的oid。接下来，只需在代码中，所有使用guc参数的地方，判断使用guc的值，还是profile中配置的值即可。  
以’Failed_login_attempts’参数为例，使用guc参数的代码将修改为：

-   旧代码

    ```c
    void TryLockAccount()
    {
        ...

        if (u_sess->attr.attr_security.Failed_login_attempts > 0 &&
            failedcount >= u_sess->attr.attr_security.Failed_login_attempts) {
            ..
        }
        ..
    }
    ```

-   新代码

    ```c
    void TryLockAccount()
    {
        ...

        ProfileVal setting = get_setting_from_guc_or_profile(PT_FAILED_LOGIN_ATTEMPTS);
        if (setting.intval > 0 &&
            failedcount >= setting.intval) {
            ..
        }
        ..
    }

    ProfileVal get_setting_from_guc_or_profile(ProfileType type)
    {
        ProfileVal setting = {0};

        if (!resource_limit) { /* 如果未开启profile功能，则使用guc参数 */
            setting.intval = u_sess->attr.attr_security.Failed_login_attempts;
        } else { /* 如果未开启profile功能 */
            roloid = GetCurrentUser();
            /* 首先，从系统表pg_profiles中，查找用户使用的profile */
            profile = catalog_find_user_profile(roloid);
            /* 然后，从系统表pg_profile_settings中，查找profile中具体的配置项的值 */
            tuple = catalog_find_profile_setting(profile, type);

            setting.intval = tuple.setval;
        }

        return setting;
    }

    typedef union {
        int intval;
        double realval;
        char *strval;
    } ProfileVal;

    typedef enum {
        PT_FAILED_LOGIN_ATTEMPTS,
        PT_PASSWORD_LIFE_TIME,
        PT_PASSWORD_GRACE_TIME,
        PT_PASSWORD_REUSE_TIME,
        PT_PASSWORD_REUSE_MAX,
        PT_PASSWORD_REUSE_TIME,
        PT_IDLE_TIME
    } ProfileType;
    ```

## 1.3 接口说明

本特性变更的参数如下，参数的具体说明请看上一章：

1.  新增GUC参数：resource_limit
2.  修改6个GUC参数的生效条件：[failed_login_attempts, password_lock_time, password_effect_time, password_reuse_time, password_reuse_max, session_timeout]
3.  新增3个PROFILE的SQL语法：

    ```sql
    CREATE PROFILE profilename LIMIT {setting_name {setting_value | UNLIMITED} ...}
    ALTER PROFILE profilename  LIMIT [setting_name {setting_value | UNLIMITED} ...]
    DROP PROFILE [IF EXISTS] profilename [, profilename, ...]
    ```

4.  扩展2个SQL语法

    ```sql
    CREATE USER ... [PROFILE profilename] ...
    ALTER USER ... [PROFILE profilename] ...
    ```

5.  新增系统表 vb_user_profiles
6.  新增系统表 vb_profiles
7.  修改系统表 pg_dependcy
8.  新增系统视图 dba_profiles
9.  修改系统视图 DBA_USERS：原来profile列的值都为空，现在不为空
10.  影响系统视图 USER_USERS 与 ALL_USERS的查询结果：原来profile列的值都为空，现在不为空

## 1.4 内存管理

本特性主要占用的内存如下：

-   LocalBuffer：如果开启profile功能，需要缓存pg_profiles与pg_profile_settings系统表中的数据。大部分场景中，缓存大小数据量级为几十k。

其他内存占用几乎可忽略。

## 1.5 安全

-   访问控制：在处理CREATE PROFILE, ALTER PROFILE, DROP PROFILE语法时，需判断用户是否具有CreateRole权限。
    -   备注：CreateRole是一个控制范围较大的权限，CREATE USER, ALTER USER, DROP USER等均由CreateRole这一个权限控制。
-   安全审计：在处理CREATE PROFILE, ALTER PROFILE, DROP PROFILE语法时，适配统一审计特性。

## 1.6 性能

本特性仅影响建立连接的过程，不影响数据库处理SQL的性能。

## 1.7 专利

不涉及

## 1.8 升级管理

| 部署类型 | 行为说明 |
| --- | --- |
| 新安装 | 新增1个guc resource_limit=on, 无效6个guc [failed_login_attempts, password_lock_time, password_effect_time, password_reuse_time, password_reuse_max, session_timeout]，新增5个PROFILE语法，新增2个系统表[pg_profiles，pg_profile_settings]，新增1行系统表行pg_dependcy，新增1个视图dba_profiles，修改3个视图[dba_users, user_users, all_users] |
| 升级前 | 无变化 |
| 升级时 | 设置resource_limit=off |
| 升级后 | 新增1个guc resource_limit=on, 无效6个guc [failed_login_attempts, password_lock_time, password_effect_time, password_reuse_time, password_reuse_max, session_timeout]，新增5个PROFILE语法，新增2个系统表[pg_profiles，pg_profile_settings]，新增1行系统表行pg_dependcy，新增1个视图dba_profiles，修改3个视图[dba_users, user_users, all_users] |
| 升级失败 | 删除新增guc，SQL语法，系统表，视图，还原变更的视图 |

## 1.9 其他说明

无

1.  用户与数据库建立连接
2.  查询profile系统表，将用户的profile配置，缓存在u_sess中
3.  检查用户密码有效期、检查session_timoue等时
