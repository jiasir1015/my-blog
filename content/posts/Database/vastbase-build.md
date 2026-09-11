+++
title = 'Vastbase 搭建环境、编译代码、安装数据库'
date = '2025-02-08T16:44:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['Vastbase']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 准备开发环境

## 1.1 登录远程windows

1.  连接vpn  
    下载vpn软件，使用入职时他人帮忙申请的vpn账号登录
2.  登录远程windows电脑  
    使用入职时他人帮忙申请的远程windows账号
3.  登录gitlab  
    入职时，有人已帮忙申请gutlab账号。[http://172.16.19.246](http://172.16.19.246/)
4.  查看vastbase代码  
    [http://172.16.19.246/VastbaseG100/src](http://172.16.19.246/VastbaseG100/src)
    -   默认无权限，可能搜不到，请找小组领导开通权限

## 1.2 准备vastbase编译环境

在远程windows中，登录远程centos

1.  配置git  
    生成rsa密钥，配置到gitlab中
2.  下载vastbase源码

    ```bash
    mkdir g100
    cd g100
    git clone -b master git@172.16.19.246:VastbaseG100/src.git
    ```

3.  下载vastbase依赖的二进制文件  
    需要自行通过svn下载，然后，上传到vastbase源码同级目录  
    在文件管理器中，输出`ftp://172.16.19.4`后，会提示输出账号和密码
    -   ip: 172.16.19.4
    -   用户名: clouder
    -   密码: 自行询问
    -   目录: /Database/Vastbase/third_party
4.  配置用于编译vastbase的环境变量

    ```bash
    cd g100
    touch venv
    ```

    请确保此时的目录结构如下：

    ```bash
    ls g100

    |-- g100
        |-- src
        |-- binarylibs
        |-- venv
    ```

    设置环境变量

    ```bash
    export CODE_BASE=`pwd`
    export BINARYLIBS=`pwd`/binarylibs
    # 安装目录在源码里写死了，改不了
    export GAUSSHOME=`pwd`/src/mppdb_temp_install
    export GCC_PATH=$BINARYLIBS/buildtools/gcc7.3
    export CC=$GCC_PATH/gcc/bin/gcc
    export CXX=$GCC_PATH/gcc/bin/g++

    export LD_LIBRARY_PATH=$GAUSSHOME/lib:$GCC_PATH/gcc/lib64:$GCC_PATH/isl/lib:$GCC_PATH/mpc/lib/:$GCC_PATH/mpfr/lib/:$GCC_PATH/gmp/lib/:$LD_LIBRARY_PATH
    export PATH=$GAUSSHOME/bin:$GCC_PATH/gcc/bin:$PATH

    # 以下是vastbase增加的
    export PATH=$BINARYLIBS/buildtools/cmake/bin:$PATH
    ```

5.  配置快捷命令

    ```bash
    cd $CODE_BASE
    source venv

    echo "
    alias vcode='cd /home/shenkun/g100'
    alias venv='vcode && source ./venv'
    alias vinstall='vcode && cd src/mppdb_temp_install'
    alias vmake='vcode && cd src && sh build.sh -m debug -3rd $BINARYLIBS -svn 11'
    alias vcmake='vcode && cd src && sh build.sh -m debug -3rd $BINARYLIBS -svn 11 -cmake'
    alias vrecmake='vcode && cd src/tmp_build && make -sj && make install -sj'
    alias vinit='vb_initdb -D $GAUSSHOME/data -w vb.12345 --nodename=db1'
    alias vstart='vb_ctl start -D $GAUSSHOME/data'
    alias vrestart='vb_ctl restart -D $GAUSSHOME/data'
    " >> ~/.bashrc

    source ~/.bashrc
    ```

6.  安装其他依赖工具

    ```bash
    # 切换到root用户
    yum install -y libaio-devel flex bison ncureses-devel patch readline-devel python3

    # 修改系统默认python版本
    rm -f /usr/bin/python
    ln -s /usr/bin/python3.6 /usr/bin/python
    ```

## 1.3 准备vastbase开发环境

1.

```sql
scp shenkun@172.16.100.134:~/vscode/allpkg.tar.gz
# 密码 vg@123
```

2.

```bash
tar -zxvf allpkg.tar.gz
cd allpkg
mv ./.local/share/code-server ~/.local/share
```

3.

```bash
cd code-server
./code-server
#
```

# 1 安装数据库

## 1.1 编译

由于已配置快捷命令，此处直接用快捷命令

```bash
# 设置环境变量
venv
# 编译代码
vcmake
# 进入安装目录
vinstall
# 增量变量
vrecmake
```

不用快捷命令的话：

```bash
# 设置环境变量
cd /home/shenkun/g100
source venv
# 编译代码
cd src
sh build.sh -m debug -3rd $BINARYLIBS -svn 11 -cmake
# 进入安装目录
cd $GAUSSHOME
```

## 1.2 安装

1.  初始化数据库

    ```bash
    vb_initdb -D $GAUSS/data --nodename=db1
    ```

2.  启动数据库

    ```bash
    vb_ctl start -D $GAUSS/data
    ```

3.  重启数据库

    ```bash
    vb_ctl restart -D $GAUSS/data
    ```

# 1.3 连接数据库

```bash
vsql -p 5432 -d postgres -r -c "ALTER USER $USER PASSWORD 'vast@123'"

vsql -p 5432 -d postgres -r
```

# 其他环境

## 1.1 通过ftp访问共享软件库

## 1.2 通过svn访问共享文档库

## 1.3 安装其他软件

### wps office

# 2 加解密函数

## 一、desencrypt函数

### vastbase旧函数

-   格式

    ```sql
    -- 参数
    dbms_obfunction_toolkit.desencrypt(plian, key) -> cipher

    -- 参数类型
        -- raw: 16进制编码，约等于bytea，只是无\x前缀
        -- text: 密文自动转换为 base64编码
    desencrypt(text, text) -> text
    desencrypt(bytea, bytea) -> bytea
    desencrypt(raw, raw) -> raw
    ```

-   输出

    ```sql
    CREATE EXTENSION pgcrypto;

    SELECT dbms_obfuscation_toolkit.desencrypt('11111111', '11111111')::bytea::raw;
    -- 输出 5A56366D4B4D396957463845572B4B732F67447777513D3D
    SELECT dbms_obfuscation_toolkit.desencrypt('11111111'::bytea::raw, '11111111'::bytea::raw);
    -- 输出 5A56366D4B4D396957463845572B4B732F67447777513D3D
    SELECT dbms_obfuscation_toolkit.desencrypt('11111111'::bytea, '11111111'::bytea)::raw;
    -- 输出 5A56366D4B4D396957463845572B4B732F67447777513D3D

    SELECT dbms_obfuscation_toolkit.desencrypt('1111111111111111', '11111111')::bytea::raw;
    -- 输出 5A56366D4B4D3969574638673037696D356C654861387A616167394370743236
    ```

### oracle函数

-   格式

    ```sql
    -- 参数
    dbms_obfuscation_toolkit.desdecrypt(plain, key, OUT cipher)
    -- 参数类型
    desdecrypt(varchar2, varchar2, varchar2)
    desdecrypt(raw, raw, raw)
    ```

-   输出
    -   raw 类型

        ```sql
        CREATE OR REPLACE FUNCTION desencrypt(plain VARCHAR2, key VARCHAR2)
        RETURN VARCHAR2 IS
            cipher RAW(100);
        BEGIN
            dbms_obfuscation_toolkit.desencrypt(utl_raw.cast_to_raw(plain), utl_raw.cast_to_raw(key), encrypted_data=>cipher);
            RETURN rawtohex(cipher);
        END;
        /

        SELECT desencrypt('11111111', '11111111') FROM dual;
        SELECT utl_raw.cast_to_raw(dbms_obfuscation_toolkit.desencrypt(input_string=>'11111111', key_string=>'11111111')) FROM dual;
        -- 输出 655EA628CF62585F
        SELECT utl_raw.cast_to_raw(dbms_obfuscation_toolkit.desencrypt(input_string=>'1111111111111111', key_string=>'11111111')) FROM dual;
        SELECT desencrypt('1111111111111111', '11111111') FROM dual;
        -- 输出 655EA628CF62585F20D3B8A6E657876B
        ```

    -   varchar 类型

        ```sql
        CREATE OR REPLACE FUNCTION desencrypt(plain VARCHAR2, key VARCHAR2)
        RETURN VARCHAR2 IS
            cipher VARCHAR2(100);
        BEGIN
            dbms_obfuscation_toolkit.desencrypt(plain, key, encrypted_string=>cipher);
            RETURN cipher;
        END;
        /

        SELECT utl_raw.cast_to_raw(desencrypt('11111111', '11111111')) FROM dual;
        -- 输出 655EA628CF62585F

        -- 换个格式
        DECLARE
            cipher VARCHAR2(200);
        BEGIN
            dbms_obfuscation_toolkit.desencrypt('11111111', '11111111', encrypted_string=>cipher);
            dbms_output.put_line(utl_raw.cast_to_raw(cipher));
        END;
        /
        ```

## 二、des3encrypt函数

### vastbase旧函数

-   格式

    ```sql
    -- (一) 参数
    dbms_obfuscation_toolkit.des3encrypt(plain, key, iv) -> cipher
        -- input_string key_string encrypted_string / encrypted_data
        -- key为16字节，超过16字节的未被使用
    -- 参数类型
    des3encrypt(text, text, text) -> raw
    des3encrypt(bytea, bytea, bytea) -> bytea
    des3encrypt(raw, raw, raw) -> raw

    -- (二) 参数
    dbms_obfuscation_toolkit.des3encrypt(plain, key, keymode = 0) -> cipher
    -- 参数类型
    des3encrypt(text, text, int = 0) -> raw
    des3encrypt(bytea, bytea, int = 0) -> bytea
    des3encrypt(raw, raw, int = 0) -> raw

    -- （三）参数
    dbms_obfuscation_toolkit.des3encrypt(plain, key, keymode, iv) -> cipher
    des3encrypt(text, text, int, text) -> raw
    des3encrypt(bytea, bytea, int, bytea) -> bytea
    des3encrypt(raw, raw, int, raw) -> raw
    ```

-   输出

    ```sql
    -- (一)
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', '11111111')::bytea::raw;
    -- ERROR: wrong key
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111122222222', '11111111')::bytea::raw;
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111'::bytea, '1111111122222222'::bytea, '11111111'::bytea)::raw;
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111'::bytea::raw, '1111111122222222'::bytea::raw, '11111111'::bytea::raw);
    -- 输出 4F7A536633345072325939536B547A776c334C6278513D3D

    -- （二）
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111122222222')::bytea::raw;
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111122222222', 0)::bytea::raw;
    -- 输出 5465744A2B552B384E73504B7671372B2B36424D38413D3D
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111', '111111112222222211111111', 1)::bytea::raw;
    -- ERROR: wrong key
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111', '111111112222222233333333', 1)::bytea::raw;
    -- 输出 5A56366D4B4D3966957463845572B4B732F67447777513D3D

    -- (三)
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111122222222', 0, '11111111')::bytea::raw;
    -- 输出 4F7A536633345072325939536B547A776c334C6278513D3D
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111', '111111112222222233333333', 1, '11111111')::bytea::raw;
    -- 输出 51494A71574142676A49635143695859617366464C413D3D
    ```

### oracle函数

-   格式

    ```sql
    -- (一) 参数
    dbms_obfuscation_toolkit.des3encrypt(plain, key, OUT cipher, keymode = 0, iv = NULL)
            -- input_string key_sgring encrypted_string which iv_string
        -- input key encrypted_data which iv
    -- 参数类型
    des3encrypt(varchar2, varchar2, varchar2, int = 0, varchar2 = NULL)
    des3encrypt(raw, raw, raw, int = 0, raw = NULL)
    ```

-   输出

    ```sql
    DECLARE cipher VARCHAR2(200); BEGIN
        dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', encrypted_string=>cipher);
        dbms_output.put_line(utl_raw.cast_to_raw(cipher));
    END;
    /
    -- 输出 C7E61EC9A68F8C02
    DECLARE cipher VARCHAR2(200); BEGIN
        dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', encrypted_string=>cipher, which=>0, iv_string=>NULL);
        dbms_output.put_line(utl_raw.cast_to_raw(cipher));
    END;
    /
    -- 输出 C7E61EC9A68F8C02
    DECLARE cipher RAW(200); BEGIN
        dbms_obfuscation_toolkit.des3encrypt('3131313131313131', '31313131313131313131313131313131', encrypted_data=>cipher, which=>0, iv=>'0123456789abcdef');
        dbms_output.put_line(cipher);
    END;
    /
    -- 输出 C7E61EC9A68F8C02
    DECLARE cipher RAW(200); BEGIN
        dbms_obfuscation_toolkit.des3encrypt(hextoraw('3131313131313131'), hextoraw('31313131313131313131313131313131'), encrypted_data=>cipher, which=>0, iv=>hextoraw('0123456789abcdef'));
        dbms_output.put_line(cipher);
    END;
    /
    -- 输出 C7E61EC9A68F8C02
    DECLARE cipher VARCHAR2(200); BEGIN
        dbms_obfuscation_toolkit.des3encrypt(hextoraw('11111111'), '1111111111111111', encrypted_string=>cipher, which=>0, iv_string=>NULL);
        dbms_output.put_line(utl_raw.cast_to_raw(cipher));
    END;
    /
    -- 输出 C7E61EC9A68F8C02

    DECLARE cipher VARCHAR2(200); BEGIN
        dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', encrypted_string=>cipher, which=>0, iv_string=>hextoraw('0123456789abcdef'));
        dbms_output.put_line(utl_raw.cast_to_raw(cipher));
    END;
    /
    -- 输出 6FFB37B42D9EB72E

    DECLARE cipher VARCHAR2(200); BEGIN
        dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', encrypted_string=>cipher, which=>0, iv_string=>'11111111');
        dbms_output.put_line(utl_raw.cast_to_raw(cipher));
    END;
    /
    -- 输出 40826A5800607C87

    DECLARE cipher VARCHAR2(200); BEGIN
        dbms_obfuscation_toolkit.des3encrypt('11111111', '111111112222222233333333', encrypted_string=>cipher, which=>1, iv_string=>'11111111');
        dbms_output.put_line(utl_raw.cast_to_raw(cipher));
    END;
    /
    -- 输出 40826A5800608C8

    DECLARE cipher VARCHAR2(200); BEGIN
        dbms_obfuscation_toolkit.des3encrypt('1111111111111111', '1111111111111111', encrypted_string=>cipher);
        dbms_output.put_line(utl_raw.cast_to_raw(cipher));
    END;
    /
    -- 输出 C7E61EC9A68F8C02165CEC3E75635F5D
    ```

-   问题单

    ```sql
    select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('1111111111111111', key_string=>010199010401050110974949, which=>0)) from dual;
    -- 输出 E7E14DFD9E0DED3B D80084E1EDD76DF1

    select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('1111111111111111', key_string=>'101990104010501109749490', which=>0)) from dual;
    -- 输出 E7E14DFD9E0DED3B D80084E1EDD76DF1

    select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('1111111111111111', key_string=>'010199010401050110974949', which=>0)) from dual;
    -- 输出 6BD3D44F21050468F90eD91712B47B4C

    DECLARE cipher VARCHAR2(200); BEGIN
        dbms_obfuscation_toolkit.des3encrypt('1111111111111111', '101990104010501109749490', encrypted_string=>cipher, which=>0, iv_string=>NULL);
        dbms_output.put_line(utl_raw.cast_to_raw(cipher));
    END;
    /
    -- 输出 7E14DFD9E0DED3B D80084E1EDD76DF1
    ```

[http://172.16.19.246/VastbaseG100/src/-/merge_requests/13079/diffs](http://172.16.19.246/VastbaseG100/src/-/merge_requests/13079/diffs)
