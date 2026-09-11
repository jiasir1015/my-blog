+++
title = 'PostgreSQL 2-1 Parse'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '查询优化']
weight = 201
ShowToc = true
TocOpen = true
+++
# 1 语法解析概述

## 1.1 语法解析的目的

-   语法解析的目的  
    用户向数据发送以下SQL语句时：

    ```
    CREATE TABLE t1 (c1 INT, c2 TEXT);
    INSERT INTO t1 VALUES (1, 'data1');
    DELETE FROM t1 WHERE c1 = 1;
    ```

    从用户的角度，掌握SQL语法后，我们很容易理解上述SQL的含义。  
    从PostgreSQL的角度，上述语句知识一串字符串，需要根据SQL语法的规则，从字符串中解析表名、列名、数据等关键信息。

-   语法解析的流程  
    此处将语法解析的步骤简要分为以下4个阶段：

1.  定义语法：PostgreSQL开发人员需要根据SQL标准，制定一些类语法规则。比如：
    -   当用户执行`CREATE TABLE ..`时，表示用户需要创建表
    -   当用户执行`CREATE TABLE tablename ..`时，表示用户要创建的表名叫`tablename`
2.  发布语法：PostgreSQL会在官网上发布其定义的各种语法
3.  构造语句：当开发人员想让数据执行某些操作时，需根据数据库定义的语法，构造SQL语句，再让数据库执行。比如：
    -   当用户想创建一个名为`t1`的表，需要构造SQL语句`CREATE TABLE t1 ..`
4.  解析语法：PostgreSQL接收SQL语句后，根据语法规则，可解析SQL想要执行什么操作，生成1个结构体，结构中存储了SQL语句的关键信息，比如：
    -   处理`CREATE TABLE t1 ..`，结构体中，将有1个变量表示表名，该变量的值将被复制为`t1`
5.  执行语法：在解析用户操作后，生成一个结构体，即根据结构体，开始执行各种操作

## 1.2 语法解析的类型

PostgreSQL支持上百种语法，本文主要介绍以下4个常用的语法：

1.  CREATE TABLE ..
2.  SELECT .. FROM ..
3.  INSERT INTO ..
4.  DELETE FROM ..

# 2 解析语法

```sql
[ WITH [ RECURSIVE ] with_query [, ...] ]
SELECT [ ALL | DISTINCT [ ON ( expression [, ...] ) ] ]
    * | expression [ [ AS ] output_name ] [, ...]
    [ FROM from_item [, ...] ]
    [ WHERE condition ]
    [ GROUP BY expression [, ...] ]
    [ HAVING condition [, ...] ]
    [ WINDOW window_name AS ( window_definition ) [, ...] ]
    [ { UNION | INTERSECT | EXCEPT } [ ALL | DISTINCT ] select ]
    [ ORDER BY expression [ ASC | DESC | USING operator ] [ NULLS { FIRST | LAST } ] [, ...] ]
    [ LIMIT { count | ALL } ]
    [ OFFSET start [ ROW | ROWS ] ]
    [ FETCH { FIRST | NEXT } [ count ] { ROW | ROWS } ONLY ]
    [ FOR { UPDATE | NO KEY UPDATE | SHARE | KEY SHARE } [ OF table_name [, ...] ] [ NOWAIT ] [...] ]

-- from_item
    [ ONLY ] table_name [ * ] [ [ AS ] alias [ ( column_alias [, ...] ) ] ]
    [ LATERAL ] ( select ) [ AS ] alias [ ( column_alias [, ...] ) ]
    with_query_name [ [ AS ] alias [ ( column_alias [, ...] ) ] ]
    [ LATERAL ] function_name ( [ argument [, ...] ] ) [ AS ] alias [ ( column_alias [, ...] | column_definition [, ...] ) ]
    [ LATERAL ] function_name ( [ argument [, ...] ] ) AS ( column_definition [, ...] )
    from_item [ NATURAL ] join_type from_item [ ON join_condition | USING ( join_column [, ...] ) ]

-- with_query
    with_query_name [ ( column_name [, ...] ) ] AS ( select | values | insert | update | delete )

TABLE [ ONLY ] table_name [ * ]
```

