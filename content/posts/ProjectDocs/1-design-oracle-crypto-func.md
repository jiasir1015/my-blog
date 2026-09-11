+++
title = '海量 1 设计 oracle加密函数'
date = '2025-02-25T09:49:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['Oracle', '加密', '设计文档']
weight = 100
ShowToc = true
TocOpen = true
+++
# 1

1.  设置默认版本

    ```bash
    contrib/pgcrypto/pgcrypto.control

    defaultl_version = '2.0'
    dbcompatibilities = 'A, B, PG'
    ```

2.  生成同名的sql文件

    ```bash
    touch contrib/pgcrypto/pgcrypto-2.0.sql
    ```

3.  安装sql文件

    ```bash
    #  pgcrypto.control与pgcrypt.*.sql文件
    ll $GAUSSHOME/share/postgresql/extension | grep pgcrypto
    ```

4.  加载插件

    ```python
    # 执行：CREATE EXTENSION pgcrypto
        ..
            CreateExtension
                check_valild_extension_name # 检查插件名：要求不含 '-'、不含'..'等路径字符
                get_extension_oid
                    heap_open('pg_extension')
                    systable_beginscan # 遍历系统表 pg_extension：确保插件存在
                read_extension_control_file
                    parse_extension_control_file
                        get_extension_control_filename
                            sprintf("{share}/extension/{extension_name}.control")
                        ParreConfigFp
                        # 获取 directory, default_version, module_pathname, dbcompatibilities 等参数
                get_extension_script_filename
                    get_extension_script_direcotry
                    if name is 'pgcrypto':
                        sprintf("{script_dir}/crypto-a.sql")
                read_extension_script_file
                InsertExtensionTuple # 插入系统表 pg_extension
                execute_extension_script
                ApplyExtensionUpdates
    ```
