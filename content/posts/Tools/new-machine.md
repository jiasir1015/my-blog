+++
title = '工具 配置新环境'
date = '2025-01-24T16:14:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['工具']
weight = 900
ShowToc = true
TocOpen = true
+++
0.  设置bash

    ```bash
    export PS1="[\e[35;1m][\$(date +'%m-%d/%H:%M:%S')][\e[36;1m]\w [\e[0m]\n> "
    ```

1.  安装code-servels

    -   [https://blog.zhaokeyong.cn/archives/CentOScode-server](https://blog.zhaokeyong.cn/archives/CentOScode-server)  
        安装3.4版本，方便

        ```bash
        # 1 从本地机器上，找到code-server所在文件夹
        cd /home/shenkun/vscode
        mkdir allpkg
        # 放插件的目录
        cp -r ~/.local allpkg
        cp -r ./code-server allpkg
        tar -zcvf allpkg.tar.gz allpkg

        cd /home/shenkun/vscode
        tar -zxvf allpkg.tar.gz
        mv allpkg/code-server ./
        rm -rf ~/.local/share/code-server/*
        mv allpkg/.local/share/code-server/* ~/.local/share/code-server

        nohup ./code-server &

        # 设置配置文件
        vi ~/.config/code-server/config.yaml
        bind-addr: 0.0.0.0:3000
        auth: password
        password: password
        cert: false

        nohup ./code-server &
        ```

        常用插件：
    -   c/c++
    -   gitlens
    -   markdown preview enhanced
2.  安装 oracle

    -   [https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001006330](https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001006330)
3.  配置core文件目录

    ```bash
    mkdir /core
    chmod 777 /core

    echo "1" >> /proc/sys/kernel/core_uses_pid
    echo "/core/core-%e-%p-%t" > /proc/sys/kernel/core_pattern

    vi /etc/security/limits.conf
    # 在末尾增加以下2行：记得带星号*
    * hard core unlimited
    * soft core unlimited
    ```

4.  配置git

    ```bash
    git config --global user.name "shenkun"
    git config --global user.email "shenkun@bupt.cn"

    ssh-keygen -t rsa -C "shenkun@bupt.cn"
    cat ~/.ssh/id_rsa
    ```
