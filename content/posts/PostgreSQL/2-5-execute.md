+++
title = 'PostgreSQL 2-5 Execute'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '查询优化']
weight = 205
ShowToc = true
TocOpen = true
+++
# 1 概述

## 1.1 总接口

```python
main
    PostmasterMain
        ServerLoop
            for (;;)
                select # 接收TCP连接
                BackendStartup
                    fork_process # fork postgres进程，用于处理SQL
                        # postgres子进程执行：
                        BackendRun
```

```python
# postgres子进程
BackendRun
    PostgresMain
        for (;;)
            ReadCommand
            exec_simple_query
                pg_parse_query # 语法解析
                pg_analyze_and_rewrite # 语义分析 查询重写
                pg_plan_queries # 计划生成
                CreatePortal
                PortalDefineQuery
                PortalStart
                PortalRun
                    PortalRunSelect
                        ExecutorRun # 计划执行
                            standard_ExecutorRun
                                ExecutePlan
                                    for (;;)
                                        ExecProcNode
                                            ExecSeqScan # SELECT 计划执行
                                                SeqNext
                                                    heap_beginscan
                                                    heap_getnext
                    PortalRunMulti # DDL执行
                        PortalRunUtility
                            ProcessUtility
                                standard_ProcessUtility
                                    ExecDropStmt # DROP TABLE
                                    ProcessUtilitySlow
                                        DefineRelation # CREATE TABLE
                        ProcessQuery
                            ExecutorStart
                            ExecutorRun # 计划执行
                                standard_ExecutorRun
                                    ExecutePlan
                                        for (;;)
                                            ExecProcNode
                                                ExecModifyTable
                                                    ExecInsert # INSERT 计划执行
                                                        heap_insert
                                                    ExecUpdate # UPDATE 计划执行
                                                        heap_update
                                                    ExecDelete # DELETE 计划执行
                                                        heap_delete
                            ExecutorFinish
                            ExecutorEnd
                PortalDrop
```

```python
exec_simple_query
    pg_plan_queries
        pg_plan_query
            planner
                standard_planner
                    subquery_planner
                        pull_up_subqueries
                        preprocess_qual_conditions
                        grouping_planner
                            query_planner
                                make_one_rel
                                    set_base_rel_pathlists # 查找所有Scan类型
                                        set_rel_pathlist
                                            set_plain_rel_pathlist
                                                create_seqscan_path
                                                create_index_paths
                                                    get_index_paths
                                                    generate_bitmap_or_paths
                                                create_tidscan_paths
                    get_cheapest_fractional_path
                    create_plan

create_plan_recurse
    create_scan_plan
```

## 1.2 算子类型

```c
TupleTableSlot *ExecProcNode(PlanState *node)

/* 控制算子 */
ExecResult((ResultState *) node);
ExecModifyTable((ModifyTableState *) node);
ExecAppend((AppendState *) node);
ExecMergeAppend((MergeAppendState *) node);
ExecRecursiveUnion((RecursiveUnionState *) node);

/* 扫描算子 */
ExecSeqScan((SeqScanState *) node);
ExecSampleScan((SampleScanState *) node);
ExecIndexScan((IndexScanState *) node);
ExecIndexOnlyScan((IndexOnlyScanState *) node);
ExecBitmapHeapScan((BitmapHeapScanState *) node);
ExecTidScan((TidScanState *) node);
ExecSubqueryScan((SubqueryScanState *) node);
ExecFunctionScan((FunctionScanState *) node);
ExecValuesScan((ValuesScanState *) node);
ExecCteScan((CteScanState *) node);
ExecWorkTableScan((WorkTableScanState *) node);
ExecForeignScan((ForeignScanState *) node);
ExecCustomScan((CustomScanState *) node);

/* 连接算子 */
ExecNestLoop((NestLoopState *) node);
ExecMergeJoin((MergeJoinState *) node);
ExecHashJoin((HashJoinState *) node);

/* 物化算子 */
ExecMaterial((MaterialState *) node);
ExecSort((SortState *) node);
ExecGroup((GroupState *) node)
ExecAgg((AggState *) node);
ExecWindowAgg((WindowAggState *) node)
ExecUnique((UniqueState *) node);
ExecHash((HashState *) node);
ExecSetOp((SetOpState *) node)
ExecLockRows((LockRowsState *) node);
ExecLimit((LimitState *) node);
```

# 2 算子

## 2.1 ExecSort

