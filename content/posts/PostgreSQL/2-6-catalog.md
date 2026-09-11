+++
title = 'PostgreSQL 2-6 Catalog'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL']
weight = 206
ShowToc = true
TocOpen = true
+++
# 1 常用系统表与视图

## 1.1 系统表

## 1.2 视图

-   堆内存（区分线程）

    ```sql
    SELECT * FROM gs_thread_memory_context ORDER BY totalsize DESC;
    ```

-   堆内存（不区分线程）

    ```sql
    SELECT * FROM gs_shared_memory_detail ORDER BY totalsize DESC;
    ```

-   会话

    ```sql
    SELECT * FROM pg_stat_activity;
    ```

# 1 新增系统表

1.  获取空闲的oid

    ```bash
    cd src/include/catalog/
    chmod +x unused_oids
    ./unused_oids
    ```

# 2 读取系统表

创建表时涉及的系统表操作：

```c
heap_create_with_catalog()
    Relation pg_class_desc = heap_open(RelationRelationId)
    Oid old_type_oid = GetSysCacheOid2(TYPENAMENSP)
    Oid relid = GetNewRelFileNode(pg_class_desc)
    Relation new_rel_desc = heap_create(relname)
    ObjectAddress new_type_addr = AddNewRelationType(relname)
    AddNewRelationTuple(pg_class_desc, new_rel_desc)
    AddNewAttributeTuples(relid, new_rel_desc->rd_att)

    ObjectAddress myself, referenced;
    myself.objectId = relid
    referenced.objectId = relnamespace

    recordDependencyOn(&myself, &referenced, DEPENDENCY_NORMAL)
    recordDependencyOnOwner(RelationRelationId, relid)
    recordDependencyOnNewAcl(RelationRelationId, relid)
    recordDependencyOnCurrentExtension(&myself)
    StoreConstraints(new_rel_desc, cooked_constraints)
```

打开系统表

```c
Relation heap_open(Oid relationId, LOCKMODE lockmode)
    Relation r = relation_open(relationId, lockmode)
        LockRelationOid(relationId, lockmode)
        Relation r = RelationIdGetRelation(relationId)
            Relation rd
            RelationIdCacheLookup(relationId, rd)
                RelIdCacheEnt hentry = hash_search(RelationIdCache, relationId)
                rd = hentry->reldesc
            RelationIncrementReferenceCount(rd)
            /* find cache, return */
            if !rd->rd_isvalid:
                if (rd->rd_rel->relkind == RELKIND_INDEX)
                    RelationReloadIndexInfo(rd);
                else:
                    RelationClearRelation(rd)
                return rd;
            /* no cache, so build */
            rd = RelationBuildDesc(relationId)
                HeapTuple pg_class_tuple = ScanPgRelation(targetRelId)
                relid = HeapTupleGetOid(pg_class_tuple)
                Form_pg_class relp = (Form_pg_class) GETSTRUCT(pg_class_tuple)
                relation = AllocateRelationDesc(relp)
                RelationGetRelid(relation) = relid
                RelationBuildTupleDesc(relation)
                if ..:
                    RelationBuildRuleLock(relation)
                if ..:
                    RelationBuildTriggers(relation)
                if ..:
                    RelationBuildRowSecurity(relation)
                RelationParseRelOptions(relation, pg_class_tuple)
                RelationInitLockInfo(relation)
                RelationInitPhysicalAddr(relation)
                heap_freetuple(pg_class_tuple)
            RelationIncrementReferenceCount(rd)
        pgstat_initstats(r)

typedef struct {
	Oid reloid;
	Relation reldesc;
} RelIdCacheEnt;
```

扫描系统表

```c
ScanPgRelation()
```
