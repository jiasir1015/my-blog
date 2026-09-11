+++
title = 'PostgreSQL 3-9 Vacuum'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '存储引擎']
weight = 312
ShowToc = true
TocOpen = true
+++
# 1 概述

```sql
select reltuples,relhasoids,oid from pg_class where relname = 't1';
-- reltuples = 0
select pg_relation_filepath('t1');
-- oid = filepath = relfilenode

vacuum full t1;
select reltuples,relhasoids,oid from pg_class where relname = 't1';
-- oid 不变, reltuples = 0
-- oid != filepath = relfilenode !=

analyze t1;
-- reltuples = 2，即有效tuple
```

1.  启动autovacuum进程

    ````c
    standard_ProcessUtility(Node *parsetree)
        case T_VacuumStmt:
            ExecVacuum(VacuumStmt *vacstmt)
                vacuum(RangeVar *relation, Oid relid, VacuumParams *params)

    ServerLoop(void)
        StartAutoVacLauncher(void)
            AutoVacLauncherMain()
                /* if fail: 发送信号重启aotuvacuum进程 */
                SendPostmasterSignal(PMSIGNAL_START_AUTOVAC_WORKER)

    sigusr1_handler(SIGNAL_ARGS)
        if CheckPostmasterSignal(PMSIGNAL_START_AUTOVAC_WORKER):
            StartAutovacuumWorker(void)
                Backend *bn = malloc();
                bn->pid = StartAutoVacWorker(void)
                    AutoVacWorkerMain(int argc, char *argv[])()
                        BaseInit();
                        InitPostgres(NULL, dbid, NULL, InvalidOid, dbname)
                        do_autovacuum()
                            autovacuum_do_vac_analyze(autovac_table *tab)
                                vacuum(RangeVar *relation, Oid relid, VacuumParams *params)
                        proc_exit(0)
                dlist_push_head(&BackendList, &bn->elem)
    ````

    2. 查找所有待vacuum的表
    ```c
    do_autovacuum(void) /* table-by-table */
        StartTransactionCommand()

        /* 查询pg_database系统表 */
        tuple = SearchSysCache1(DATABASEOID)

        /* 打开pg_class系统表 */
        classRel = heap_open(RelationRelationId)
        pg_class_desc = CreateTupleDescCopy(RelationGetDescr(classRel))

        /* 为toast表创建hash表 */
        table_toast_map = hash_create()

        /* 遍历pg_class系统表，记录所有需要vacuum和analyze的普通表和系统表 */
        relScan = heap_beginscan_catalog(classRel)
        while tuple = heap_getnext(relScan) != NULL:
            Form_pg_class classForm = (Form_pg_class) GETSTRUCT(tuple)
            relid = HeapTupleGetOid(tuple)

            relopts = extract_autovac_opts(tuple, pg_class_desc)
            tabentry = get_pgstat_tabentry_relid(relid, classForm->relisshared)
            /* 检查表是否需要被vacuum和analyze */
            relation_needs_vacanalyze(relid, relopts, classForm, tabentry, &dovacuum, &doanalyze)

            if dovacuum || doanalyze:
                /* 普通表加入list中 */
                table_oids = lappend_oid(table_oids, relid)

                /* toast表加入hash表中 */
                if OidIsValid(classForm->reltoastrelid):
                    hentry = hash_search(table_toast_map, &classForm->reltoastrelid, HASH_ENTER)
                    hentry->ar_relid = relid
        eap_endscan(relScan)

        /* 第二次遍历pg_class系统表 */
        relScan = heap_beginscan_catalog(classRel)
        while tuple = heap_getnext(relScan) != NULL:
            Form_pg_class classForm = (Form_pg_class) GETSTRUCT(tuple)
            relid = HeapTupleGetOid(tuple)

            relopts = extract_autovac_opts(tuple, pg_class_desc)
            ...

        bstrategy = GetAccessStrategy(BAS_VACUUM)

        /* 开始遍历所有list中的表 */
        foreach(cell, table_oids)
            Oid relid = lfirst_oid(cell)
            /* 再次检查是否仍需vacuum */
            tab = table_recheck_autovac(relid, table_toast_map, pg_class_desc)
            if tab == NULL:
                continue

            MyWorkerInfo->wi_tableoid = relid
            autovac_balance_cost()
            AutoVacuumUpdateDelay()

            autovacuum_do_vac_analyze(tab, bstrategy)

        vac_update_datfrozenxid()
        CommitTransactionCommand()
    ````

2.  对单个表进行vacuum

    ```c
    autovacuum_do_vac_analyze(autovac_table *tab, BufferAccessStrategy bstrategy)
        autovac_report_activity(tab)
        vacuum(tab->at_vacoptions, tab->at_relid, bstrategy) {
            relations = get_rel_oids(relid, relation) /* if relid == InvalidOid: 遍历pg_class，否则直接返回 */

            foreach(cur, relations):
                Oid relid = lfirst_oid(cur)
                if options & VACOPT_VACUUM:
                    if !vacuum_rel(relid, relation, options, params)
                        continue
                if options & VACOPT_ANALYZE:
                    analyze_rel(relid, relation, options, params, val_cols)

            if options & VACOPT_VACUUM && !IsAutoVacuumWorkerProcess():
                /* 更新pg_database系统表，清空pg_clog */
                vac_update_datfrozenxid()
        }

    /* 执行vacuum */
    vacuum_rel(Oid relid, RangeVar *relation, int options)
        if !options & VACOPT_FULL:
            ...

        lmode = (options & VACOPT_FULL) ? AccessExclusiveLock : ShareUpdateExclusiveLock
        if !(options & VACOPT_NOWAIT):
            onerel = try_relation_open(relid, lmode)
        else if ConditionalLockRelationOid(relid, lmode):
            onerel = try_relation_open(relid, NoLock)

        / 检查权限 **/
        if !pg_class_ownercheck(RelationGetRelid(onerel), GetUserId()) || pg_database_ownercheck(MyDatabaseId, GetUserId()):
            ereport()

        /* 检查表的类型 */
        if onerel->rd_rel->relkind != {RELKIND_RELATION, RELKIND_MATVIEW, RELKIND_TOASTVALUE}:
            ereport()
        if RELATION_IS_OTHER_TEMP(onerel):
            return false

        if options & VACOPT_FULL:
            relation_close(onerel, NoLock)
            /* 执行VACUUM FULL：新建1个文件，把旧文件中的有效数据复制到新文件中 */
            cluster_rel(relid, InvalidOid, false) { //cluster_rel(Oid tableOid, Oid indexOid, bool recheck, bool verbose)
                Relation OldHeap = try_relation_open(tableOid, AccessExclusiveLock)
                if recheck: /* 检查权限 */

                rebuild_relation(OldHeap, indexOid, verbose) {
                    is_system_catalog = IsSystemRelation(OldHeap)
                    OIDNewHeap = make_new_heap(tableOid, tableSpace, AccessExclusiveLock)

                    copy_heap_data(OIDNewHeap, tableOid, indexOid) {
                        NewHeap = heap_open(OIDNewHeap, AccessExclusiveLock)
                        OldHeap = heap_open(OIDOldHeap, AccessExclusiveLock)

                        oldTupDesc = RelationGetDescr(OldHeap)
                        newTupDesc = RelationGetDescr(NewHeap)

                        vacuum_set_xid_limits(OldHeap, 0, 0, 0, 0, &OldestXmin, &FreezeXid)

                        is_system_catalog = IsSystemRelation(OldHeap)
                        rwstate = begin_heap_rewrite(OldHeap, NewHeap, OldestXmin, FreezeXid)

                        if OldIndex != NULL && !use_sort:
                            indexScan = index_beginscan(OldHeap, OldIndex)
                        else:
                            /* 顺序扫描*/
                            heapScan = heap_beginscan(OldHeap)

                        /* 顺序扫描所有tuple */
                        for (;;)
                            tuple = heap_getnext(heapScan)
                            buf = heapScan->rs_cbuf

                            switch (HeapTupleSatisfiesVacuum(tuple, OldestXmin, buf)):
                                case HEAPTUPLE_DEAD:
                                    isdead = true
                                case HEAPTUPLE_RECENTLY_DEAD:
                                    tups_recently_dead += 1
                                case HEAPTUPLE_LIVE:
                                    isdead = false
                                case HEAPTUPLE_INSERT_IN_PROGRESS:
                                    isdead = false

                            if isdead:
                                if rewrite_heap_dead_tuple(rwstate, tuple):
                                    tups_vacuumed += 1
                                    tups_recently_dead -= 1
                                continue

                            num_tuples += 1
                            if tuplesort != NULL:
                                tuplesort_putheaptuple(tuplesort, tuple)
                            else:
                                reform_and_rewrite_tuple(tuple, oldTupDesc, newTupDesc, values, isnull, rwstate) {
                                    heap_deform_tuple(tuple, oldTupDesc, values, isnull);
                                    copiedTuple = heap_form_tuple(newTupDesc, values, isnull)
                                    rewrite_heap_tuple(rwstate, tuple, copiedTuple) { /* rewrite_heap_tuple(RewriteState state,HeapTuple old_tuple, HeapTuple new_tuple) */
                                        heap_freeze_tuple(new_tuple->t_data, state->rs_freeze_xid,state->rs_cutoff_multi)
                                        ...
                                        raw_heap_insert(state, new_tuple) {
                                            log_newpage() /* 一次记录一个page */
                                            smgrextend()
                                        }
                                    }
                                }
                        heap_endscan(heapScan)

                        end_heap_rewrite(rwstate)
                    }

                    finish_heap_swap(tableOid, OIDNewHeap, is_system_catalog)
                }
            }
        else:
            /* 执行LAZY VACUUM */
            lazy_vacuum_rel(onerel, options, params, vac_strategy)

        if onerel:
            relation_close(onerel, NoLock)

        if toast_relid != InvalidOid:
            vacuum_rel(toast_relid, relation, options, params)
    ```

# 2 工作流程

## 2.1 auto_vacuum

```python
AutoVacWorkerMain
    do_autovacuum
        table_beginscan_catalog
        for each:
            relation_needs_vacanalyze
            lappend_oid # 添加待vacuum表
        for each:
            autovacuum_do_vac_analyze
            vacuum
                if not relation
                    get_all_vacuum_rels
                    table_beginscan_catalog
                    for loop
                        if not vacuum_is_relation_owner:
                            continue
                for each:
                    vacuum_rel
                    analyze_rel
                        vacuum_open_relation
                        do_analyze_rel
```

## 2.2 vacuum

```python
standard_ProcessUtility
    ExecVacuum
        vacuum
```

## 2.3 vacuum relation

```python
standard_ProcessUtility
    ExecVacuum
        vacuum
```

## 2.4 opengauss

-   vacuum or vacuum relation

    ```python
    standard_ProcessUtility
        DoVacuumMppTable
            do_vacuum_mpp_table_other_node
                vacuum
                    get_rel_oids
                    for each:
                        vacuum_rel
                        analyze_rel
                            analyze_rel_internal
    ```
