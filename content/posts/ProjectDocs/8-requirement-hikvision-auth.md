+++
title = '海量 8 需求 海康身份认证'
date = '2025-06-30T18:32:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['身份认证', '需求文档']
weight = 800
ShowToc = true
TocOpen = true
+++
本需求包含6个小需求：

1.  身份认证：创建用户：CREATE/SET USER .. PASSWORD ..，密码可以只设置2类字符
2.  身份认证：创建用户：CREATE/SET [角色] USER ..，角色支持指定SUPERUSER和NOSUPERUSER
3.  身份认证：查看用户：SELECT .. FROM pg_user，普通用户可查询pg_user视图（仅pg兼容性）
4.  身份认证：登录用户：SET ROLE new_user [PASSWORD ..]，new_user是会话用户时，可以不指定PASSWORD
5.  访问控制：Database权限：普通用户可访问template1数据库（仅pg兼容性）
6.  访问控制：Schema权限：普通用户可在public下执行CREATE操作（仅pg兼容性）

-   描述

1.  身份认证：创建用户  
    变更：用户密码可以只包含2类字符

    ```sql
    -- password_polcy取值不同，密码需包含的字符种类数不同，为1时需3类，需2时需4类，为3时需2类
    ALTER SYSTEM SET password_policy OT 3; -- 修改取值范围[0,2]为[0,3]
    CREATE USER u1 PASSWORD 'password1'; -- 此时，密码可以只含2类字符
    ALTER USER old_user PASSWORd 'password1';
    ```

2.  身份认证：创建用户  
    变更：可以指定SUPERUSER角色

    ```sql
    CREATE USER u1 SUPERUSER PASSWORD ..; -- 支持设置 SUPERUSER 角色
    ALTER USER u1 NOSUPERUSER ..; -- 支持取消 SUPERUSER 角色
    ALTER USER old_user SUPERUSER ..;
    ```

3.  身份认证：查看用户  
    变更：普通用户可查询pg_user视图（仅pg兼容性）

    ```sql
    vsql -d $database -U $ordinary_user ..
    SELECT * FROM pg_user; -- 普通用户可查询pg_user视图
    ```

4.  身份认证：登录用户  
    变更：3种场景下，SET ROLE无需再输密码（仅pg兼容性）
    -   约束（已有约束，本次未修改）：无论怎样，都不支持set role到superuser。set role到sysadmin可以。

        ```sql
        vsql -d $databse -U $session_user -W ..
        -- 切换用户
        SET ROLE $new_user [PASSWORD $password]
        ```

        非pg兼容性，必须输入password，无改动。pg兼容性，与postgresql保持一致，以下3种情况，切换到新用户时，无需输入密码：
    -   场景1: new_user = session_user

        ```sql
        vsql -d $databse -U u1 -W ..
        SET ROLE u2 PASSWORD 'u2.password';
        SET ROLE u1;
        ```

    -   场景2: new_user 给 session_user 赋权

        ```sql
        GRANT u2 TO u1;
        vsql -d $databse -U u1 -W ..
        SET ROLE u2;
        ```

    -   场景3: session_user是特权用户（未开启三权分立时，superuser和sysadmin；开启三权分立时，superuser）

        ```sql
        CREATE USER u1 SYSADMIN PASSWORD ..
        vsql -d $databse -U u1 -W ..
        SET ROLE u2;
        ```

5.  访问控制：Database权限  
    变更：普通用户可访问 template1 数据库(仅pg兼容性)

    ```sql
    vsql -d template1 -U $ordinary_user ..
    -- 普通用户能连接成功
    ```

6.  访问控制：Schema权限  
    变更：普通用户可在public模式下CREATE多种对象(仅pg兼容性)

    ```sql
    vsql -d template1 -U $ordinary_user ..
    SET search_path TO public;
    CREATE ...
    -- 普通用户可在public模式下CREATE多种对象，包括table, view, sequence, function, trigger等
    ```

# 一、set role current_user

-   把role当做1个user_set级guc
-   ```sql
    -- 1. 创建多个用户
    vsql -d postgres
    CREATE USER u1 PASSWORD 'u1.password';
    CREATE USER u2 PASSWORD 'u2.password';
    -- 2. 登录u1用户
    vsql -d postgres -U u1 -W 'u1.password'
    -- 3. set role为其他用户，需要密码
    SET ROLE u2 PASSWORD 'u2.password';
    SELECT CURRENT_USER;
    -- 4. set role为连接用户，无需密码
    SET ROLE u1;
    SELECT CURRENT_USER;

    -- 5. 清理
    DROP USER u1,u2;
    ```

