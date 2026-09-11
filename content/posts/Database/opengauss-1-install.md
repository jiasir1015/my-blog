+++
title = 'openGauss 1 安装openGauss'
date = '2025-02-20T14:06:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['openGauss']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 安装wsl

请自行在网上了解wsl是什么，以及如何在wsl中安装centos 7：

1.  在windows 11中，启用wsl
2.  下载centos 7的wsl 安装包
3.  在wsl中，安装centos 7
4.  进入centos 7，创建普通用户，建议使用mobaxterm直接登录wsl中的centos系统
5.  配置centos 7的yum源

# 2 准备环境

1.  下载opengauss源码

    ```bash
    git clone -b master git@gitee.com:opengauss/openGauss-server.git
    ```

2.  下载第三方库

    ```bash
    wget https://opengauss.obs.cn-south-1.myhuaweicloud.com/latest/binarylibs/gcc10.3/openGauss-third_party_binarylibs_Centos7.6_x86_64.tar.gz
    ```

3.  解压第三方库

    ```bash
    # 解压压缩包
    tar -zxvf openGauss-third*

    # 归档压缩包
    mkdir tmp
    mv *.tar.gz tmp

    # 重命名压缩包
    mv openGauss-third* third
    ```

4.  下载依赖库

    ```bash
    yum install -y libaio-devel flex bison ncurses-devel patch readline-devel

    # 单独安装 glibc-devel
    yum install glibc-devel
    # 如果报错，提示安装了.i686版本的glibc-devel，则修改yum配置文件：
    #   echo "exclude=*.i686" >> /etc/yum.conf

    # 如果报错，提示glibc-devel与glibc-common不匹配，则降级glibc和glibc-common
    #   yum downgrade glibc glibc-devel glibc-common glibc-headers
    # 降级后，再重新安装 glibc-devel 即可
    #   yum install glibc-devel
    ```

5.  设置环境变量  
    首先，请确保目录结构如下：

    ```bash
    |-- 父目录
        |-- openGauss-server
        |-- third
    ```

    在父目录下，生产环境变量脚本：

    ```bash
    echo "
    export CODE_BASE=`pwd`/openGauss-sever
    export BINARYLIBS=`pwd`/third
    export GAUSSHOME=`pwd`/install
    export GCC_PATH=$BINARYLIBS/buildtools/gcc10.3
    export CC=$GCC_PATH/gcc/bin/gcc
    export CXX=$GCC_PATH/gcc/bin/g++
    export LD_LIBRARY_PATH=$GAUSSHOME/lib:$GCC_PATH/gcc/lib64:$GCC_PATH/isl/lib:$GCC_PATH/mpc/lib/:$GCC_PATH/mpfr/lib/:$GCC_PATH/gmp/lib/:$LD_LIBRARY_PATH
    export PATH=$GAUSSHOME/bin:$GCC_PATH/gcc/bin:$PATH
    " > oenv
    ```

# 3 编译openGauss

1.  设置环境变量

    ```bash
    source oenv
    ```

2.  配置编译选项

    ```bash
    cd openGauss-server

    ./configure --gcc-version=10.3.0 CC=g++ CFLAGS='-O0' --prefix=$GAUSSHOME --3rd=$BINARYLIBS --enable-debug --enable-cassert --enable-thread-safety --with-readline --without-zlib
    ```

3.  编译数据库

    ```bash
    # 以下命令中，参数j表示，并发编译数据库，10表示并发数，如果不设置数字10，则默认并发数为CPU核数，即所有CPU核都参与编译，这样可能会导致系统卡住，因此最好将并发数设置为小于CPU核数的数字。我的CPU是20核，因此，将并发数设置为10
    make -sj 10
    ```

4.  收集编译结果

    ```bash
    # 将上一步生产的编译结果，统一收集到环境变量$GAUSSHOME目录下
    # 社区的编译脚本有点问题，建议make install命令中，不要加参数j
    make install -s
    ```

# 4 安装openGauss

1.  初始化数据库

    ```bash
    gs_initdb -D $GAUSSHOME/data1 -w "gauss@123" --nodename='node1'
    ```

2.  启动数据库

    ```bash
    gs_ctl start -D $GAUSSHOME/data1 -Z single_node
    ```

3.  连接数据库

    ```bash
    gsql -d postgres
    ```

4.  停止数据库

    ```bash
    gs_ctl stop -D $GAUSSHOME/data1
    ```

```bash
alias gcode='cd /home/shenkun/openGauss-server'
alias genv='gcode && cd .. && source ./oenv'
alias ginstall='cd $GAUSSHOME'
alias gcfg='gcode && git clean -xdf && ./configure --gcc-version=10.3.0 CC=g++ CFLAGS='-O0' --prefix=$GAUSSHOME --3rd=$BINARYLIBS --enable-debug --enable-cassert --enable-thread-safety --with-readline --without-zlib'
alias gmake='gcode && make -sj 10 && make install -s'
alias ginit='rm -rf  $GAUSSHOME/data && gs_initdb -D $GAUSSHOME/data -w "gauss@123" --nodename='node1''
alias gstart='gs_ctl start -D $GAUSSHOME/data'
alias gstop='gs_ctl start -D $GAUSSHOME/data'
alias grestart='gs_ctl restart -D $GAUSSHOME/data'
alias ggdb='gdb attach `pidof gaussdb`'
alias gcore='ll /core'
```
