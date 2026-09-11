+++
title = '海量 2 用例 profile'
date = '2025-03-14T16:14:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['身份认证', '测试用例']
weight = 200
ShowToc = true
TocOpen = true
+++
1.  [1 CREATE/ALTER/DROP PROFILE](#1-CREATE-x2F-ALTER-x2F-DROP-PROFILE)
2.  [2 CREATE/ALTER USER .. PROFILE](#2-CREATE-x2F-ALTER-USER-PROFILE)
3.  [3 验证profile生效](#3-%E9%AA%8C%E8%AF%81profile%E7%94%9F%E6%95%88)
    1.  [验证 failed_login_attempts 与 password_lock_time](#%E9%AA%8C%E8%AF%81-failed-login-attempts-%E4%B8%8E-password-lock-time)
    2.  [验证 password_life_time 与 password_grace_time](#%E9%AA%8C%E8%AF%81-password-life-time-%E4%B8%8E-password-grace-time)
    3.  [验证 password_reuse_time 和 password_reuse_max](#%E9%AA%8C%E8%AF%81-password-reuse-time-%E5%92%8C-password-reuse-max)
    4.  [验证 idle_time](#%E9%AA%8C%E8%AF%81-idle-time)
4.  [3 view](#3-view)

```sql
CREATE PROFILE pro1 limit password_reuse_time 0.00002 password_reuse_max 10; -- 1.72s
CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1;
ALTER USER u1 PASSWORD 'u1.pass2';
ALTER USER u1 PASSWORD 'u1.pass1'; -- error, interval < password_reuse_time
\! sleep 2
ALTER USER u1 PASSWORD 'u1.pass1'; -- succeed, interval > password_reuse_time

ALTER PROFILE pro1 LIMIT password_reuse_time 0.00005; -- 4.32s
ALTER USER u1 PASSWORD 'u1.pass3';
ALTER USER u1 PASSWORD 'u1.pass4';
ALTER USER u1 PASSWORD 'u1.pass3'; -- error, interval < password_reuse_time
\! sleep 5
ALTER USER u1 PASSWORD 'u1.pass3'; -- succeed, interval > password_reuse_time

```

# 1 CREATE/ALTER/DROP PROFILE

```sql
-- check profile feature
SHOW resource_limit;

-- ================================ part 1 ================================
--                              create profile
CREATE PROFILE pro1;
-- succeed: can set setting
CREATE PROFILE pro2 LIMIT failed_login_attempts 10;
-- succeed: can set more settings
CREATE PROFILE pro3 LIMIT
    failed_login_attempts 10 password_lock_time 20
    password_life_time 30   password_grace_time 40
    password_reuse_time 50 password_reuse_max 60
    idle_time 80;
-- succeed: repeated settings are allowed
CREATE PROFILE pro4 LIMIT password_life_time 10 password_life_time 20.2;
-- succeed: setting value could be 'unlimited'
CREATE PROFILE pro5 LIMIT failed_login_attempts unlimited password_lock_time 10 password_life_time unlimited;

-- succeed: name max len is 64, name will be truncated
CREATE PROFILE aaaaa111111111122222222223333333333444444444455555555556666666666; -- too long, max 64, wi
-- truncated name: aaaaa1111111111222222222233333333334444444444555555555566666666

SELECT profile,count(*) FROM vb_profiles GROUP BY profile ORDER BY profile;
SELECT * FROM vb_profiles WHERE profile = 'pro5' ORDER BY setname;

-- error: profile name is invalid
CREATE PROFILE 1; -- int
CREATE PROFILE 1.1; -- numeric

-- error: profile already exists
CREATE PROFILE default LIMIT failed_login_attempts 10;
CREATE PROFILE pro1 LIMIT failed_login_attempts 10;

/*
error: setting is invalid, supported settings:
                              unit      type        min         max
    ------------------------+---------+----------+---------+------------+----
    failed_login_attempts   | times   | int      | 1       | 2147483646 | 10
    password_lock_time      | days    | double   | 0.00001 | 24855      | 1
    password_life_time      | days    | double   | 0.00001 | 24855      | 180
    password_grace_time     | days    | double   | 0.00001 | 24855      | 7
    password_reuse_time     | days    | double   | 0.00001 | 24855      | 1
    password_reuse_max      | times   | int      | 1       | 2147483646 | 1
    idle_time               | minutes | double   | 0.00001 | 2147483646 | 10
*/
CREATE PROFILE epro2 LIMIT data_directory anyvalue;
CREATE PROFILE epro3 LIMIT password_effect_time 10;
CREATE PROFILE epro4 LIMIT 10 failed_login_attempts;

-- error: setting lose value
CREATE PROFILE epro5 LIMIT failed_login_attempts;
CREATE PROFILE epro6 LIMIT failed_login_attempts 10 password_lock_time;

-- error: setting value type is invalud
CREATE PROFILE epro7 LIMIT failed_login_attempts 'iamstring';
CREATE PROFILE epro8 LIMIT failed_login_attempts 1.1;
CREATE PROFILE epro9 LIMIT failed_login_attempts noint;
CREATE PROFILE epro10 LIMIT failed_login_attempts default;

-- error: setting value is out of limit
CREATE PROFILE epro11 LIMIT failed_login_attempts 0;
CREATE PROFILE epro12 LIMIT failed_login_attempts 1 password_lock_time 0;
CREATE PROFILE epro13 LIMIT password_lock_time 24856;
CREATE PROFILE epro14 LIMIT password_lock_time 0.000001;

SELECT profile,count(*) FROM vb_profiles GROUP BY profile ORDER BY profile;

DROP PROFILE pro1, pro2, pro3, pro4, pro5;
DROP PROFILE aaaaa111111111122222222223333333333444444444455555555556666666666;

-- ================================ part 2 ================================
--                              alter profile
CREATE PROFILE pro1;
CREATE PROFILE pro2 LIMIT failed_login_attempts 100;
CREATE PROFILE pro3 LIMIT password_lock_time 20;

-- succeed: can set setting
ALTER PROFILE pro1 LIMIT failed_login_attempts 1000;
-- succeed: can set more settings
ALTER PROFILE pro2 LIMIT
    failed_login_attempts 10 password_lock_time 20
    password_life_time 30   password_grace_time 40
    password_reuse_time 50 password_reuse_max 60
    idle_time 80;
-- succeed: setting value could be 'unlimited'
ALTER PROFILE pro3 LIMIT failed_login_attempts unlimited password_lock_time 10 password_life_time unlimited;
-- succeed: can alter default profile
ALTER PROFILE default LIMIT failed_login_attempts 80 password_reuse_time 70.3;
SELECT * FROM vb_profiles ORDER BY profile,setname;

-- error: profile name is invalid
ALTER PROFILE 1 LIMIT failed_login_attempts 10; -- int
ALTER PROFILE 1.1 LIMIT failed_login_attempts 10; -- numeric
ALTER PROFILE aaaaa111111111122222222223333333333444444444455555555556666666666 LIMIT failed_login_attempts 10; -- too long, max 64

-- error: repeated settings are not allowed
ALTER PROFILE pro3 LIMIT password_reuse_time 10 password_reuse_time 20.2;

-- error: profile doesn't exist
ALTER PROFILE epro1 LIMIT failed_login_attempts 10;
ALTER PROFILE epro2 LIMIT failed_login_attempts 10;

/*
error: setting is invalid
*/
ALTER PROFILE pro1 LIMIT data_directory anyvalue;
ALTER PROFILE pro1 LIMIT password_effect_time 10;
ALTER PROFILE pro1 LIMIT 10 failed_login_attempts;

-- error: setting lose value
ALTER PROFILE pro1 LIMIT failed_login_attempts;
ALTER PROFILE pro1 LIMIT failed_login_attempts 10 password_lock_time;

-- error: setting value type is invalud
ALTER PROFILE pro1 LIMIT failed_login_attempts 'iamstring';
ALTER PROFILE pro1 LIMIT failed_login_attempts 1.1;
ALTER PROFILE pro1 LIMIT failed_login_attempts noint;
ALTER PROFILE pro1 LIMIT failed_login_attempts default;

-- error: setting value is out of limit
ALTER PROFILE pro1 LIMIT failed_login_attempts 0;
ALTER PROFILE pro1 LIMIT failed_login_attempts 1 password_lock_time 0;
ALTER PROFILE pro1 LIMIT password_lock_time 24856;
ALTER PROFILE pro1 LIMIT password_lock_time 0.000001;

DROP PROFILE pro1, pro2, pro3;

-- ================================ part 3 ================================
--                              drop profile
CREATE PROFILE pro1;
CREATE PROFILE pro2 LIMIT failed_login_attempts 100;
CREATE PROFILE pro3 LIMIT password_lock_time 20;
CREATE PROFILE pro4;
CREATE PROFILE pro5;

-- succeed: drop profile
DROP PROFILE pro1;
DROP PROFILE IF EXISTS pro1;
DROP PROFILE IF EXISTS pro1, pro2, pro3;

SELECT profile,count(*) FROM vb_profiles GROUP BY profile;

-- error: profile doesn't exist
DROP PROFILE pro0;
DROP PROFILE pro1, pro4, pro5;

-- error: default profile can't be dropped
DROP PROFILE default;
DROP PROFILE pro4, default;

DROP PROFILE IF EXISTS pro4, pro5;
```

# 2 CREATE/ALTER USER .. PROFILE

```sql
-- ================================ part 4 ================================
--                             set profile for user
SELECT * FROM vb_user_profiles;

CREATE PROFILE pro1;
CREATE PROFILE pro2;

-- succeed: set profile for user
CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1;
CREATE USER u2 PASSWORD 'u2.pass1' PROFILE pro1;
CREATE USER u3 PASSWORD 'u3.pass1' PROFILE default;
CREATE USER u4 PASSWORD 'u4.pass1';

-- error: profile doesn't exist
CREATE USER eu1 PASSWORD 'u4.pass1' PROFILE pro1000;

-- error: profile name invalid
CREATE USER eu2 PASSWORD 'u4.pass1' PROFILE 1;
CREATE USER eu3 PASSWORD 'u4.pass1' PROFILE;

SELECT * FROM vb_user_profiles;

DROP USER IF EXISTS u1, u2, u3, u4;
-- catalog also changed
SELECT * FROM vb_user_profiles;

DROP PROFILE IF EXISTS pro1, pro2;

-- ================================ part 5 ================================
--                              alter user profile
CREATE PROFILE pro1;
CREATE PROFILE pro2;
CREATE USER u1 PASSWORD 'u1.pass1';
CREATE USER u2 PASSWORD 'u2.pass1' PROFILE pro2;
CREATE USER u3 PASSWORD 'u3.pass1' PROFILE default;

-- succeed: alter user set profile
ALTER USER u1 PROFILE pro1;
ALTER USER u2 PROFILE default;
ALTER USER u3 PROFILE pro1;

-- error: profile doesn't exist
ALTER USER u1 PROFILE pro1000;

-- error: profile name invalid
ALTER USER u1 PROFILE 1;
ALTER USER u1 PROFILE;

SELECT * FROM vb_user_profiles ORDER BY roloid;

DROP USER IF EXISTS u1, u2, u3;
DROP PROFILE IF EXISTS pro1, pro2;

-- ================================ part 6 ================================
--                         drop user and profile
CREATE PROFILE pro1;
CREATE PROFILE pro2;
CREATE PROFILE pro3;
CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1;
CREATE USER u2 PASSWORD 'u2.pass1' PROFILE pro2;

-- succeed: drop user
SELECT * FROM vb_user_profiles WHERE rolname = 'u1';
DROP USER u1;
SELECT * FROM vb_user_profiles WHERE rolname = 'u1';

-- error: can't drop profile if any user are using it
DROP PROFILE pro2;

-- error: default profile can't be dropped
DROP PROFILE default;
DROP PROFILE pro3, default;
DROP PROFILE default, pro3;

SELECT * FROM vb_user_profiles ORDER BY roloid;

DROP USER IF EXISTS u1, u2;
DROP PROFILE IF EXISTS pro1, pro2, pro3;
```

# 3 验证profile生效

## 验证 failed_login_attempts 与 password_lock_time

```sql
CREATE PROFILE pro1 LIMIT
    failed_login_attempts 3
    password_lock_time 0.0001;
CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro1; -- 运行登录失败3次，失败后锁定8秒
CREATE USER u2 PASSWORD 'u2.pass1'; -- 允许登录失败无数次

vsql -p 5432 -d postgres -U u1 -W "u1.error1" -c "SELECT 1;"
vsql -p 5432 -d postgres -U u1 -W "u1.error1" -c "SELECT 1;"
vsql -p 5432 -d postgres -U u1 -W "u1.error1" -c "SELECT 1;"
vsql -p 5432 -d postgres -U u1 -W "u1.pass1" -c "SELECT 1;"
-- sleep 8s
vsql -p 5432 -d postgres -U u1 -W "u1.pass1" -c "SELECT 1;"

-- u2
vsql -p 5432 -d postgres -U u2 -W "u2.error1" -c "SELECT 1;"
vsql -p 5432 -d postgres -U u2 -W "u2.error1" -c "SELECT 1;"
vsql -p 5432 -d postgres -U u2 -W "u2.error1" -c "SELECT 1;"
vsql -p 5432 -d postgres -U u2 -W "u2.pass1" -c "SELECT 1;"
-- sleep 8s
vsql -p 5432 -d postgres -U u2 -W "u2.pass1" -c "SELECT 1;"

vsql -p 5432 -d postgres -c "DROP USER u1,u2"
```

## 验证 password_life_time 与 password_grace_time

```sql
CREATE PROFILE pro2 LIMIT
    password_life_time 0.0001  -- 8s
    password_grace_time 0.0001;

CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro2; -- 密码有效期为8s，密码宽容期也为8s
CREATE USER u2 PASSWORD 'u2.pass1'; -- 密码有效期无限制
\q

vsql -p 5432 -d postgres -U u1 -W "u1.pass1" -c "SELECT 1;"
-- sleep 8s
vsql -p 5432 -d postgres -U u1 -W "u1.pass1" -c "SELECT 1;"
-- sleep 8s
vsql -p 5432 -d postgres -U u1 -W "u1.pass1" -c "SELECT 1;"

vsql -p 5432 -d postgres -U u2 -W "u2.pass1" -c "SELECT 1;"
-- sleep 8s
vsql -p 5432 -d postgres -U u2 -W "u2.pass1" -c "SELECT 1;"
-- sleep 8s
vsql -p 5432 -d postgres -U u2 -W "u2.pass1" -c "SELECT 1;"
```

## 验证 password_reuse_time 和 password_reuse_max

```sql
CREATE PROFILE pro3 LIMIT
    password_reuse_time 0.0001 -- 不能用过去8秒使用过的密码
    password_reuse_max 100; -- 不能用过去100次使用过的

DROP USER IF EXISTS u1,u2;
CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro3;
ALTER USER u1 PASSWORD 'u1.pass2';

ALTER USER u1 PASSWORD 'u1.pass1';
SELECT pg_sleep(3);
ALTER USER u1 PASSWORD 'u1.pass1';
SELECT pg_sleep(3);
ALTER USER u1 PASSWORD 'u1.pass1';
SELECT pg_sleep(3);
ALTER USER u1 PASSWORD 'u1.pass1';

CREATE USER u2 PASSWORD 'u2.pass1';
ALTER USER u2 PASSWORD 'u2.pass2';
ALTER USER u2 PASSWORD 'u2.pass1';
ALTER USER u2 PASSWORD 'u2.pass2';
ALTER USER u2 PASSWORD 'u2.pass1';

-- -----------------------------

CREATE PROFILE pro4 LIMIT
    password_reuse_max 2 -- 不能用过去2次使用过的
    password_reuse_time 20;

DROP USER IF EXISTS u1,u2;

CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro4;
ALTER USER u1 PASSWORD 'u1.pass2';
ALTER USER u1 PASSWORD 'u1.pass3';
ALTER USER u1 PASSWORD 'u1.pass4';

ALTER USER u1 PASSWORD 'u1.pass3'; -- error
ALTER USER u1 PASSWORD 'u1.pass2'; -- ok
```

## 验证 idle_time

```sql
CREATE PROFILE pro5 LIMIT
    idle_time 0.1; -- 6s

DROP USER IF EXISTS u1,u2;

CREATE USER u1 PASSWORD 'u1.pass1' PROFILE pro5;
CREATE USER u2 PASSWORD 'u2.pass1';
\q

vsql -p 5432 -d postgres -U u1 -W "u1.pass1" -r
SELECT 1;
-- 不用pg_sleep
\! sleep 7
SELECT 1;
\q

vsql -p 5432 -d postgres -U u2 -W "u2.pass1" -r
SELECT 1;
-- 不用pg_sleep
\! sleep 7
SELECT 1;
```

# 3 view

```sql
CREATE OR REPLACE VIEW SYS.DBA_PROFILES AS
    SELECT
        profile "PROFILE",
        setname "RESOURCE_NAME",
        setkind "RESOURCE_TYPE",
        setval "LIMIT"
    FROM vb_profiles;
```

-   升级
-   审计
-   oid

```python
knl_u_misc_init
    AuthenticatedUserId = InvalidOid
ResetStreamStatus
    AuthenticatedUserId = InvalidOid
InitializeSessionUserId
    AuthenticatedUserId = SearchSysCache(rolname / useroid)
InitializeSessionUserIdStandalone
    AuthenticatedUserId = BOOTSTRAP_SUPERUSERID

SessionUserId
CurrentUserId

create_session_context
    # get_setting_from_guc_or_profile
    enable_session_sig_alarm
        # get_setting_from_guc_or_profile
ReadCommand
    # get_setting_from_guc_or_profile
    enable_session_sig_alarm
        # get_setting_from_guc_or_profile

disable_session_sig_alarm
TpoolSchedulerMain
    CheckSessionTimeout
        # get_setting_from_guc_or_profile
handle_sig_alarm
    CheckSessionTimeout
        # get_setting_from_guc_or_profile
WaitMission
    # get_setting_from_guc_or_profile
    enable_session_sig_alarm
```