```python
超级用户 -- 普通用户（父）  -- 普通用户
        -- 普通用户（子）
```

```sql
vsql -d postgres -U {session_user}
SET ROLE new_role

return is_member_of_role(session_user, new_role)
    -- session_user 是 super_user
    -- session_user == new_role
    -- session_user is member of ()

GRANT u1 TO u2; -- 给u2赋予权限
GRANT u1 TO u3;
-- u1: SET ROLE u2，无权限
-- u2: SET ROLE u1, 成功
-- u2: SET ROLE u3, 无权限

SELECT pg_get_userbyid(roleid),pg_get_userbyid(member) FROM pg_auth_members;

SELECT pg_get_userbyid(member) FROM pg_auth_members WHERE roleid = (SELECT oid FROM pg_authid WHERE rolname = 'u1');
-- 获取同组用户
SELECT pg_get_userbyid(m.member) FROM pg_auth_members m JOIN pg_authid a ON m.roleid = a.oid WHERE a.rolname = 'u1';
-- 获取可set role的用户（哪些用户给本用户赋权了）
SELECT pg_get_userbyid(roleid) can_setto FROM pg_auth_members WHERE member = (SELECT oid FROM pg_authid WHERE rolname = SESSION_USER);
```

```python
ExecSetVariableStmt
    case VAR_SET_ROLEPWD
        check_setrole_permisson
        verify_setrole_passwd
```

# 二、普通用户可查询pg_user视图

```sql
-- 1. 创建普通用户
vsql -d postgres -r
CREATE USER u1 PASSWORD 'u1.password';
-- 2. 登录普通用户
vsql -d postgres -r -U u1 -W 'u1.password'
-- 3. 查询pg_user视图
SELECT * FROM pg_user
-- 4. 清理
DROP USER u1;
```

# 三、创建密码时只需2种字符

password_policy取值

-   0: 不开启密码复杂度校验
-   1：开启密码复杂度校验：字符类型至少3类，密码不能与用户名相同，根据其他guc参数校验每类字符数、密码长度等
-   2：开启密码复杂度校验：字符类型至少4类，密码不能与用户名相同或接近，根据其他guc参数校验每类字符数、密码长度等
-   3：开启密码复杂度校验：字符类型至少2类，密码不能与用户名相同，根据其他guc参数校验每类字符数、密码长度等

```sql
SHOW password_policy;
ALTER SYSTEM SET password_policy TO 2;
-- 1. 创建普通用户
vsql -d postgres -r
CREATE USER u1 PASSWORD 'u1password';
-- 2. 登录普通用户
vsql -d postgres -r -U u1 -W 'u1.password'
-- 3. 清理
DROP USER u1;
```

# 四、支持superuser/nosuperuser与sysadmin/nosysadmin角色名

```sql
-- 1. 创建用户
CREATE USER u1 SUPERUSER PASSWORD 'u1.password';
CREATE USER u2 NOSUPERUSER PASSWORD 'u2.password';
-- pg不支持sysadmin
CREATE USER u3 SYSADMIN PASSWORD 'u3.password';
CREATE USER u4 NOSYSADMIN PASSWORD 'u4.password';
-- pg支持admin
CREATE USER u5 ADMIN u1 PASSWORD 'u5.password';

-- 2. 登录用户
-- 3. 清理用户
DROP USER IF EXISTS u1,u2,u3,u4,u5,u6;
```

# 五、普通用户有public create权限

