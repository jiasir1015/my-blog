+++
title = '数据库安全 统一管理'
date = '2025-01-25T21:10:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['安全']
weight = 500
ShowToc = true
TocOpen = true
+++
# 2 使用方法

## 2.1 设置安全策略

-   表级

    ```sql
    CREATE TABLE t1 (c1 INT, c2 TEXT);

    -- 1 身份认证

    -- 2 安全传输

    -- 3 安全审计
    CREATE SECURITY POLICY ad1 ON t1 USE (type='security audit', scope='create, insert, update');

    -- 4 访问控制
    CREATE SECURITY POLICY ac1 ON t1 USE (type='access control', group='user1, user2, user3');

    -- 5 数据发现

    -- 6 数据防篡改
    CREATE SECURITY POLICY lga ON t1 USE (type='ledger');

    -- 7 加密函数

    -- 8 透明加密
    CREATE SECURITY POLICY se1 ON t1 USE (type='storage encrypt', key='key1');

    -- 9 数据脱敏
    CREATE SECURITY POLICY ms1 ON t1 USE (type='mask', type='money');

    -- 10 全密态加密
    CREATE SECURITY POLICY ce1 ON t1 USE (type='client encrypt', key='key1');

    -- 11 机密计算
    ```

-   列级

    ```sql
    -- 10 全密态加密
    CREATE SECURITY POLICY ce1 ON t1(c1) USE (type='client encrypt', key='key1');
    ```

## 2.2 管理安全策略
