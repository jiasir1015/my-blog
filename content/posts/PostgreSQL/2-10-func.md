+++
title = 'PostgreSQL 2-10 function'
date = '2026-07-01T15:19:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL']
weight = 210
ShowToc = true
TocOpen = true
+++
```python
exec_simple_query('SELECT * FROM t1 WHERE c1 > 10')
    pg_parse_query
    pg_analyze_and_rewrite
        parse_analyze
            transformStmt
                transformSelectStmt
                    transformWhereClause
                        transformExpr
                            transformAExprOp
                                oper
                                    oper_search # 查找操作符所有相关函数
                                    enforce_generic_type_consistency # 根据已知数据类型，找到最符合的函数，自动调用隐式转换
                                make_op
    pg_plan_queries
    PortalRun
        ExecInterpExpr
            ExecEvalExprSwitchContext
                -- ciphera_gt / int4gt
```