-   function, procedure, table, sequence, index
-   vb有权限

    ```sql
    -- 1 高权限用户：创建普通用户
    CREATE USER u1 PASSWORD 'u1.password';
    -- 2 登录普通用户
    vsql -d postgres -U u1 -W 'u1.password' -r
    -- 3 创建对象
    CREATE DATABASE db1; -- 无权限
    CREATE SCHEMA sch1; -- 无权限
    CREATE TABLE t1(c1 INT);
    CREATE VIEW v1 AS SELECT * FROM t1;
    CREATE INDEX i1 ON t1(c1);
    CREATE SEQUENCE seq1;
    CREATE FUNCTION f1() RETURNS INT AS $$ SELECT count(*)::INT FROM t1 $$ LANGUAGE sql;
    -- CREATE PROCEDURE p1() LANGUAGE plpgsql AS $$ BEGIN INSERT INTO t1 VALUES (3); END; $$;
    CREATE PROCEDURE p1() IS BEGIN INSERT INTO t1 VALUES (3); END;
    /
    CREATE FUNCTION ft1() RETURNS TRIGGER AS $$ BEGIN SELECT count(*) FROM t1; RETURN NEW; END; $$ LANGUAGE plpgsql;
    -- vb不支持语法 EXECUTE PROCEDURE
    CREATE TRIGGER tri1 AFTER INSERT ON t1 FOR EACH ROW EXECUTE PROCEDURE ft1();
    CREATE TYPE typ1 AS ENUM('v1', 'v2');
    -- 4 清理对象
    DROP TABLE t1 CASCADE;
    DROP SEQUENCE seq1;
    DROP FUNCTION f1;
    DROP PROCEDURE p1;
    DROP FUNCTION ft1;
    DROP TYPE typ1;
    -- 5 清理用户
    RESET ROLE;
    DROP USER IF EXISTS u1;
    ```

# 六、普通用户登录template1数据库

```sql
-- 1 创建用户
CREATE USER u1 PASSWORD 'u1.password';
-- 2 登录用户
vsql -d template1 -U u1 -W 'u1.password'
-- 3 清理
DROP USER u1;
```

