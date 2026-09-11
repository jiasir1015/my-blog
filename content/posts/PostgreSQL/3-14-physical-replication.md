+++
title = 'PostgreSQL 3-14 物理复制'
date = '2026-06-05T09:56:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL']
weight = 314
ShowToc = true
TocOpen = true
+++
# 1 物理复制基本原理

## 1.1 使用场景

介绍为什么需要物理复制

## 1.2 相关原理

介绍什么是wal，wal是用来干嘛的

## 1.3 实现思路

介绍如何基于wal，实现物理复制，并解决1.1中的问题

# 2 物理复制使用方式

## 2.1 使用物理复制

# 3 物理复制工作流程

## 3.1 整体架构

包括Postgres生成wal，walwriter存储wal，walsender发送wal，walreceive接收wal，startup重放wal，checkpoint/bgwriter等。

## 3.2 工作流程

参考2.1，梳理完整的工作流程，从主机执行SQL语句开始，到最终备机达到同样效果

# 4 物流复制实现源码

参考2.1，介绍每一阶段的关键原理，另外，包括wal日志格式等

你好，我要基本当前目录下的代码，生成一份流复制的skill，所以，接下来的对话，都和这件事有关。
