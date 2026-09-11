+++
title = '强制访问控制'
date = '2026-03-16T14:28:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '访问控制']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 背景

## 1.1 友商分析

-   oracle

    -   范围：行级、列级
    -   实现：动态谓词过滤
-   金仓

    -   范围：列级
-   mysql

    -   无
-   sql server

    -   范围：行级
    -   实现：谓词过滤
-   oracle

    -   基于标签的访问控制OLS：绝密HS、机密S、秘密C、公开P
        -   [https://docs.oracle.com/en/database/oracle/oracle-database/26/olsag/part1.html#GUID-C20C62AE-2A30-45F9-AEEA-52A0D3286FBA](https://docs.oracle.com/en/database/oracle/oracle-database/26/olsag/part1.html#GUID-C20C62AE-2A30-45F9-AEEA-52A0D3286FBA)

            ```sql
            -- 1 定义策略
            SA_SYSDBA.CREATE_POLICY(policy_name => 'HR_POLICY', column_name => 'HR_LABEL')
            -- 2 定义标签
            SA_COMPONENTS.CREATE_LEVEL('HR_POLICY', 1000, 'PUBLIC', 'P');
            -- 3 设置标签属性
            SA_USER_ADMIN.SET_LEVELS('HR_POLICY', 'SCOTT', 'C', 'S');
            SA_USER_ADMIN.SET_COMPARTMENTS('HR_POLICY', 'SCOTT', 'FIN');
            -- 4 插入数据（主动定义标签）
            INSERT INTO employees (emp_id, emp_name, salary, HR_LABEL)
            VALUES (1001, 'John Doe', 50000, CHAR_TO_LABEL('HR_POLICY', 'C:FIN'));
            ```

-   sql server：无

-   kngbase

    -   行级
    -   链接：[https://help.kingbase.com.cn/v8/safety/safety-guide/label-and-mac.html#id5](https://help.kingbase.com.cn/v8/safety/safety-guide/label-and-mac.html#id5)
    -   范围：table, view, index, procedure, function, package, sequence, trigger, synonym
    -   原则：下读、区间写

        ```sql
        -- 创建策略
        SELECT sysmac.create_policy ('p1','p1_c',false); -- 策略名、在表上新增1列p1_c、是否隐藏策略列
        -- 创建等级
        SELECT sysmac.create_level('p1','l1',10); -- 策略名、等级名、等级值
        -- 创建范围
        SELECT sysmac.create_compartment('p1','c4',100); -- 策略名、策略下的范围、范围的ID
        -- 创建标记
        SELECT sysmac.create_label('p1','l1:c4',11); -- 策略名、标记名、标记的ID

        -- 设置用户等级
        SELECT sysmac.set_levels('p1','u1','l5','l2','l4','l3');
            -- 策略名、用户名、读写最高等级、写最低等级、用户默认等级、写等级
        -- 设置用户范围
        SELECT sysmac.set_compartments('p1','u1','c1,c2,c3,c4,c5','c1,c2,c3','c1,c2,c4', 'c1,c2');
            -- 策略名、用户名、读权限范围列表、最大写权限范围列表、默认读权限范围列表、默认写范围列表、最小写权限范围
        -- 设置用户标记
        SELECT sysmac.set_user_labels('p1', 'u1', 'l5:c1,c2,c3,c4,c5', 'l5:c1,c2,c3', 'l2:', 'l4:c1,c2,c4', 'l3:c1,c2');
            -- 策略名、用户名、最大读标记、最大写标记、写标记、最小写标记、用户默认标记
        -- 设置用户特权
        -- 设置表行级策略
        sysmac.apply_table_policy(policy_name, schema_name, table_name)
        -- 设置对象策略
        sysmac.apply_obj_policy(policy_name,object_type,schema_name,object_name,label)
        -- ..
        ```

        完整实例

        ```sql
        alter system set sysmac.enable_mac=on;
        -- 创建策略
        select sysmac.create_policy ('p1','p1_column',true);
        -- 创建等级
        select sysmac.create_level('p1','general',10);
        select sysmac.create_level('p1','privacy',20);
        select sysmac.create_level('p1','secret',30);
        -- 设置范围
        select sysmac.create_compartment('p1','manager',40);
        -- 创建用户 urd_manager uqa_manager ugeneral_manager
        00 为用户设置
        select sysmac.set_user_labels('p1','ugeneral_manager', 'secret:manager,qa,unimportant', 'secret:manager,qa','secret:', 'secret:', 'secret:manager,qa');
        --
        ```

## 1.2 友商实现

oracle实现

```sql
CREATE TABLE t1 (
  id NUMBER,
  sec_label DB2SECURITYLABEL  -- 标签列
) SECURITY POLICY DataAccess;

GRANT SECURITY LABEL DataAccess.SecretLabel TO USER JOE FOR READ ACCESS;
```