```c
/* 主要流程 */
TupleTableSlot *ExecSort(SortState *node)
    Tuplesortstate *tuplesortstate = node->tuplesortstate

    if !node->sort_Done:
        PlanState *outerNode = outerPlanState(node)
        tuplesortstate =  tuplesort_begin_heap(ExecGetResultType(outerNode), numCols, sortColIdx, sortOperators)
        for (;;) /* 子节点扫描tup */
            slot = ExecProcNode(outerNode)
            tuplesort_puttupleslot(tuplesortstate, slot)
        tuplesort_performsort(tuplesortstate)

    slot = node->ss.ps.ps_ResultTupleSlot
    tuplesort_gettupleslot(tuplesortstate, ScanDirectionIsForward(dir), slot)
    return slot

/* 1 准备 */
Tuplesortstate *tuplesort_begin_heap(TupleDesc tupDesc, int nkeys, AttrNumber *attNums, Oid *sortOperators, Oid *sortCollations, bool *nullsFirstFlags)
    Tuplesortstate *state;
	state->comparetup = comparetup_heap
	state->copytup = copytup_heap;
	state->writetup = writetup_heap
	state->readtup = readtup_heap

    state->sortKeys = palloc0(nkeys * sizeof(SortSupportData))
    for i in range(nkeys):
        SortSupport sortKey = state->sortKeys + i
        sortKey->ssup_attno = attNums[i]

/* 2 扫描存储 */
void tuplesort_puttupleslot(Tuplesortstate *state, TupleTableSlot *slot)
    SortTuple stup
    COPYTUP(state, &stup, (void *) slot)
    puttuple_common(state, &stup) {
        switch state->status:
            case TSS_INITIAL:
                if state->memtupcount >= state->memtupsize:
                    grow_memtuples(state)
                state->memtuples[state->memtupcount++] = *tuple
                if state->bounded:
                    make_bounded_heap(state)
                inittapes(state) {
                    int maxTapes = tuplesort_merge_order(state->allowedMem) + 1
                    tapeSpace = (int64) maxTapes *TAPE_BUFFER_OVERHEAD
                    /* 创建临时文件 */
                    PrepareTempTablespaces()
                    state->tapeset = LogicalTapeSetCreate(maxTapes)
                    state->mergenext = palloc0(maxTapes * sizeof(int))
                    state->mergeavailslots = palloc0(maxTapes * sizeof(int))
                    ...
                    ntuples = state->memtupcount
                    state->memtupcount = 0
                    for j = 0; j < ntuples; j++
                        SortTuple stup = state->memtuples[j]
                        tuplesort_heap_insert(state, &stup, 0, false)
                    ...
                    state->status = TSS_BUILDRUNS
                }
                dumptuples(state, false) {
                    while state->memtupcount >= state->memtupsize:
                        /* = writetup_heap */
                        WRITETUP(state, state->tp_tapenum[state->destTape], &state->memtuples[0])
                        tuplesort_heap_siftup(state, true)
                        if state->memtupcount == 0 || state->currentRun != state->memtuples[0].tupindex:
                            markrunend(state, state->tp_tapenum[state->destTape])
                            state->currentRun++
                        if state->memtupcount == 0:
                            break
                        selectnewtape(state)
                }
            case TSS_BOUNDED:
                if COMPARETUP(state, tuple, &state->memtuples[0]) <= 0:
                    free_sort_tuple(state, tuple)
                else:
                    free_sort_tuple(state, &state->memtuples[0])
                    tuplesort_heap_siftup(state, false)
                    tuplesort_heap_insert(state, tuple, 0, false)
            case TSS_BUILDRUNS:
                if COMPARETUP(state, tuple, &state->memtuples[0]) >= 0:
                    tuplesort_heap_insert(state, tuple, state->currentRun, true)
                else:
                    tuplesort_heap_insert(state, tuple, state->currentRun + 1, true)
                dumptuples(state, false)
    }

/* 3 排序 */
void tuplesort_performsort(Tuplesortstate *state)
    switch state->status:
        case TSS_INITIAL:  /* 可在内存存放所有tup */
            if state->memtupcount > 1:
                if state->onlyKey != NULL:
                    qsort_ssup(state->memtuples, state->memtupcount, state->onlyKey)
                else:
                    qsort_tuple(state->memtuples, state->memtupcount, state->comparetup, state)
                state->current = 0;
                state->status = TSS_SORTEDINMEM
        case TSS_BOUNDED: /* 使用堆排消除多余tup*/
            sort_bounded_heap(state)
            state->status = TSS_SORTEDINMEM
        case TSS_BUILDRUNS:
            dumptuples(state, true) /* 将内存中所有元组写到持久化存储tape */
            mergeruns(state) /* 合并执行 */
```

## 2.2 tup读写

```c
writetup_heap(Tuplestorestate *state, void *tup)
    MinimalTuple tuple = (MinimalTuple) tup

```
