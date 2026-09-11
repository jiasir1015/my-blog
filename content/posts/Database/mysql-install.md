+++
title = 'mysql 1 安装mysql'
date = '2025-02-24T11:24:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['MySQL']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 安装mysql

```bash
# root
yum -y install wget cmake gcc gcc-c++ ncurses ncurses-devel libaio-devel openssl openssl-devel
yum -y install cmake3

# 普通用户
cd ~
mkdir mysql && cd mysql
wget https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-boost-8.0.17.tar.gz
tar -zxvf mysql-boost-8.0.17.tar.gz
mkdir backup && mv *.tar.gz backup

mkdir install data boost
cd mysql-boost*

cmake3 . -DCMAKE_INSTALL_PREFIX=`pwd`/../install -DMYSQL_DATADIR=`pwd`/../data -DSYSCONFDIR=`pwd`/../data -DMYSQL_TCP_PORT=3306 -DWITH_BOOST=`pwd`/../boost \
-DDEFAULT_CHARSET=utf8 -DDEFAULT_COLLATION=utf8_general_ci -DENABLED_LOCAL_INFILE=ON -DWITH_INNODB_MEMCACHED=ON -DWITH_INNOBASE_STORAGE_ENGINE=1 -DWITH_FEDERATED_STORAGE_ENGINE=1 -DWITH_BLACKHOLE_STORAGE_ENGINE=1 -DWITH_ARCHIVE_STORAGE_ENGINE=1 -DWITHOUT_EXAMPLE_STORAGE_ENGINE=1  -DWITH_PERFSCHEMA_STORAGE_ENGINE=1
```
