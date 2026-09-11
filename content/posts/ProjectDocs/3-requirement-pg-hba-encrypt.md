+++
title = '海量 3 需求 pg_hba.conf加密'
date = '2025-04-01T15:42:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['PostgreSQL', '加密', '需求文档']
weight = 300
ShowToc = true
TocOpen = true
+++
# 1 需求背景

1.  客户使用vb什么版本？ 2215
2.  客户的要求：

# 2 需求分析

## 2.1 适配点

在使用vastbase的多个阶段，都可能涉及pg_hba.conf

-   编译安装
-   初始化
-   升级
-   配置
    -   gs_guc修改pg_hba
    -   手动编辑pg_hba
-   启动
-   运维
    -   pg_backup
    -   pg_rewind
    -   vb_ctl restart

## 2.2 代码流程

-   编译
-   初始化

    ```python
    main # initdb.cpp
        canonicalize_path # PGDATA
        find_other_exec # 在gs_initdb bin目录下，查找gaussdb bin
        # 在$GAUSSHOME/share/postgrsql目录下，检查以下文件是否存在
        check_input('postgres.bki, postgres.description, pg_hba.conf.sample, postgresql.conf.sample, ..., system_views.sql, ...')
        check_locale_encoding
        init_log
            gs_getenv_r('GAUSSLOG')
            canonicalize_path('$PGDATA/PG_VERSION')
            fprintf(PG_MAJORVERSION = '9.2')
        setup_config
            readfile("postgresql.conf.sample")
            readfile("pg_hba.sample")
            writefile("pg_hba.conf")
        bootstrap_template1
        write_version_file
        setup_auth
        get_set_pwd
        setup_depend
        load_plpgsql
        setup_sysviews
    ```

-   升级
-   配置
-   启动

    ```python
    pg_ctl
    ```

-   运行

    ```python
    PostmasterMain # postmaster 线程
        InitializeGUCOptions
        getopt_r
        load_hba # 加载hba
        ServerLoop
            ConnCreate
                StreamConnection
            BackendStartup
                PostgresMain # postgres 线程
                    InitBackendWorker
                        InitSession
                            CheckAuthentication
                                PerformAuthentication
                                    port->protocol_config->fn_authenticate
                                        ClientAuthentication
                                            hba_getauthmethod
                                                check_hba
                                                    g_instance.libpq_cxt_comm_parsed_hba_lines # 读取缓存的hba
                                                    if init_user:
                                                        get_default_auth_method
                                                    else:
                                                        check_hostname
                                            sendAuthRequest
                                            recv_and_check_password_packet # 接收客户端的password
                                                crypt_verify
                    for (;;)
                        ReadCommand
                        exec_simple_query('SQL')

    SIGHUB_handler
        load_hba
    ```

-   运维
    -   pg_backup
    -   pg_rewind

# 规避方案

-   password_encryption_type
    -   0: md5
    -   1: sha256+md5
    -   2: sha256
    -   3: sm3
    -   4: scram-sha256

```bash
gs_guc set -D $GAUSSHOME/data -c "listen_addresses='*'"
```

```bash
gs_guc reload -D $GAUSSHOME/data -c "password_encryption_type=1"
vsql -d postgres -U shenkun -W 'vg@12345' -c "show password_encryption_type"
vsql -d postgres -U shenkun -W 'vg@12345' -c "DROP USER u1"

vsql -d postgres -U shenkun -W 'vg@12345' -c "CREATE USER u1 PASSWORD 'u1.password' "
vsql -d postgres -U shenkun -W 'vg@12345' -c "SELECT rolname, rolpassword FROM pg_authid WHERE rolname = 'u1' "

gs_guc reload -D $GAUSSHOME/data -h "host all all 0.0.0.0/0 sha256"
tail $GAUSSHOME/data/pg_hba.conf

vsql -h 172.16.100.134 -d postgres -U u1 -W 'u1.password' -c "SELECT 1"
```
