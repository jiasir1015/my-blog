+++
title = '工具 gdb'
date = '2025-10-15T16:41:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['工具']
weight = 900
ShowToc = true
TocOpen = true
+++
1.  查看某个进程占用的内存

    ```bash
    ps -p 17286 --no-headers -o pid,comm,rss,%mem | awk '{printf "%-8s %-20s %8.2f MB  %5s%%\n", $1, $2, $3/1024, $4}'
    ```

2.  gdb调试进程或coredump文件时，变量取值出现’optimized out’时，关闭编译优化

    ```bash
    # 以编译PG为例：
    configure --enable-debug --disable-optimizations CFLAGS="-g -O0 -fno-inline -fno-omit-frame-pointer"
    ```

3.  gdb启动调试阶段，自动执行命令

    ```bash
    touch ~/.gdbinit
    echo "handle SIGUSR2 nostop noprint" >> ~/.gdbinit
    ```

4.  判断编译选项

    ```bash
    readelf --debug-dump=info `which bin_name` | grep -E 'DW_AT_producer.*O[0-9]'
    ```
