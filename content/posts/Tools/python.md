+++
title = '工具 python'
date = '2025-12-29T14:31:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['工具']
weight = 900
ShowToc = true
TocOpen = true
+++
1.  查看python安装路径

    ```bash
    python -c "import sys, os; print(os.path.dirname(sys.executable))"
    ```

2.  python下载pgk

    ```bash
    python -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple 包名
    ```
