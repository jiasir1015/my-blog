+++
title = 'PostgreSQL 1-5 initdb'
date = '2025-02-26T18:14:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL']
weight = 105
ShowToc = true
TocOpen = true
+++
# initdb 流程

opengauss

```python
main # initdb.cpp
    canonicalize_path # PGDATA
    find_other_exec # 在gs_initdb bin目录下，查找gaussdb bin
    # 在$GAUSSHOME/share/postgrsql目录下，检查以下文件是否存在
    check_input('postgres.bki, postgres.description, pg_hba.conf.sample, postgresql.conf.sample, ..., system_views.sql, ...')
    check_locale_encoding
    init_log
        gs_getenv_r('GAUSSLOG')
    write_version_file
        canonicalize_path('$PGDATA/PG_VERSION')
        fprintf(PG_MAJORVERSION = '9.2')
    setup_config
        readfile('$GAUSSHOME/share/postgrsql/postgresql.conf.sample')
        sprintf_s('$PGDATA/postgresql.conf')
        writefile('$PGDATA/postgresql.conf')
    InitUndoSubsystemMeta

    bootstrap_template1
    write_version_file
    setup_auth
    get_set_pwd
    setup_depend
    load_plpgsql
    setup_sysviews
    setup_description
    ...
    setup_privileges
    setup_schema
    setup_update
    vacuum_db
    make_template0
    make_postgres
```
