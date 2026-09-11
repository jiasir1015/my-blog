+++
title = '数据库安全 重构审计'
date = '2025-03-31T19:24:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['Vastbase', '审计']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 审计的背景

## 1.1 审计的原理

在使用数据库存取数据的大部分场景中，数据库具有以下特点：

-   对象多：一个数据库集群中有多个database对象，1个database对象中有多个schema对象，1个schema对象中有多个table、index等对象
-   用户多：一个数据库中，有多个用户，每个用户可访问的数据库对象不同
-   应用多：多个应用将数据存储在同一数据库集群中，并同时访问数据库集群
-   操作多：数据库提供丰富的功能，包括DDL、DML、DCL、运维等
-   运行久：一个数据库集群，可能会保持数十年运行

审计的主要目的，使记录数据运行过程中发生了哪些事件。审计的3要素是：

-   主体：一般指数据库用户
-   客体：一般指数据库对象，包括：集群、数据对象（database、schema、table、index、function等）、用户等
-   操作：主体对客体的操作，比如某个用户访问了某个表

## 1.2 审计的目的

审计具有以下重要意义：

-   合法合规：《网络安全法》等法律法规与表中中，要求应用通过《等保测评》等标准，标准中要求应用具备审计功能
-   故障检测：当数据库出现故障时，协助快速定位问题
-   攻击检测：通过检查审计日志，可判断是否发生网络安全攻击事件
-   例行维护：通过检查审计日志，可跟踪对某个对象的访问信息
-   …

等保测评要求标准（GB/T 28448）中，对审计的要求如下：

-   审计范围
    -   全面性
    -   细粒度：登录、访问、修改、删除等
-   审计内容
    -   用户行为：登录、登出、权限变更
    -   数据访问：敏感数据查询、插入、更新、删除等
    -   异常行为：登录失败、非法访问
-   审计记录
    -   详细性：时间戳、用户标识、操作类型、操作结果、IP地址等
    -   不可篡改：真实性、完整性
    -   存储安全：未经授权的访问和修改
-   审计管理
    -   审计策略：审计的目标、范围、内容和频率
    -   审计分析：定期分析审计记录
    -   审计报告

## 1.3 审计的功能

审计功能包含以下3个部分：

1.  配置审计功能：日志存储策略等
2.  设置审计范围：设置哪类操作、哪类对象、..需要给设计
3.  生成审计日志：运行时，生成审计日志
4.  管理审计日志：查询，删除，归档审计日志

## 1.4 oracle审计

oracle审计的发展：

-   oracle 8i及更早：支持传统审计
-   oracle 12c：新增支持统一审计
-   oracle 23ai：不支持传统审计，仅支持统一审计

oracle统一审计的使用：

```sql
-- 1 设置审计范围：创建审计策略
CREATE AUDIT POLICY ap1
    PRIVILEGES CREATE TABLE, ALTER USER -- privilege 子句，记录所有使用CreateTable, AlterUser权限的操作，oracle 12c中，支持256种权限
    ACTIONS SELECT,INSERT,UPDATE ON t1 -- aciton 子句，记录所有对表t1执行SELECT,INSERT,UPDATE的操作
    ROLES r1; -- role 子句，记录所有使用r1角色的操作

-- 2 启用审计策略
AUDIT POLICY ap1;

-- 3 查看审计日志（完整日志）
SELECT * FROM UNIFIED_AUDIT_TRAIL;

-- 查看关键日志
SELECT * FROM DBA_AUDIT_TRAIL; -- 其他：DBA_COMMON_AUDIT_TRAIL, DBA_AUDIT_SESSION, DBA_AUDIT_OBJECT, DBA_FGA_AUDIT_TRAIL

os_username | username | userhost | terminal | timestamp | owner | obj_name | action | action_name |
------------+----------+----------+----------+-----------+-------+----------+--------+-------------+

| new_owner | new_name | obj_privilege | sys_privilege | admin_option | grantee | audit_option | ses_actions |
+----------+----------+---------------+---------------+--------------+---------+--------------+-------------+

logoff_time | logoff_lread | logoff_pwrite | logoff_dlock | comment_text | sessionid | entryid | statementid | returncode |
+-----------+--------------+---------------+--------------+--------------+-----------+---------+-------------+------------+

| priv_used | client_id | econtext_id | session_cpu | extended_timestamp | proxy_sessionid | global_uid | instance_number |
+-----------+-----------+-------------+-------------+--------------------+-----------------+------------+-----------------+

os_process | transactionid | scn | sql_bind | sql_text | obj_edition_name | dbid | rls_info | current_user |
+----------+---------------+-----+----------+----------+------------------+------+----------+--------------+
```

其中，可设置的权限、操作等范围如下：

