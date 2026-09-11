+++
title = '海量 6 设计 greenplum'
date = '2025-05-15T16:36:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['设计文档']
weight = 600
ShowToc = true
TocOpen = true
+++
# 1 需求分析

1.  透明加密
    -   主密钥
2.  动态脱敏
    -   和统一审计共用resource lable模块
3.  全密态
    -   密态等值
    -   密态非等值
        -   范围查询：OPE保序加密
        -   模糊查询
        -   内置函数
        -   排序
        -   ..
4.  防篡改
    -   分布式：有点麻烦，区块链记录在每个节点上
    -   哈希函数：md5

## 1.1 透明加密

-   模块分析
    -   密钥管理
        -   设置主密钥
    -   定义加密属性
        -   表：普通表、临时表、分区表、toast表
        -   索引
        -   xlog
    -   加密数据
        -   加密算法：aes-256-ctr, sm4-ctr
        -   备机加密

```sql
-- 创建主密钥

-- 设置表加密
CREATE TABLE t1 (c1 INT, c2 TEXT) WITH (enable_tde=on);

-- 验证数据加密存储
INSERT INTO t1 VALUES (1, 'bbbcccddd');
```

## 1.2 动态脱敏

```sql
-- 开启脱敏功能
gs_guc reload -D $GAUSSHOME/data -c "enable_security_policy=on"

-- 创建表
CREATE TABLE t1 (c1 TEXT, c2 TEXT);
INSERT INTO t1 VALUES ('bbccdd', 'bbccdd');

-- 创建用户
CREATE USER u1 PASSWORD 'u1.password';
CREATE USER u2 PASSWORD 'u2.password';
GRANT SELECT ON t1 TO u1;
GRANT SELECT ON t1 TO u2;

-- 创建资源标签（只对u1脱敏）
CREATE RESOURCE LABEL l1 ADD COLUMN(t1.c1);
CREATE MASKING POLICY m1 randommasking ON LABEL(l1) FILTER ON ROLES(u1);

-- 验证脱敏：只有u1脱敏
SET ROLE u1 PASSWORD 'u1.password';
SELECT * FROM t1;
RESET ROLE;

SET ROLE u2 PASSWORD 'u2.password';
SELECT * FROM t1;
RESET ROLE;

-- 清理环境
DROP MASKING POLICY m1;
DROP RESOURCE LABEL l1;
DROP TABLE t1;
DROP USER u1,u2;
```

## 1.3 全密态

-   模块分析
    -   客户端
        -   语法解析
        -   语义分析
        -   加密
    -   服务端
        -   ..

## 1.4 防篡改

-   hash算法：md5

# 2 greenplum

```bash
yum install zstd libzstd-devel krb5-devel krb5-libs cyrus-sasl-gssapi libevent-devel libyaml-devel libxml2 libxml2-devel curl libcurl-devel
yum install apr apr-devel apr-util apr-util-devel
yum install expat-devel openldap-devel bzip2 bzip2-devel xerces-c xerces-c-devel python36-devel

ln -s /usr/include/python2.7/Python.h /usr/include/Python.h

# 报错就降级
yum downgrade expat-2.1.0-12.el7

mkdir install
cd install
# echo ''使用单引号可防止变量$PATH等展开
echo '
export GPHOME=`pwd`/install

export BINARYLIBS=`pwd`/../third
export GCC_PATH=$BINARYLIBS/buildtools/gcc10.3
export CC=$GCC_PATH/gcc/bin/gcc
export CXX=$GCC_PATH/gcc/bin/g++
export LD_LIBRARY_PATH=$GCC_PATH/gcc/lib64:$GCC_PATH/isl/lib:$GCC_PATH/mpc/lib/:$GCC_PATH/mpfr/lib/:$GCC_PATH/gmp/lib/:$LD_LIBRARY_PATH
export PATH=$GCC_PATH/gcc/bin:$PATH
' > genv
# 建议把环境变量再在~/.bashrc中写一份，因为初始化集群时，需要ssh登录，以初始化segment节点

./configure --with-python --with-libxml --with-gssapi  --without-zlib --with-gpcc --prefix=$GPHOME
make -sj 16
make install -sj 16

echo "
ARRAY_NAME="Greenplum Cluster"
SEG_PREFIX=gpseg #segment数据库前缀名
PORT_BASE=40000 #segment数据库起始端口号
declare -a DATA_DIRECTORY=(//home/shenkun/gp/install/segdata)
#segments数据目录，有几个DATA_DIRECTORY, 每个节点上便会启动几个segment，本例为2个segment
MASTER_HOSTNAME=master #master主机名
MASTER_DIRECTORY=/home/shenkun/gp/install/master #master数据目录
MASTER_PORT=5000 #master端口号，也是对外业务端口号
TRUSTED_SHELL=ssh
CHECK_POINT_SEGMENTS=8
ENCODING=UNICODE
DATABASE_NAME=gpdb
MACHINE_LIST_FILE=/home/shenkun/gp/install/hostfile #集群配置文件，hostfile对应7中创建的文件名
" > gpcfg

echo "master" > hostfile

gpinitsystem -c gpcfg -a

psql -p 5000 -d gpdb

PGOPTIONS='-c gp_session_role=utility' psql -p 40000 -d gpdb

```

```bash
# @ master
exec_simple_query
    pg_parse_query
    pg_analyze_and_rewrite
    pg_plan_queries
        pg_plan_querie
            planner
                standard_planner
                    subquery_planner
                    cdbllize_adjust_top_path
                    create_plan
                    cdbpathtoplan_create_flow
                        makeFlow
                    cdbllize_decorate_subplans_with_motions
    PortalStart
        ExecutorStart
            standard_ExecutorStart
                CdbDispatchPlan
                                                                    # @ segment
                                                                    exec_mpp_query
                                                                        deserializeNode
                                                                            PortalStart
                                                                            PortalRun
                                                                            PortalDrop
    PortalRun
        PortalRunMulti
            ProcessQuery
                ExecutorStart
                ExecutorRun
                    standard_ExecutorRun
                        ExecutePlan
                ExecutorFinish
                ExecutorEnd
    PortalDrop
```
