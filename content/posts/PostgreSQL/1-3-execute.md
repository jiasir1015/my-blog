+++
title = 'PostgreSQL 1-3 执行模块'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '查询优化']
weight = 103
ShowToc = true
TocOpen = true
+++
# 1 整体流程

## 1.1 执行流程

1.  应用->驱动：通过驱动的api建立连接，并执行SQL语句
2.  驱动->服务端：通过libpq协议封装SQL语句，发送至服务端
3.  服务端 postgres线程：接收SQL语句，调用exec_siple_query()开始处理SQL语句

-   SQL引擎

2.  解析器：通过flex进行词法解析，通过yacc进行语法分析，生成解析树
3.  分析器：对解析树进行语义分析：包括检查表是否存在等，生成查询树
4.  重写器：
5.  计划期：根据查询树生成执行计划
6.  执行器：自顶向下执行各个算子，执行过程中会调用存储引擎统一接口
    -   INSERT / UPDATE / DELETE

        ```c
        ExecModifyTable 算子：EexecInsert / ExecUpdate / ExecDelete
            EexecInsert
                ExecMaterializeSlot
                ExecBRInsertTriggers /* ROW INSERT 触发器 */
                ExecWithCheckOptions /* 检查约束 */
                heap_insert /* 存储引擎统一接口 */
                ExecInsertIndexTuples
                ExecARInsertTriggers /* AFTER ROW 触发器 */
                ExecProcessReturning
        ```

    -   SELECT

        ```c
        ExecIndexScan
            IndexNext()
                index_getnext()
                    tid = index_getnext_tid(scan)
                    index_fetch_heap(scan)
                        heap_hot_search_buffer()
                            PageGetItem()
        ```