> 参考 [http://www.postgres.cn/docs/9.3/sql-select.html](http://www.postgres.cn/docs/9.3/sql-select.html)

## 1.2 语法解析

```lex
[SelectStmt]
    [select_with_parens]
        '(' select_no_parens ')'
        '(' select_with_parens ')'
    [select_no_parens]
        simple_select
        [select_clause] sort_clause
            [simple_select]
                SELECT opt_distinct target_list into_clause from_clause where_clause group_clause having_clause window_clause
                [values_clause]
                    VALUES ctext_row
                    values_clause ',' ctext_row
                TABLE [relation_expr]
                    qualified_name
                    qualified_name '*'
                    ONLY qualified_name
                    ONLY '(' qualified_name ')'
                select_clause UNION [opt_all] select_clause
                    ALL
                    DISTINCT
                    -
                select_clause INTERSECT opt_all select_clause
                select_clause EXCEPT opt_all select_clause
            select_with_parens
        select_clause opt_sort_clause for_locking_clause opt_select_limit
        select_clause opt_sort_clause [select_limit] opt_for_locking_clause
            [limit_clause] offset_clause
                LIMIT [select_limit_value]
                    a_expr
                    ALL
                LIMIT select_limit_value ',' [select_offset_value]
                    a_expr
                FETCH first_or_next [opt_select_fetch_first_value] row_or_rows ONLY
                    SignedIconst
                    '(' a_expr ')'
                    -
            offset_clause limit_clause
            limit_clause
            [offset_clause]
                OFFSET select_offset_value
                OFFSET [select_offset_value2] row_or_rows
                    c_expr
        [with_clause] select_clause
            WITH [cte_list]
                common_table_expr
                    name [opt_name_list] AS '(' PreparableStmt ')'
                        with_clause
                cte_list
            WITH RECURSIVE cte_list
        with_clause select_clause sort_clause
        with_clause select_clause opt_sort_clause for_locking_clause [opt_select_limit]
            select_limit
            -
        with_clause select_clause opt_sort_clause select_limit opt_for_locking_clause
target_list
    [target_el]
        a_expr AS ColLabel
        a_expr IDENT
        a_expr
        '*'
    target_list ',' target_el
into_clause
    INTO [OptTempTableName]
        TEMPORARY [opt_table] qualified_name
            TABLE
            -
        TEMP opt_table qualified_name
        LOCAL TEMPORARY opt_table qualified_name
        LOCAL TEMP opt_table qualified_name
        GLOBAL TEMPORARY opt_table qualified_name
        GLOBAL TEMP opt_table qualified_name
        UNLOGGED opt_table qualified_name
        TABLE qualified_name
        qualified_name
    -
[from_clause]
    FROM [from_list]
        [table_ref]
            relation_expr
            relation_expr [alias_clause]
                AS ColId '(' name_list ')'
                AS ColId
                ColId '(' name_list ')'
                ColId
            [func_table]
                [func_expr]
                    func_name '(' ')' [over_clause]
                        OVER [window_specification]
                            '(' [opt_existing_window_name] opt_partition_clause opt_sort_clause opt_frame_clause ')'
                                ColId
                                -
                        OVER ColId
                        -
                    func_name '(' [func_arg_list] ')' over_clause
                        [func_arg_expr]
                            a_expr
                            param_name COLON_EQUALS a_expr
                        func_arg_list ',' func_arg_expr
                    func_name '(' VARIADIC func_arg_expr ')' over_clause
                    func_name '(' func_arg_list ',' VARIADIC func_arg_expr ')' over_clause
                    func_name '(' func_arg_list sort_clause ')' over_clause
                    func_name '(' ALL func_arg_list opt_sort_clause ')' over_clause
                    func_name '(' DISTINCT func_arg_list opt_sort_clause ')' over_clause
                    func_name '(' '*' ')' over_clause
                    COLLATION FOR '(' a_expr ')'
                    CURRENT_DATE
                    CURRENT_TIME
                    CURRENT_TIME '(' Iconst ')'
                    CURRENT_TIMESTAMP
                    ...
                    CAST '(' a_expr AS Typename ')'
                    POSITION '(' position_list ')'
            func_table alias_clause
            func_table AS '(' [TableFuncElementList] ')'
                ColId [Typename] opt_collate_clause
                    SimpleTypename [opt_array_bounds]
                        opt_array_bounds '[' ']'
                        opt_array_bounds '[' Iconst ']'
                        -
                    SETOF [SimpleTypename] opt_array_bounds
                        ...
                    SimpleTypename ARRAY '[' Iconst ']'
                    SETOF SimpleTypename ARRAY '[' Iconst ']'
                    SimpleTypename ARRAY
                    SETOF SimpleTypename ARRAY
            func_table AS ColId '(' TableFuncElementList ')'
            func_table ColId '(' TableFuncElementList ')'
            select_with_parens
            select_with_parens alias_clause
            [joined_table]
                '(' joined_table ')'
                table_ref CROSS JOIN table_ref
                table_ref [join_type] JOIN table_ref join_qual
                    FULL [join_outer]
                        OUTER_P
                        -
                    LEFT join_outer
                    RIGHT join_outer
                    INNER_P
                table_ref JOIN table_ref [join_qual]
                    USING '(' name_list ')'
                    ON a_expr
                table_ref NATURAL join_type JOIN table_ref
                table_ref NATURAL JOIN table_ref
            '(' joined_table ')' alias_clause
        from_list ',' table_ref
    -
[group_clause]
    GROUP_P BY [expr_list]
        a_expr
        expr_list ',' a_expr
    -
[opt_distinct]
    DISTINCT
    DISTINCT ON '(' expr_list ')'
    ALL
    -
[opt_sort_clause]
    sort_clause
        ORDER BY [sortby_list]
            sortby
                a_expr USING qual_all_Op opt_nulls_order
                a_expr opt_asc_desc opt_nulls_order
            sortby_list ',' sortby
    -
[row_or_rows]
    ROW
    ROWS
[first_or_next]
    FIRST_P
    NEXT
[having_clause]
    HAVING a_expr
    -
[opt_for_locking_clause]
    [for_locking_clause]
        [for_locking_items]
            [for_locking_item]
                FOR UPDATE [locked_rels_list] opt_nowait
                    OF qualified_name_list
                    -
                FOR SHARE locked_rels_list opt_nowait
            for_locking_items for_locking_item
        FOR READ ONLY
    -
[where_clause]
    WHERE [a_expr]
        c_expr
        a_expr TYPECAST Typename
        a_expr COLLATE any_name
        a_expr AT TIME ZONE a_expr
        '+' a_expr
        '-' a_expr
        a_expr {'+ - * / % ^ < > ='} a_expr
        a_expr qual_Op a_expr
        qual_Op a_expr
        a_expr qual_Op
        a_expr AND a_expr
        a_expr OR a_expr
        NOT a_expr
        a_expr LIKE a_expr
        a_expr LIKE a_expr ESCAPE a_expr
        a_expr NOT LIKE a_expr
        a_expr NOT LIKE a_expr ESCAPE a_expr
        a_expr ILIKE a_expr
        a_expr NOT ILIKE a_expr
        a_expr SIMILAR TO a_expr
        a_expr SIMILAR TO a_expr ESCAPE a_expr
        a_expr NOT SIMILAR TO a_expr
        a_expr NOT SIMILAR TO a_expr ESCAPE a_expr
        a_expr IS NULL_P
        a_expr ISNULL
        a_expr IS NOT NULL_P
        a_expr NOTNULL
        row OVERLAPS row
        a_expr IS TRUE_P
        a_expr IS FALSE_P
        a_expr IS NOT FALSE_P
        ...
    -
[b_expr]
    ...
[c_expr]
    todo
[window_clause]
    WINDOW [window_definition_list]
        [window_definition]
            ColId AS window_specification
        window_definition_list ',' window_definition
    -
[opt_partition_clause]
    PARTITION BY expr_list
    -
[opt_frame_clause]
    RANGE [frame_extent]
        [frame_bound]
            UNBOUNDED PRECEDING
            UNBOUNDED FOLLOWING
            CURRENT_P ROW
            a_expr PRECEDING
            a_expr FOLLOWING
        BETWEEN frame_bound AND frame_bound
    ROWS frame_extent
    -
```

> 参考 pg源码 src/backend/parser/gram.y  
> 个人源码阅读 [http://124.70.36.226:3000/?folder=/home/lorand/postgres/postgresql_9.2.4](http://124.70.36.226:3000/?folder=/home/lorand/postgres/postgresql_9.2.4)

---

# sql语法

# 1 概述

## 1.1 语法

```sql
[ WITH [ RECURSIVE ] with_query [, ...] ]
SELECT [ ALL | DISTINCT [ ON ( expression [, ...] ) ] ]
    * | expression [ [ AS ] output_name ] [, ...]
    [ FROM from_item [, ...] ]
    [ WHERE condition ]
    [ GROUP BY expression [, ...] ]
    [ HAVING condition [, ...] ]
    [ WINDOW window_name AS ( window_definition ) [, ...] ]
    [ { UNION | INTERSECT | EXCEPT } [ ALL | DISTINCT ] select ]
    [ ORDER BY expression [ ASC | DESC | USING operator ] [ NULLS { FIRST | LAST } ] [, ...] ]
    [ LIMIT { count | ALL } ]
    [ OFFSET start [ ROW | ROWS ] ]
    [ FETCH { FIRST | NEXT } [ count ] { ROW | ROWS } ONLY ]
    [ FOR { UPDATE | NO KEY UPDATE | SHARE | KEY SHARE } [ OF table_name [, ...] ] [ NOWAIT ] [...] ]

-- from_item
    [ ONLY ] table_name [ * ] [ [ AS ] alias [ ( column_alias [, ...] ) ] ]
    [ LATERAL ] ( select ) [ AS ] alias [ ( column_alias [, ...] ) ]
    with_query_name [ [ AS ] alias [ ( column_alias [, ...] ) ] ]
    [ LATERAL ] function_name ( [ argument [, ...] ] ) [ AS ] alias [ ( column_alias [, ...] | column_definition [, ...] ) ]
    [ LATERAL ] function_name ( [ argument [, ...] ] ) AS ( column_definition [, ...] )
    from_item [ NATURAL ] join_type from_item [ ON join_condition | USING ( join_column [, ...] ) ]

-- with_query
    with_query_name [ ( column_name [, ...] ) ] AS ( select | values | insert | update | delete )

TABLE [ ONLY ] table_name [ * ]
```

> 参考 [http://www.postgres.cn/docs/9.3/sql-select.html](http://www.postgres.cn/docs/9.3/sql-select.html)

## 1.2 语法解析

```lex
[SelectStmt]
    [select_with_parens]
        '(' select_no_parens ')'
        '(' select_with_parens ')'
    [select_no_parens]
        simple_select
        [select_clause] sort_clause
            [simple_select]
                SELECT opt_distinct target_list into_clause from_clause where_clause group_clause having_clause window_clause
                [values_clause]
                    VALUES ctext_row
                    values_clause ',' ctext_row
                TABLE [relation_expr]
                    qualified_name
                    qualified_name '*'
                    ONLY qualified_name
                    ONLY '(' qualified_name ')'
                select_clause UNION [opt_all] select_clause
                    ALL
                    DISTINCT
                    -
                select_clause INTERSECT opt_all select_clause
                select_clause EXCEPT opt_all select_clause
            select_with_parens
        select_clause opt_sort_clause for_locking_clause opt_select_limit
        select_clause opt_sort_clause [select_limit] opt_for_locking_clause
            [limit_clause] offset_clause
                LIMIT [select_limit_value]
                    a_expr
                    ALL
                LIMIT select_limit_value ',' [select_offset_value]
                    a_expr
                FETCH first_or_next [opt_select_fetch_first_value] row_or_rows ONLY
                    SignedIconst
                    '(' a_expr ')'
                    -
            offset_clause limit_clause
            limit_clause
            [offset_clause]
                OFFSET select_offset_value
                OFFSET [select_offset_value2] row_or_rows
                    c_expr
        [with_clause] select_clause
            WITH [cte_list]
                common_table_expr
                    name [opt_name_list] AS '(' PreparableStmt ')'
                        with_clause
                cte_list
            WITH RECURSIVE cte_list
        with_clause select_clause sort_clause
        with_clause select_clause opt_sort_clause for_locking_clause [opt_select_limit]
            select_limit
            -
        with_clause select_clause opt_sort_clause select_limit opt_for_locking_clause
target_list
    [target_el]
        a_expr AS ColLabel
        a_expr IDENT
        a_expr
        '*'
    target_list ',' target_el
into_clause
    INTO [OptTempTableName]
        TEMPORARY [opt_table] qualified_name
            TABLE
            -
        TEMP opt_table qualified_name
        LOCAL TEMPORARY opt_table qualified_name
        LOCAL TEMP opt_table qualified_name
        GLOBAL TEMPORARY opt_table qualified_name
        GLOBAL TEMP opt_table qualified_name
        UNLOGGED opt_table qualified_name
        TABLE qualified_name
        qualified_name
    -
[from_clause]
    FROM [from_list]
        [table_ref]
            relation_expr
            relation_expr [alias_clause]
                AS ColId '(' name_list ')'
                AS ColId
                ColId '(' name_list ')'
                ColId
            [func_table]
                [func_expr]
                    func_name '(' ')' [over_clause]
                        OVER [window_specification]
                            '(' [opt_existing_window_name] opt_partition_clause opt_sort_clause opt_frame_clause ')'
                                ColId
                                -
                        OVER ColId
                        -
                    func_name '(' [func_arg_list] ')' over_clause
                        [func_arg_expr]
                            a_expr
                            param_name COLON_EQUALS a_expr
                        func_arg_list ',' func_arg_expr
                    func_name '(' VARIADIC func_arg_expr ')' over_clause
                    func_name '(' func_arg_list ',' VARIADIC func_arg_expr ')' over_clause
                    func_name '(' func_arg_list sort_clause ')' over_clause
                    func_name '(' ALL func_arg_list opt_sort_clause ')' over_clause
                    func_name '(' DISTINCT func_arg_list opt_sort_clause ')' over_clause
                    func_name '(' '*' ')' over_clause
                    COLLATION FOR '(' a_expr ')'
                    CURRENT_DATE
                    CURRENT_TIME
                    CURRENT_TIME '(' Iconst ')'
                    CURRENT_TIMESTAMP
                    ...
                    CAST '(' a_expr AS Typename ')'
                    POSITION '(' position_list ')'
            func_table alias_clause
            func_table AS '(' [TableFuncElementList] ')'
                ColId [Typename] opt_collate_clause
                    SimpleTypename [opt_array_bounds]
                        opt_array_bounds '[' ']'
                        opt_array_bounds '[' Iconst ']'
                        -
                    SETOF [SimpleTypename] opt_array_bounds
                        ...
                    SimpleTypename ARRAY '[' Iconst ']'
                    SETOF SimpleTypename ARRAY '[' Iconst ']'
                    SimpleTypename ARRAY
                    SETOF SimpleTypename ARRAY
            func_table AS ColId '(' TableFuncElementList ')'
            func_table ColId '(' TableFuncElementList ')'
            select_with_parens
            select_with_parens alias_clause
            [joined_table]
                '(' joined_table ')'
                table_ref CROSS JOIN table_ref
                table_ref [join_type] JOIN table_ref join_qual
                    FULL [join_outer]
                        OUTER_P
                        -
                    LEFT join_outer
                    RIGHT join_outer
                    INNER_P
                table_ref JOIN table_ref [join_qual]
                    USING '(' name_list ')'
                    ON a_expr
                table_ref NATURAL join_type JOIN table_ref
                table_ref NATURAL JOIN table_ref
            '(' joined_table ')' alias_clause
        from_list ',' table_ref
    -
[group_clause]
    GROUP_P BY [expr_list]
        a_expr
        expr_list ',' a_expr
    -
[opt_distinct]
    DISTINCT
    DISTINCT ON '(' expr_list ')'
    ALL
    -
[opt_sort_clause]
    sort_clause
        ORDER BY [sortby_list]
            sortby
                a_expr USING qual_all_Op opt_nulls_order
                a_expr opt_asc_desc opt_nulls_order
            sortby_list ',' sortby
    -
[row_or_rows]
    ROW
    ROWS
[first_or_next]
    FIRST_P
    NEXT
[having_clause]
    HAVING a_expr
    -
[opt_for_locking_clause]
    [for_locking_clause]
        [for_locking_items]
            [for_locking_item]
                FOR UPDATE [locked_rels_list] opt_nowait
                    OF qualified_name_list
                    -
                FOR SHARE locked_rels_list opt_nowait
            for_locking_items for_locking_item
        FOR READ ONLY
    -
[where_clause]
    WHERE [a_expr]
        c_expr
        a_expr TYPECAST Typename
        a_expr COLLATE any_name
        a_expr AT TIME ZONE a_expr
        '+' a_expr
        '-' a_expr
        a_expr {'+ - * / % ^ < > ='} a_expr
        a_expr qual_Op a_expr
        qual_Op a_expr
        a_expr qual_Op
        a_expr AND a_expr
        a_expr OR a_expr
        NOT a_expr
        a_expr LIKE a_expr
        a_expr LIKE a_expr ESCAPE a_expr
        a_expr NOT LIKE a_expr
        a_expr NOT LIKE a_expr ESCAPE a_expr
        a_expr ILIKE a_expr
        a_expr NOT ILIKE a_expr
        a_expr SIMILAR TO a_expr
        a_expr SIMILAR TO a_expr ESCAPE a_expr
        a_expr NOT SIMILAR TO a_expr
        a_expr NOT SIMILAR TO a_expr ESCAPE a_expr
        a_expr IS NULL_P
        a_expr ISNULL
        a_expr IS NOT NULL_P
        a_expr NOTNULL
        row OVERLAPS row
        a_expr IS TRUE_P
        a_expr IS FALSE_P
        a_expr IS NOT FALSE_P
        ...
    -
[b_expr]
    ...
[c_expr]
    todo
[window_clause]
    WINDOW [window_definition_list]
        [window_definition]
            ColId AS window_specification
        window_definition_list ',' window_definition
    -
[opt_partition_clause]
    PARTITION BY expr_list
    -
[opt_frame_clause]
    RANGE [frame_extent]
        [frame_bound]
            UNBOUNDED PRECEDING
            UNBOUNDED FOLLOWING
            CURRENT_P ROW
            a_expr PRECEDING
            a_expr FOLLOWING
        BETWEEN frame_bound AND frame_bound
    ROWS frame_extent
    -
```

> 参考 pg源码 src/backend/parser/gram.y  
> 个人源码阅读 [http://124.70.36.226:3000/?folder=/home/lorand/postgres/postgresql_9.2.4](http://124.70.36.226:3000/?folder=/home/lorand/postgres/postgresql_9.2.4)
