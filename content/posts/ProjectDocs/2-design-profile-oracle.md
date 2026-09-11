+++
title = '海量 2 设计 oracle profile'
date = '2025-02-20T19:24:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['Oracle', '身份认证', '设计文档']
weight = 200
ShowToc = true
TocOpen = true
+++
# 2

代码  
新增试图

```sql
SELECT * FROM pg_user_settings;
-- 新增视图 pg_user_settings

SELECT rolname,profile FROM pg_authid WHERE rolcanlogin = true
    LEFT JOIN  vb_profile ON

rolname |  setname              | setting  | settype | settype     | setsource
--------+-----------------------+----------+---------+-------------+----------------
    u1     | password_effect_time  | 90       | int     | profile guc | pro1
                                                        | cluster guc | postgresql.conf
```

#### 参数1: failed_login_attempts

```python
# opegauss使用1个内存中的hash表，存储密码失败次数
ClientAuthentication
    # 进行身份认证时，如果认证失败，则更新hash表中的失败次数值
    UpdateFailCountToHashTable
        InitAccountLockHashTable
        hash_search
        # 如果失败次数超过GUC限制，则锁定账户
        if failed_login_attempts：
            lockflag = True
```

#### 参数2: password_lock_time

#### 参数3: password_effect_time

```python
# 通过内置函数，主动查看密码剩余天数
gs_password_deadline
    GetCurrentUserId # 1 获取当前用户
    GetUserCurrentPwdtime # 2 从系统表pg_auth_history中，获取密码创建时间passwordtime
        heap_open('pg_auth_history')
        systable_beginscan
    floor(u_sess->attr.attr_security.Password_effect_time) # 3 从guc参数password_effect_time中获取密码有效天数
    # 计算步骤2和3中的时间，返回剩余过期天数
```

#### 参数4: password_reuse_max

```python
AddAuthHistory
    systable_beginscan('pg_auth_history') # 1 从系统表pg_auth_history中，获取曾用过的密码rolpassword，获取生成密码的时间passwordtime
    systable_getnext_back # 倒着从系统表扫描，即先扫描不太古老的旧密码，再扫描更古老的旧密码

    pg_sha256_encrypt # 使用旧密码的salt，加密新密码
    if strncmp : # 比较新密码是否与旧密码相等
        hasSame = True

    # 如果新旧密码相等，计算新旧密码间隔天数，与GUC参数password_reuse_time比较，判断是否满足密码重用时间限制
    if now - pg_auth_history.passwordtime > 'password_reuse_time'：
        isTimeSafe = True

    # 计算这是倒数第几个密码
    changeTimes++
    if changeTimes > 'password_reuse_max':
        isMaxSafe

    # 满足 password_reuse_time 和 password_reuse_max 中任意一个条件，都可以修改密码
    # - 要么用好几次之前的密码（满足 password_reuse_max 条件）
    # - 要么用很旧之间使用的密码（满足 password_reuse_time 条件）
    if hasSame and not isTimeSafe and not isMaxSafe:
        # 报错
```

#### 参数5: password_reuse_time
