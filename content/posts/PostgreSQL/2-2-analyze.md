+++
title = 'PostgreSQL 2-2 Analyze'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '查询优化']
weight = 202
ShowToc = true
TocOpen = true
+++
# 1 概述

## 1.1 语义分析的目的

-   语义分析的目的  
    上文提到，PostgreSQL接收SQL语句时，会生成1个语法解析树，语法解析树存储了SQL语法中的关键信息。比如，在语法`INSERT INTO t1 VALUES(1, 'data1')`中，解析结果可说明：

1.  这是一条用于插入数据的INSERT语法
2.  数据将插入t1表中
3.  要插入的数据是`(1, 'data1')`
4.  …  
    但是，数据库执行时，还需要更多的关键信息才行，比如，在`INSERT INTO t1 VALUES(1, 'data1')`的语法树中，PostgreSQL需要获取一些关键信息：
5.  数据库中是否有表叫t1
6.  t1表有几列，每列的的数据类型是什么
7.  语法中的值`(1, 'data1')`是否符合t1表的定义
8.  …

## 1.2 本文的目标

本文以几个常见且简单的语法为例，介绍语义分析的详细功能

1.  CREATE TABLE ..
2.  SELECT .. FROM ..
3.  INSERT INTO ..
4.  DELETE FROM ..

## 1.3 语义分析的调用关系

```python
exec_simple_query
    pg_parse_query
    pg_analyze_and_rewrite
        parse_analyze
```

## 1.1 整体流程

```c
// 语义分析
exec_simple_query
    pg_parse_query
    pg_analyze_and_rewrite
        parse_analyze
            transformTopLevelStmt
                transformOptionalSelectInto
                    transformStmt
                        transformInsertStmt

exec_simple_query()
    pg_parse_query()
    for (;;):
        pg_analyze_and_rewrite()
                Query *query = parse_analyze(Node *parsetree)
                List *querytree_list = pg_rewrite_query(query)
        pg_plan_queries()
        PortalRun()
```

## 1.2 分析器

```c
Query *parse_analyze(Node *parseTree)
    ParseState *pstate = make_parsestate()
    Query *query = query = transformTopLevelStmt(pstate, parseTree)
        query = transformStmt(pstate, parseTree) /* 对各种类型语法进行语义分析 */
            Query *result
            switch nodeTag(parseTree) {
                case T_InsertStmt:
                    result = transformInsertStmt(pstate, (InsertStmt *) parseTree)
                case T_DeleteStmt:
                    result = transformDeleteStmt(pstate, (DeleteStmt *) parseTree)
                case T_UpdateStmt:
                    result = transformUpdateStmt(pstate, (UpdateStmt *) parseTree)
                case T_SelectStmt:
                    SelectStmt *n = (SelectStmt *) parseTree;
                        if n->valuesLists:
                            transformValuesClause(pstate, n)
                        else if n->op == SETOP_NONE:
                            result = transformSelectStmt(pstate, n)
                case T_DeclareCursorStmt:
                    ...
                case T_ExplainStmt:
                    ...
                case T_CreateTableAsStmt:
                    ...
                default:
                    result = makeNode(Query)
                    result->commandType = CMD_UTILITY
                    result->utilityStmt = (Node *) parseTree
            }
            return result;
```

## 1.3 SELECT 分析

```c
Query *transformSelectStmt(ParseState *pstate, SelectStmt *stmt)
    Query *qry = makeNode(Query)
    if stmt->withClause:
        qry->cteList = transformWithClause(pstate, stmt->withClause)
    transformFromClause(pstate, stmt->fromClause)
    qry->targetList = transformTargetList(pstate, stmt->targetList)
    markTargetListOrigins(pstate, qry->targetList)
    Node *qual = transformWhereClause(pstate, stmt->whereClause)
    qry->havingQual = transformWhereClause(pstate, stmt->havingClause)
    qry->sortClause = transformSortClause(pstate, stmt->sortClause, &qry->targetList)
    qry->groupClause = transformGroupClause(pstate, stmt->groupClause, &qry->groupingSets, &qry->targetList, qry->sortClause)
    qry->distinctClause = transformDistinctOnClause(pstate, stmt->distinctClause, &qry->targetList, qry->sortClause)
    qry->limitOffset = transformLimitClause(pstate, stmt->limitOffset)
    qry->limitCount = transformLimitClause(pstate, stmt->limitCount)
    qry->windowClause = transformWindowDefinitions(pstate, pstate->p_windowdefs, &qry->targetList)
    qry->jointree = makeFromExpr(pstate->p_joinlist, qual)
    if pstate->p_hasAggs || qry->groupClause || qry->groupingSets || qry->havingQual:
        parseCheckAggregates(pstate, qry)
    assign_query_collations(pstate, qry)
    return qry
```
