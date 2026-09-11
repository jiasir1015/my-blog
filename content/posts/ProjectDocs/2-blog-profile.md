+++
title = '海量 2 博客 profile'
date = '2025-05-22T10:00:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['身份认证']
weight = 200
ShowToc = true
TocOpen = true
+++
> 摘要：本文主要分为3个章节：
>
> 1.  介绍Vastbase基于密码的身份认证机制，介绍密码相关配置参数，指出当前控制参数的局限性，提出PROFILE功能支持细粒度设置密码相关配置参数。
> 2.  介绍Vastbase的PROFILE功能如何使用，包括管理PROFILE功能、管理PROFILE参数、管理用户PROFILE
> 3.  介绍Vastbase身份认证流程与原理，介绍PROFILE功能的实现原理

**目录**  

1.  [1 PROFILE 功能背景](#1-PROFILE-%E5%8A%9F%E8%83%BD%E8%83%8C%E6%99%AF)
    1.  [1.1 身份认证机制](#1-1-%E8%BA%AB%E4%BB%BD%E8%AE%A4%E8%AF%81%E6%9C%BA%E5%88%B6)
    2.  [1.2 身份认证配置](#1-2-%E8%BA%AB%E4%BB%BD%E8%AE%A4%E8%AF%81%E9%85%8D%E7%BD%AE)
    3.  [1.3 身份认证优化](#1-3-%E8%BA%AB%E4%BB%BD%E8%AE%A4%E8%AF%81%E4%BC%98%E5%8C%96)
2.  [2 PROFILE 功能使用](#2-PROFILE-%E5%8A%9F%E8%83%BD%E4%BD%BF%E7%94%A8)
    1.  [2.1 PROFILE 简单示例](#2-1-PROFILE-%E7%AE%80%E5%8D%95%E7%A4%BA%E4%BE%8B)
    2.  [2.2 管理 PROFILE 功能](#2-2-%E7%AE%A1%E7%90%86-PROFILE-%E5%8A%9F%E8%83%BD)
    3.  [2.3 管理 PROFILE 参数](#2-3-%E7%AE%A1%E7%90%86-PROFILE-%E5%8F%82%E6%95%B0)
    4.  [2.4 管理 用户 PROFILE](#2-4-%E7%AE%A1%E7%90%86-%E7%94%A8%E6%88%B7-PROFILE)
3.  [3 PROFILE 功能原理](#3-PROFILE-%E5%8A%9F%E8%83%BD%E5%8E%9F%E7%90%86)
    1.  [3.1 身份认证元数据](#3-1-%E8%BA%AB%E4%BB%BD%E8%AE%A4%E8%AF%81%E5%85%83%E6%95%B0%E6%8D%AE)
    2.  [3.2 身份认证流程](#3-2-%E8%BA%AB%E4%BB%BD%E8%AE%A4%E8%AF%81%E6%B5%81%E7%A8%8B)

# 1 PROFILE 功能背景

## 1.1 身份认证机制

Vastbase身份认证模块，主要采用基于密码的认证机制，常用的密码操作包括：

1.  创建密码  
    创建新用户时，需指定密码。语法示例如下：

    ```sql
    CREATE USER u1 PASSWORD 'u1.password';
    ```

    Vastbase接收密码后，计算密码的哈希值，并将密码哈希值、密码创建时间等存储至系统表中。
2.  使用密码  
    用户连接Vastbase时，需提供密码，使用vsql连接的命令如下：

    ```sql
    vsql -h {host} -p {port} -U u1 -W 'u1.password' -d vastbase -r
    ```

    Vastbase会与vsql进行身份认证交互，基于存储的密码哈希值，校验密码是否正确。同时，Vastbase还会进行其他检查，比如：密码是否过期、密码错误次数是否过多等。
3.  修改密码  
    用户修改密码时，语法示例如下：

    ```sql
    ALTER USER u1 PASSWORD 'u1.newpass';
    ```

    vastbsae出于安全考虑，会检查新密码是否已曾用过的旧密码相同。

## 1.2 身份认证配置

Vastbase会校验、检查密码，包括密码过期、密码复用等场景。在校验前，用户可配置校验、检查参数。在3.0.8.1版本前的Vastbase中，相关参数由GUC控制。

1.  查询相关GUC的命令如下：

    ```sql
    SELECT name, setting, unit, short_desc, min_val, max_val, boot_val
    FROM pg_settings
    WHERE name in ('password_effect_time', 'failed_login_attempts', 'password_lock_time', 'password_reuse_time', 'password_reuse_max');
    ```

2.  相关GUC的功能与取值如下：

    | 编号 | GUC参数 | 参数功能 | 取值范围 | 默认值 | 单位 |
    | --- | --- | --- | --- | --- | --- |
    | 1 | password_effect_time | 使用密码时，检查密码创建时间，控制密码有效期 | [30, 36500] | 36500 | 天 |
    | 2 | failed_login_attempts | 使用密码时，控制密码错误次数阈值，如果次数达到阈值，则账号会被暂时锁定 | [1,1000] | 5 | 次 |
    | 3 | password_lock_time | 使用密码时，如果密码错误次数达到阈值，控制账号锁定时间 | [1, 525600] | 1440 | 分钟 |
    | 4 | password_reuse_time | 修改密码时，如果新密码与曾使用过的旧密码相同，控制不能与近期使用过的相同 | [30, 90] | 30 | 天 |
    | 5 | password_reuser_max | 修改密码时，如果新密码与曾使用过的旧密码相同，控制不能与最近几次使用过的相同 | [1, 100] | 3 | 次 |

## 1.3 身份认证优化

-   身份认证问题：  
    上述5个GUC参数，对所有用户生效，即所有用户使用相同的配置参数。但是，一个集群，存在多个用户，每个用户角色不同，有高权限的系统管理员，有低权限的普通用户，不同用户的密码有效期、密码错误阈值等，要求也应不同。通过GUC参数，控制粒度较粗，无法详细为不同用户设置不用的配置参数。

-   身份认证优化：  
    3.0.8.1版本Vastbase，在身份认证模块，主要针对配置方式进行了优化。PROFILE功能，解决相关配置参数控制粒度粗的问题。  
    PROFILE功能，支持为不用的用户，设置不同的配置参数，以实现细粒度控制。包括密码有效期、密码错误次数阈值等在内的参数，默认情况下，不再由GUC参数password_effect_time、failed_login_attempts等控制，而是由同名或名称接近的PROFILE参数控制，不用用户可设置不用的PROFILE参数。

-   Oracle兼容性：  
    Oracle 8版本开始支持PROFILE特性，为保证兼容性，提高易用性，Vastbase的PROFILE特性，在参数名称、参数功能、参数取值范围、参数单位、参数配置范围等，将与Oracle一致。  
    Oracle 23版本支持18个PROFILE参数，分为密码管理、资源管理类。Vastbase支持7个PROFILE参数，主要是密码管理类。

注意：在Oracle兼容性下，才可使用PROFILE功能。

# 2 PROFILE 功能使用

## 2.1 PROFILE 简单示例

首先，以一个简单的例子，简单介绍PROFILE的使用方法。

1.  假设，需创建用户u1，该用户的密码有效期为10天，密码错误次数阈值为3次。
2.  创建PROFILE，可理解为创建配置组，创建时可同时设置参数值。

    ```sql
    CREATE PROFILE pro1 LIMIT password_effect_time 10 failed_login_attempts 3;
    ```

3.  创建用户，并为用户设置PROFILE，即设置配置组。

    ```sql
    CREATE USER u1 PASSWORD 'u1.password' PROFILE pro1;
    ```

4.  用户u1的密码有效期、密码错误次数阈值等，将不再有GUC参数控制，而是由PROFILE参数控制，PROFILE参数存储于系统表中。

Vastbase PROFILE功能的使用方法，与Oracle基本一致。

## 2.2 管理 PROFILE 功能

PROFILE功能是否开启，由GUC参数resource_limit控制。  
resource_limit取值为on，表示开启PROFILE功能，开启PROFILE功能后，以下5个GUC参数，将不再生效，而是由PROFILE参数代替，PROFILE参数存储于系统表中：

1.  password_effect_time
2.  failed_login_attempts
3.  password_lock_time
4.  password_reuse_time
5.  password_reuse_max

另外，身份认证成功的用户，用户会话超时时间，也不再由GUC参数session_timeout控制，由PROFILE参数代替。

对于新安装的3.0.8.1及之后版本的Vastbase集群，如果是Oracle兼容性，resource_limit默认值为on，即默认开启PROFILE功能，并替代6个GUC参数。  
对于已存在的3.0.8.1之前的Vastbase集群，升级至3.0.8.1时，resource_limit默认值为off，即升级场景不会修改数据库行为，不会导致6个GUC参数失效。

用户可手动设置GUC参数resource_limit的值为on或off，以开启或关闭PRIFILE功能。resource_limit为Postmaster级别的GUC参数，设置后，需重启集群，才能生效。

## 2.3 管理 PROFILE 参数

PROFILE功能新增3个语法，支持创建、修改、删除PROFILE，语法格式如下：

```sql
-- 创建
CREATE PROFILE profile_name [ LIMIT {setting_name setting_value ...} ]
-- 修改
ALTER PROFILE profile_name LIMIT {setting_name setting_value ...}
-- 删除
DROP PROFILE [IF EXISTS] profile_name [, profile_name, ...]
```

其中，setting_name表示PROFILE配置参数，目前支持7个参数：

| PROFILE配置名 | 被替代的GUC配置名 | 功能 |
| --- | --- | --- |
| password_life_time | password_effect_time | 无变化 |
| password_grace_time | - | 如果密码超过有效期，控制继续使用账号的宽容期 |
| failed_login_attempts | failed_login_attempts | 无变化 |
| password_lock_time | password_lock_time | 无变化 |
| password_reuse_time | password_reuse_time | 无变化 |
| password_reuse_max | password_reuse_max | 无变化 |
| idle_time | session_timeout | 无变化 |

与原GUC相比，上述参数的取值范围、参数单位等存在差异。

使用示例如下：

1.  创建PROFILE

    ```sql
    -- 创建PROFILE，参数均使用默认值
    CREATE PROFILE pro1;
    -- 创建PROFILE，同时设置参数值，可设置1个或多个参数，参数之间使用空格分隔。在pro2中，为主动设置的其他5个参数，均使用默认值
    CREATE PROFILE pro2 LIMIT password_life_time 30 failed_login_attempts 3;
    -- 参数取值可设置为 unlimited，即对相关功能不做限制。例如将password_life_time设置为unlimited，表示密码永远不会过期
    CREATE PROFILE pro3 LIMIT password_life_time unlimited;
    ```

2.  查询PROFILE

    ```sql
    -- 所有PROFILE均存储于系统表中
    SELECT * FROM vb_profiles;
    ```

    安装集群时，Vastbase内置1个名为default的PROFILE，该PROFILE中7个参数取值均为unlimited。查询vb_profiles的结果如下：

    ```sql
    profile  |   setname             |   setval  | valunit | valtype  | valmin  | valmax     | valdefault | setkind     -- unlimited含义
    ---------+-----------------------+-----------+---------+--------------------+------------+------------+----------
    default  | failed_login_attempts | unlimited | times   | int      | 1       | 2147483646 | 10         | password    -- 等价INT_MAX，允许无限次登录失败
    default  | password_lock_time    | unlimited | days    | double   | 0.00001 | 24855      | 1          | password    -- 等价0，账号永远不锁
    default  | password_life_time    | unlimited | days    | double   | 0.00001 | 24855      | 180        | password    -- 等价DBL_MAX，密码永远有效
    default  | password_grace_time   | unlimited | days    | double   | 0.00001 | 24855      | 7          | password    -- 等价DBL_MAX，密码过期也永远可用
    default  | password_reuse_time   | unlimited | days    | double   | 0.00001 | 24855      | 1          | password    -- 等价0，密码可无限复用
    default  | password_reuse_max    | unlimited | times   | int      | 1       | 2147483646 | 1          | password    -- 等价INT_MAX，密码可无限复用
    default  | idle_time             | unlimited | minutes | double   | 0.00001 | 2147483646 | 10         | kernel      -- 等价INT_MAX，会话永远不过期
    -- 提示：0.00001 days约为0.8 second，24855 days约为70 years
    ```

    各列含义如下：

    | 列名 | 含义 |
    | --- | --- |
    | profile | PROFILE 名，可理解为配置组 |
    | setname | PROFILE 配置参数名 |
    | setval | 配置参数 实际值 |
    | valunit | 参数值 单位 |
    | valtype | 参数值 数据类型 |
    | valmin | 参数值 最小值 |
    | valmax | 参数值 最大值 |
    | valdefault | 参数值 默认值，执行CREATE PROFILE语法时，未主动设置值的配置参数，默认使用该列中的值 |
    | settype | 配置参数 分类 |

    另外，查询视图DBA_PROFILES的结果，与查询系统表vb_profiles效果接近。

    ```sql
    SELECT * FROM DBA_PROFILES;
    ```

3.  修改PROFILE

    ```sql
    -- 修改PROFILE，可修改1个或多个参数，参数之间使用空格分隔
    ALTER PROFILE pro1 LIMIT password_life_time 100 password_reuse_max unlimited;
    ```

4.  删除PROFILE

    ```sql
    DROP PROFILE pro1;
    -- 删除PROFILE，一次可删除多个
    DROP PROFILE IF EXISTS pro1,pro2,pro3;
    -- 注意：Vastbase内置的名为default的PROFILE不能被删除
    ```

## 2.4 管理 用户 PROFILE

PROFILE功能支持为不同用户设置、修改不同的PROFILE，即不同的配置组。设置语法如下：

```sql
-- 创建用户时，为用户设置PROFILE
CREATE USER user_name PASSWORD password [ PROFILE profile_name ]
-- 对于已存在的用户，修改用户PROFILE
ALTER USER user_name [ PROFILE profile_name ]
```

如果未主动为用户设置PROFILE，则用户默认使用名为default的PROFILE。

使用示例如下：

1.  设置用户PROFILE

    ```sql
    -- 前提：请确保已通过 CREATE PROFILE 语法设置对应的PROFILE

    CREATE USER u1 PASSWORD 'u1.password' PROFILE pro1;
    ```

2.  查询用户PROFILE

    ```sql
    SELECT * FROM vb_user_profiles WHERE rolname = 'u1';
    ```

    查询结果示例如下：

    ```sql
     roloid | rolname | profile
    --------+---------+---------
      28214 | u1      | pro1
    ```

3.  修改用户PROFILE

    ```sql
    -- 前提：请确保已通过 CREATE PROFILE 语法设置对应的PROFILE

    ALTER USER u1 PROFILE pro2;
    ```

# 3 PROFILE 功能原理

## 3.1 身份认证元数据

1.  系统表pg_authid  
    创建用户时，Vastbase会为用户分配唯一的用户id，并在系统表pg_authid中，记录用户名、用户id、密码哈希值等信息。

    ```sql
    CREATE USER u1 PASSWORD 'u1.password';

    SELECT rolname,oid,rolpassword FROM pg_authid WHERE rolname = 'u1';
    -- 示例输出：
     rolname | oid   |   rolpassword
    ---------+-------+----------------------------
     u1     | 28214 | sha25684899a888d999b97...
    ```

2.  系统表pg_user_status  
    创建用户时，Vastbase会在系统表pg_user_status中，初始话密码失败次数、密码锁定状态、密码锁定时间等信息。  
    登录用户时，如果密码错误，Vastbase会更新系统表中密码失败次数等信息，并校验是否达到锁定条件。

    ```sql
    SELECT roloid,failcount,rolstatus，locktime FROM pg_user_status WHERE roloid = 28214;
    -- 示例输出：
     roloid | failcount | rolstatus | locktime
    --------+-----------+-----------+--------------------------
     28214  | 0         | 0         | 2025-05-01 10:40:41....
    ```

3.  系统表pg_auth_history  
    修改密码时，Vastbase会在系统表pg_auth_history中，记录所有曾用过的密码

    ```sql
    ALTER USER u1 PASSWORD 'u1.newpass';

    SELECT roloid,passwordtime,rolpassword FROM pg_auth_history WHERE roloid = 28214;
    -- 示例输出：
     roloid | passwordtime            | rolpassword
    --------+-------------------------+------------------------------
     28214  | 2025-05-01 10:40:41.... | sha25684899a888d999b97...
     28214  | 2025-05-08 13:25:07.... | sha256b019838a88f989c8...
    ```

## 3.2 身份认证流程

未开启PROFILE功能的场景下，身份认证的简要流程如下图所示：（途中系统表1、2、3分别代表pg_authid、pg_user_status、pg_auth_history。）

![auth](/images/ProjectDocs/2-blog-profile/auth.png)

开启PROFILE功能的场景下，上述流程中，第8步将不再从GUC中获取密码相关参数，而是替换为以下2步：

1.  根据用户id，从系统表vb_user_profiles中，查找用户使用的PROFILE。
2.  从系统表vb_profiles中，查找指定PROFILE的7个配置参数，并缓存
