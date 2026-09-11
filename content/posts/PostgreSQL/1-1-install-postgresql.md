+++
title = 'PostgreSQL 1-1 源码安装 (linux / macos)'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '访问控制']
weight = 101
ShowToc = true
TocOpen = true
+++
**摘要**

> 本文介绍介绍如何在2种个人PC中，使用源码安装PostgreSQL，包括：
>
> -   在Windows操作系统中，如何基于VwWare虚拟机，搭建Linux环境。并在Linux中，通过postgreSQL源码进行编译安装。
> -   在MacOS操作系统中，如何使用云服务器中的Linux操作系统，搭建postgreSQL源码编译与学习环境。

**目录**  

1.  [1 在Windows中安装PostgreSQL](#1-%E5%9C%A8Windows%E4%B8%AD%E5%AE%89%E8%A3%85PostgreSQL)
    1.  [1.1 目的](#1-1-%E7%9B%AE%E7%9A%84)
    2.  [1.2 准备](#1-2-%E5%87%86%E5%A4%87)
    3.  [1.3 编译源码](#1-3-%E7%BC%96%E8%AF%91%E6%BA%90%E7%A0%81)
    4.  [1.4 配置快捷命令](#1-4-%E9%85%8D%E7%BD%AE%E5%BF%AB%E6%8D%B7%E5%91%BD%E4%BB%A4)
2.  [2 在MacOS中安装PostgreSQL](#2-%E5%9C%A8MacOS%E4%B8%AD%E5%AE%89%E8%A3%85PostgreSQL)
    1.  [2.1 问题](#2-1-%E9%97%AE%E9%A2%98)
    2.  [2.2 调研云服务商](#2-2-%E8%B0%83%E7%A0%94%E4%BA%91%E6%9C%8D%E5%8A%A1%E5%95%86)
    3.  [2.3 选择云服务器](#2-3-%E9%80%89%E6%8B%A9%E4%BA%91%E6%9C%8D%E5%8A%A1%E5%99%A8)
    4.  [2.4 配置云服务器](#2-4-%E9%85%8D%E7%BD%AE%E4%BA%91%E6%9C%8D%E5%8A%A1%E5%99%A8)
    5.  [2.5 下载postgreSQL源码](#2-5-%E4%B8%8B%E8%BD%BDpostgreSQL%E6%BA%90%E7%A0%81)

# 1 在Windows中安装PostgreSQL

## 1.1 目的

通过postgreSQL源码进行编译安装，主要目的是：

1.  方便通过源码调试跟踪
2.  直接修改以增加调试信息或新功能

## 1.2 准备

首先，介绍如何准备centOS虚拟机，并安装git、VSCode、gdb等工具

1.  已有windows 10/11 x86物理机
2.  window 10中，安装vmware
3.  vmware中，安装centOS虚拟机

    > [http://mirrors.huaweicloud.com/centos/8.4.2105/isos/x86_64/](http://mirrors.huaweicloud.com/centos/8.4.2105/isos/x86_64/)

4.  centOS中，安装git，以及中文输入法
5.  centOS中，安装VSCode

    > [https://code.visualstudio.com/docs/setup/linux#\_rhel-fedora-and-centos-based-distributions](https://code.visualstudio.com/docs/setup/linux#_rhel-fedora-and-centos-based-distributions)

6.  centOS中，安装PostgresSQL依赖的第三方开源软件

    ```bash
    sudo yum install -y readline readline-devel openssl openssl-devel zlib zlib-devel

    # 但是，部分linux可能会裁剪应用，因此可能需要安装如下软件
    sudo yum install -y bison bison-devel flex flex-devel

    #[参考](https://blog.csdn.net/Linjingke32/article/details/80393576)
    ```

7.  安装调试工具

    ```bash
    sudo yum install gdb
    ```

## 1.3 编译源码

接下来，介绍如何在centOS中，下载、配置、编译、启动postgreSQL

1.  准备源码目录，配置环境变量

    ```bash
    mkdir ~/pg_9.2.4
    cd ~/pg_9.2.4
    ```

2.  下载PostgresSQL 9.2.4源码，并解压

    ```bash
    wget https://ftp.postgresql.org/pub/source/v9.2.4/postgresql-9.2.4.tar.gz

    # 备用方法：https://www.postgresql.org/ftp/source/v9.2.4/
    tar -zxvf postgresql-9.2.4.tar.gz

    # 备注：建议初始化为git仓库，并上传到云端备份，以防因误改代码至代码无法编译
    ```

3.  准备环境变量

    ```bash
    echo 'export BUILD_ROOT=`pwd`' > pgenv
    echo 'export PG_HOME=$BUILD_ROOT/install' >> pgenv
    echo 'export PATH="$PG_HOME/bin:$PATH"' >> pgenv
    source pgenv
    ```

4.  编译源码

    ```bash
    cd postgresql-9.2.4
    ./configure --prefix=$PG_HOME --enable-debug
    make install -sj

    # debian
    ./configure --prefix=$PG_HOME --enable-debug --without-readline --without-zlib
    ```

5.  生成日志文件并启动数据库服务器

    ```bash
    mkdir $PG_HOME/log && touch $PG_HOME/log/server.log
    initdb -D $PG_HOME/data
    pg_ctl -D $PG_HOME/data/ -l $PG_HOME/log/server.log start
    ps ux | grep bin/postgres
    ```

6.  连接数据库

    ```bash
    psql -h localhost -p 5432 -d postgres

    windows cmd 查找局域网ip
    for /L %i IN (1,1,254) DO ping -w 2 -n 1 192.168.137.%i

    shell pageup补齐
    https://blog.csdn.net/enzesheng/article/details/42319117

    vim 右键粘贴
    https://www.shuzhiduo.com/A/o75NZEl95W/

    安装旧版本软件
    apt search xxx
    示例：
    apt install flex-old

    # pg 各版本源码
    https://www.postgresql.org/ftp/source/

    # vscode 插件
    https://marketplace.visualstudio.com/VSCode
    ```

apt install libreadline-dev

## 1.4 配置快捷命令

```bash
alias pmake='make -sj 16 && make install -sj'
alias pinit='rm -rf $PG_HOME/data && initdb -D $PG_HOME/data'
alias pstart='pg_ctl start -D $PG_HOME/data -l logfile'
alias pstop='pg_ctl stop -D $PG_HOME/data -l logfile'
```

# 2 在MacOS中安装PostgreSQL

## 2.1 问题

在macOS中，下载并配置postgreSQL依赖的开源组件时，频繁碰壁。遂决定租一台云服务主机，编译并运行postgreSQL。

## 2.2 调研云服务商

国内运服务商众多，优惠条件各不相同。在简单调查后，选择价格较低者。

| 云服务商 | 0元试用 | 条件 | 最低配置价格 |
| --- | --- | --- | --- |
| 阿里云 | 有 | 仅新用户有一次机会 | 1core 2g 24/3mon |
| 华为云 | 有 | 每日9.30开抢 |  |
| 腾讯云 | 有 | 仅新用户有一次机会 | 2core 2g 6.6/mon |
| 天翼云 | 无 | 低价秒杀 1core 2g 33/year | 1core 2g 122/year |
| 金山云 | 无 | 无 | 2core 4g 576/year |
| 移动云 | 有 | 仅新用户有一次机会 | 2core 4g 28/mon |
| 百度云 | 无 | 无 | 1core 1g 34/mon |
| 浪潮云 | 无 | 无 | 垃圾 |

## 2.3 选择云服务器

1.  选择购买低价阿里云云服务器
2.  在安装操作系统时，选择centOS 7.6
3.  更改或设置root密码，用于ssh登录
4.  在个人电脑上，使用命令行连接远程主机

    ```bash
    ssh root@ip
    ```

## 2.4 配置云服务器

1.  安装git

    ```bash
    yum install git
    ```

2.  创建新用户

    ```bash
    useradd lorand
    passwd lorand
    ```

    在个人电脑上，进行测试：

    ```bash
    ssh lorand@{IP}
    ```

3.  安装code-server  
    忽略两次失败尝试：

    ```bash
    # fail
    https://cloud.tencent.com/developer/article/1655175

    # fail
    git clone https://gitee.com/mirrors/code-server.git
    https://gitee.com/mirrors/code-server?_from=gitee_search
    curl -fsSL https://code-server.dev/install.sh | sh
    ```

    接下来，是成功尝试

    > 参考：[https://zhuanlan.zhihu.com/p/493434939](https://zhuanlan.zhihu.com/p/493434939)

首先，将安装包下载到个人电脑

> [https://link.zhihu.com/?target=https%3A//github.com/coder/code-server/releases/download/v4.2.0/code-server_4.2.0_amd64.deb](https://link.zhihu.com/?target=https://github.com/coder/code-server/releases/download/v4.2.0/code-server_4.2.0_amd64.deb)

然后，将安装包上传到云服务器：

```bash
https://github.com/coder/code-server/releases

scp ./code-server_4.2.0_amd64.deb lorand@182.92.66.91:~
```

最后，在云服务器上，使用root角色进行安装

```bash
su
yum install dpkg
dpkg -i code-server_4.2.0_amd64.deb
exit
```

4.  运行code-server  
    配置端口号

    ```bash
    vi ~/.config/code-server/config.yaml
    # bind-addr: 0.0.0.0:3000
    ```

    运行

    ```bash
    code-server --port 3000 --host 0.0.0.0 --auth password
    code-server 或 nohup code-server &
    ```

    在个人电脑上，使用浏览器，连接code-server

    ```uri
    182.92.66.91：3000
    ```

    但是，由于云服务器有防火墙，到这步应该连接失败。还需要最后一步。

5.  配置云服务防火墙  
    在阿里云控制台，”网络与安全“->”安全组”中，新增防火墙规则：目的端口：3000，允许连接

6.  最终效果：

    ![install.codeserver](/images/PostgreSQL/1-1-install-postgresql/install.codeserver.png)

## 2.5 下载postgreSQL源码

参考另一篇编译安装postgreSQL的博客，本部分不再赘述。

```bash
su
yum install -y readline readline-devel openssl openssl-devel zlib zlib-devel bison bison-devel flex flex-devel
exit

git clone https://gitee.com/lorand/postgresql_9.2.4.git

echo 'export BUILD_ROOT=`pwd`' > pgenv
echo 'export PG_HOME=$BUILD_ROOT/install' >> pgenv
echo 'export PATH="$PG_HOME/bin:$PATH"' >> pgenv
source pgenv
cd postgresql_9.2.4
./configure --prefix=$PG_HOME --enable-debug
make install -sj
mkdir $PG_HOME/log && touch $PG_HOME/log/server.log

initdb -D $PG_HOME/data
pg_ctl -D $PG_HOME/data/ -l $PG_HOME/log/server.log start
ps ux | grep bin/postgres

psql -d postgres
# CREATE USER pglorand WITH PASSWORD 'gauss@123';

# 在阿里云控制台，新增安全组：目的端口：5432

vi pg_hba.conf
# host all all 0.0.0.0/0 trust
vi postgres.conf
# listen_addresses = ’*‘

psql -d postgres -U pglorand
```

另外，还可在个人电脑上，连接远程postgreSQL服务器，效果：

![install.succeed](/images/PostgreSQL/1-1-install-postgresql/install.succeed.png)
