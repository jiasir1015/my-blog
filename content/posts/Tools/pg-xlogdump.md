+++
title = '工具 pg_xlogdump'
date = '2026-06-10T18:58:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['PostgreSQL']
weight = 900
ShowToc = true
TocOpen = true
+++
```bash
# 单文件
pg_xlogdump 000000010000000000000001

# 多文件，指定lsn开始
pg_xlogdump -s 0/1000020 000000010000000000000001

# 多文件，整个目录
pg_xlogdump -p /opt/openGauss/data/pg_xlog

SELECT pg_current_wal_lsn();

\! pg_xlogdump -p $GAUSSHOME/data/pg_xlog -s

num=1640180680
printf "%X/%X\n" $((num >> 32)) $((num & 0xFFFFFFFF))
# 示例： 0/61c32bc8

pg_xlogdump -s 0/61c32bc8  -x 131128

printf "%x\n" 1640180680
# 示例： 61c32bc8
pg_xlogdump -s 000000010000000100000061  -x 131128
```