```sql
-- 所有的 PRIVILEGES
SELECT NAME FROM SYSTEM_PRIVILEGE_MAP;

-- 所有的 ACTION
        object           |       actions
    ---------------------+--------------------------------------------------------------------------------------------------
    Directory            | AUDIT, GRANT, READ
    Function             | AUDIT, EXECUTE, GRANT
    Java schema objects  | AUDIT, EXECUTE, GRANT
    Library              | EXECUTE, GRANT
    Materialized views   | ALTER, AUDIT, COMMENT, DELETE, INDEX, INSERT, LOCK, SELECT, UPDATE
    Mining Model         | AUDIT, COMMENT, GRANT, RENAME, SELECT
    Object type          | ALTER, AUDIT, GRANT
    Package              | AUDIT, EXECUTE, GRANT
    Procedure, triggers  | AUDIT, EXECUTE, GRANT
    Sequence             | ALTER, AUDIT, GRANT, SELECT
    Table                | ALTER, AUDIT, COMMENT, DELETE, FLASHBACK, GRANT, INDEX, INSERT, LOCK, MERGE, RENAME, SELECT, UPDATE
    Table or view column | ALL, ALTER, AUDIT, COMMENT, DELETE, GRANT, INDEX, INSERT, SELECT, UPDATE
    View                 | AUDIT, COMMENT, DELETE, FLASHBACK, GRANT, INSERT, LOCK, MERGE, RENAME, SELECT, UPDATE

-- 完整的 CREATE AUDIT POLICY 语法
CREATE AUDIT POLICY policy_name
    {     {privilege_audit_clause [action_audit_clause ] [role_audit_clause ]}
        | { action_audit_clause   [role_audit_clause ] }
        | { role_audit_clause }
    }
    [WHEN audit_condition EVALUATE PER {STATEMENT|SESSION|INSTANCE}]
    [ONLY TOPLEVEL]
    [CONTAINER = {CURRENT | ALL}];
```

> 参考：
>
> -   oracle 23官方文档审计功能: [https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/introduction-to-auditing.html#GUID-94381464-53A3-421B-8F13-BD171C867405](https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/introduction-to-auditing.html#GUID-94381464-53A3-421B-8F13-BD171C867405)
> -   oracle 23中审计日志：[https://docs.oracle.com/en/database/oracle/oracle-database/23/refrn/UNIFIED_AUDIT_TRAIL.html](https://docs.oracle.com/en/database/oracle/oracle-database/23/refrn/UNIFIED_AUDIT_TRAIL.html)

## 1.5 openGauss审计

在opengauss中，审计也分为2个独立的子特性：

-   传统审计：在GUC参数中，配置是否对某类客体、某类操作进行审计（例如：是否审计所有TABLE，是否审计所有DML操作）
-   统一审计：通过SQL语法，定义是否对某个客体、某个主体进行审计（例如：是否审计表t1，是否审计角色rolo1）

opengauss传统审计：

```bash
# 1 设置审计范围
gs_guc SET .. -c "audit_login_logout=7"
gs_guc SET .. -c "audit_system_object=67121159" # 审计database, schema, table, ..等对象的create, alter, drop操作
gs_guc SET .. -c "audit_dml_state=1" # 审计insert, update, delete操作
# 设置审计范围的guc参数有20+
```

```sql
-- 2 查询审计日志(存储于：guc audit_directory)
SELECT pg_query_audit('2024-07-12 08:00:00','2024-07-12 17:00:00');
```

opengauss统一审计：

```sql
-- 0 前提：创建资源标签
CREATE TABLE t1 (c1 INT, c2 TEXT);
CREATE RESOURCE LABEL rl1 ADD TABLE(t1); -- 支持 SCHEMA, TABLE, COLUMN, VIEW, FUNCITON

-- 1 设置审计范围
CREATE AUDIT POLICY ap1 ACCESS ALL ON LABEL(rl1); -- 支持 ACCESS ALL, ACCESS {SELECT、COPY、DEALLOCATE、DELETE、EXECUTE、INSERT、PREPARE、REINDEX、TRUNCATE、UPDATE}
CREATE AUDIT POLICY ap2 PRIVILEGES ALL ON LABEL(rl1) FILTER ON ROLES (r1); -- 支持 PRIVILEGES ALL, PRIVILEGES {CREATE、ALTER、DROP、ANALYZE、COMMENT、GRANT、REVOKE、SET、SHOW}

-- 2 查询审计日志 (存储于：/var/log/localmessage)
    -- {timestamp} {host} {event type}, user_name: {user_name}, app_name: {app_name}, client_ip: {client_ip}, access type: {access_type}, policy id: {policy_id}, table: {table}, result: {result}
```

> 参考
>
> -   opengauss audit policy语法：[https://docs.opengauss.org/zh/docs/latest/docs/SQLReference/CREATE-AUDIT-POLICY.html](https://docs.opengauss.org/zh/docs/latest/docs/SQLReference/CREATE-AUDIT-POLICY.html)
> -   opengauss audit：[https://docs.opengauss.org/zh/docs/latest/docs/DatabaseAdministrationGuide/%E8%AE%BE%E7%BD%AE%E6%95%B0%E6%8D%AE%E5%BA%93%E5%AE%A1%E8%AE%A1.html](https://docs.opengauss.org/zh/docs/latest/docs/DatabaseAdministrationGuide/%E8%AE%BE%E7%BD%AE%E6%95%B0%E6%8D%AE%E5%BA%93%E5%AE%A1%E8%AE%A1.html)