```sql
-- ---------------------------------------------------
--  1. auth: login user: support set role without password
-- ---------------------------------------------------
-- secen 1: set role to session_user, password is unnecessary
CREATE USER u1 PASSWORD 'u1.password';
CREATE USER u2 PASSWORD 'u2.password';
GRANT u2 TO u1;

SET SESSION AUTHORIZATION u1 PASSWORD 'u1.password';
SELECT session_user;
SELECT current_user;
SET ROLE u2 PASSWORD 'u2.password';
SET ROLE u1; -- no need password anymore

SET ROLE u2 PASSWORD 'u2.password';
SET ROLE u1 PASSWORD 'u1.password'; -- set password also ok

SET ROLE u2 PASSWORD 'u2.password';
SET ROLE u1 PASSWORD 'u1.wrong'; -- if set password, we will still check it

-- secen 2: if grant user permission, password is unnecessary
SET ROLE u1;
SET ROLE u2; -- no need password too

RESET SESSION AUTHORIZATION;
RESET ROLE;
DROP USER u1,u2;

-- secen 3: super user and sysadmin, set role to other user, password is unnecessary
CREATE USER u1 SUPERUSER PASSWORD 'u1.password';
CREATE USER u2 SYSADMIN PASSWORD 'u2.password';
CREATE USER u3 PASSWORD 'u3.password';

\! sleep 1
SET SESSION AUTHORIZATION u1 PASSWORD 'u1.password';
SET ROLE u3;
SET ROLE u2;

\! sleep 1
SET SESSION AUTHORIZATION u2 PASSWORD 'u2.password';
SET ROLE u3;
SET ROLE u2;

\! sleep 1
RESET SESSION AUTHORIZATION;
RESET ROLE;
GRANT u1 TO u3;
GRANT u2 TO u3;
SET SESSION AUTHORIZATION u3 PASSWORD 'u3.password';
SET ROLE u1; -- error: can't set role to superuser
SET ROLE u2; -- error: need pass

RESET SESSION AUTHORIZATION;
RESET ROLE;
DROP USER u1,u2,u3;

-- ---------------------------------------------------
--  2. auth: auth meta: check the permission of pg_user
-- ---------------------------------------------------
CREATE USER u1 PASSWORD 'u1.password';
SET ROLE u1 PASSWORD 'u1.password';
SELECT usename FROM pg_user WHERE usename = 'u1';
RESET ROLE;
DROP USER u1;

-- ---------------------------------------------------
--  3. auth: create/alter user: check password complexity
-- ---------------------------------------------------
ALTER SYSTEM SET password_policy TO default;
\! sleep 1
CREATE USER u2 PASSWORD 'u2password'; -- error: need 3 types of characters

ALTER SYSTEM SET password_policy TO 2;
\! sleep 1
CREATE USER u3 PASSWORD 'u3.password'; -- error: need 4 types of characters

ALTER SYSTEM SET password_policy TO 3;
\! sleep 1
CREATE USER u1 PASSWORD 'upassword'; -- error: need 2 types of characters
CREATE USER u2 PASSWORD 'u2password'; -- succeed
CREATE USER u3 PASSWORD 'u3.password'; -- succeed
ALTER USER u2 PASSWORD 'upassword'; -- error: need 2 types of characters
ALTER USER u3 PASSWORD 'u2password'; -- -- succeed
-- make sure can login u2
SET ROLE u2 PASSWORD 'u2password';
CREATE TABLE t1(c1 INT);
DROP TABLE t1;

RESET ROLE;
ALTER SYSTEM SET password_policy TO default;
DROP USER IF EXISTS u1,u2,u3;

-- ---------------------------------------------------
--  4. auth: create/alter user: super user
-- ---------------------------------------------------
CREATE USER u1 SUPERUSER PASSWORD 'u1.password'; -- only pg cmpt support super user
CREATE USER u2 SYSADMIN PASSWORD 'u2.password';
CREATE USER u3 NOSUPERUSER PASSWORD 'u3.password';
CREATE USER u4 NOSYSADMIN PASSWORD 'u4.password';
SELECT rolname,rolsuper,rolsystemadmin,rolcreaterole,rolcreatedb FROM pg_authid WHERE rolname in ('u1', 'u2', 'u3', 'u4') ORDER BY rolname;
ALTER USER u1 NOSUPERUSER;
ALTER USER u2 NOSYSADMIN;
ALTER USER u3 SUPERUSER;
ALTER USER u4 SYSADMIN;
SELECT rolname,rolsuper,rolsystemadmin,rolcreaterole,rolcreatedb FROM pg_authid WHERE rolname in ('u1', 'u2', 'u3', 'u4') ORDER BY rolname;
-- try to alter again
ALTER USER u1 NOSUPERUSER;
ALTER USER u3 SUPERUSER;
SELECT rolname,rolsuper,rolsystemadmin,rolcreaterole,rolcreatedb FROM pg_authid WHERE rolname in ('u1', 'u2', 'u3', 'u4') ORDER BY rolname;

DROP USER IF EXISTS u1,u2,u3,u4;

-- ---------------------------------------------------
--  5. access control: permisson of schema for ordinary users
-- ---------------------------------------------------
CREATE USER u1 PASSWORD 'u1.password';
SET ROLE u1 PASSWORD 'u1.password';

SET search_path TO public;
SELECT current_schema;
-- check create permisson under public (only pg cmpt allow this)
CREATE DATABASE db1; -- no permisson
CREATE SCHEMA sch1; -- no permisson
CREATE TABLE t1(c1 INT);
CREATE VIEW v1 AS SELECT * FROM t1;
CREATE INDEX i1 ON t1(c1);
CREATE SEQUENCE seq1;
CREATE FUNCTION f1() RETURNS INT AS $$ SELECT count(*)::INT FROM t1 $$ LANGUAGE sql;
CREATE PROCEDURE p1() IS BEGIN INSERT INTO t1 VALUES (3); END;
/
CREATE FUNCTION ft1() RETURNS TRIGGER AS $$ BEGIN SELECT count(*) FROM t1; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER tri1 AFTER INSERT ON t1 FOR EACH ROW EXECUTE PROCEDURE ft1();
CREATE TYPE typ1 AS ENUM('v1', 'v2');
-- clean
DROP TABLE t1 CASCADE;
DROP SEQUENCE seq1;
DROP FUNCTION f1;
DROP PROCEDURE p1;
DROP FUNCTION ft1;
DROP TYPE typ1;

RESET ROLE;
RESET search_path;
DROP USER IF EXISTS u1;

-- ---------------------------------------------------
--  6. access control: permisson of database for ordinary users
-- ---------------------------------------------------
CREATE USER u1 PASSWORD 'u1.password';
\c template1
SET ROLE u1 PASSWORD 'u1.password';
SELECT current_database;
SELECT current_user;
CREATE TABLE tempt1(c1 INT);
INSERT INTO tempt1 VALUES (3);
DROP TABLE tempt1;

\c regression
-- \c postgres
DROP USER u1;

```
