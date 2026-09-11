+++
title = 'PostgreSQL 2-3 Rewrite'
date = '2025-02-05T18:29:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '查询优化']
weight = 203
ShowToc = true
TocOpen = true
+++
-   重写功能

    ```sql
    -- 创建2个表
    CREATE TABLE t1 (c1 INT, c2 TEXT);
    CREATE TABLE t2 (c1 INT, c2 TEXT);

    -- 创建1条重写规则
        -- 触发条件：向t1表写入数据时
        -- 执行操作：将SQL语句重写为：同时向t2写入相同数据
    CREATE OR REPLACE RULE r1 AS
        ON INSERT TO t1 DO ALSO INSERT INTO t2 VALUES (new.c1, new.c2);

    -- 向t1写入一条数据
    INSERT INTO t1 VALUES (1, 'abc');

    -- 验证t2也写入了一条数据
    SELECT * FROM t2;

    DROP TABLE t1,t2;
    ```

-   重写规则

    -   语法  
        定义重写规则的语法如下：

        ```sql
        CREATE [ OR REPLACE ] RULE name AS
            ON { SELECT | INSERT | UPDATE | DELETE } TO table_name [ WHERE condition ]
            DO [ ALSO | INSTEAD ] { NOTHING | command | ( command ; command ... ) }
        ```

    -   约束
        -   SELECT：只能有1个动作，不带条件的INSTEAD
        -   INSERT / UPDATE / DELETE：可以无动作，可以多动作；可使用伪关系NEW和OLD。可使用规则条件。不修改查询树，废弃院查询树，重建0或多个查询树
-   重写原理

1.  创建重写规则  
    用户使用CREATE RULE语法定义重写规则时，将重写规则存储至系统表中

    ```sql
    CREATE TABLE t1 (c1 INT, c2 TEXT);
    CREATE TABLE t2 (c1 INT, c2 TEXT);

    CREATE OR REPLACE RULE r1 AS
        ON INSERT TO t1 WHERE c1 > 1
        DO ALSO INSERT INTO t2 VALUES (new.c1 + 1, new.c2);

    -- 查看系统表
    SELECT * FROM pg_rewrite WHERE rulename = 'r1';

    -- 解释：如果在ev_class表上，执行ev_type，而且满足ev_qual操作，则执行ev_action中的动作

    -- 在pg.10版本中，执行以下函数报错
    SELECT pg_get_expr(ev_action, ev_class) FROM pg_rewrite WHERE rulename = 'r1';
    -- 走读代码，发现以下SQL语句可查看所有视图
    SELECT pg_get_ruledef((SELECT oid FROM pg_rewrite WHERE rulename = 'r1'));
    -- 扩展：以下SQL语句可查看所有视图
    SELECT ev_class::regclass WHERE pg_rewrite;

    -- 查看视图
    SELECT * FROM pg_rules;
    ```

2.  出发重写规则

    ```python
    pg_rewrite_query
        QueryRewrite
            RewriteQuery # 处理 INSERT / UPDATe / DELETE，因为可能包含ALSO，增加额外的SQL语句
                if CMD_SELECT:
                    rewriteTargetListIU
                elif CMD_UPDATE:
                    rewriteTargetListUD
                elif CMD_DELETE:
                    rewriteTargetListUD

                if not instead: # 如果不是 INSTEAD 类型的 重写规则
                    rewriteTargetView

            fireRIRules
                ApplyRetriiveRule
                get_row_security_policies # <安全模块> 行级访问控制，后面讲
    ```
