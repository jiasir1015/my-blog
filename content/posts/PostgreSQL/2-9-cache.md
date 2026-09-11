+++
title = 'PostgreSQL 2-9 cache'
date = '2025-02-26T18:10:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL']
weight = 209
ShowToc = true
TocOpen = true
+++
```python
@vb
GaussDBThteadMain
    BackendRun
        PostgresMain
                PostgresInitializer::InitBackendWorker
                    ::InitSession
                        ::InitSysCache # 1 初始化缓存
                            RelationCacheInitializePhase2
                                if lsc:
                                    LocalTabDefCache::InitPhase2
                                        Formrdesc("vb_profiles“")
                                else:
                                    formrdesc("vb_profiles“)
                            InitCatalogCache
                        ::CheckAuthentication
                                PerformAuthentication
                                    ClientAuthentication
                        ::InitUser
                            InitializeSessionUserId
                        ::SetDatabase
                            ::SetDatabaseByName
                                ::InitSessionDatabase
                            ::LockDataBase
                        ::LoadSysCache # 2 初始化缓存
                            RelationCacheInitializePhase3
                                if lsc:
                                    LocalTabDefCache::InitPhase3
                                        LoadCriticalIndex
                                else:
                                    load_critical_index(ProfileRelationId)
                        InitDatabase
                        FinishInit
```

```python
InitCatalogCache

RelationCacheInitialize
```
