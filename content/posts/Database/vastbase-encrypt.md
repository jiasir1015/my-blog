+++
title = 'vastbase 加密函数'
date = '2025-02-09T16:10:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['Vastbase', '加密']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 需求背景

## 1.1 数据加密背景

-   加密的原理  
    不同场景中，适合的加密算法类型不同。对存储数据加密，通常采用对称密码算法，此处主要介绍对称密码算法：

    -   加密原理：输入1个明文，输入1个密钥，对明文和密钥进行一些运算（比如异或，代换），可得到1个密文。密钥通常是随机生成的。
    -   加密算法：DES算法，发布于1977年，已确定为不安全加密算法。3DES算法，调用3次DES算法，生成3个密钥，安全性与DES差别不大，也属于不安全的加密算法。AES算法，发布于2001年，通用的国际标准
-   数据库加密函数  
    几乎所有数据库，都提供内置加密函数，让用户通过SQL语句调用。最典型的场景如下：

    ```sql
    -- 假设，数据库提供函数encrypt(明文，密钥，加密算法)，输出为密文
    -- 用户想表't1'中存储数据'shenkun'，则存储的语法如下：（用户自己保管密钥）
    INSERT INTO t1 VALUES (encrypt('shenkun', '一串随机的密钥', 'aes'));
    ```

## 1.2 oracle 加密包

早期版本的oracle中，包含1个名为dbms_obfuscation_toolkit的包，提供7个函数，主要实现加密、解密等功能：

-   版本信息：oracle 8i版本开始提供，oracle 10g版本开始不被推荐使用，由dbms_crypto代替，oracle 21c版本正式移除
-   函数列表：
    -   生成随机数：desgetkey(seed) -> key
    -   加密：desencrypt(input, key) -> encrypted_data
    -   解密：descdecrypt(input, key) -> decrypted_data
    -   生成随机数：des3getkey(which=>0, seed) -> key
    -   加密：des3encrypt(input, key, which=>0, iv=>012345678abcdef) -> encrypted_data
    -   解密：des3decrypt(input, key, which=>0, iv=>012345678abcdef) -> decrypted_data
    -   哈希：md5(input) -> checksum
-   函数参数：函数参数有3种数据类型：varchar2, raw。与raw类型相比，如果是varchar2类型，参数名需加上\_string后缀。比如，raw类型的入参名为input，则varcha2类型入参名为input_string
-   函数限制：
    -   desgetkey：seed长度最短为80字节
    -   desencrypt：input长度是8字节的整数倍；key最短为8字节，超过8字节的部分被丢弃
    -   descdecrypt：input长度是8字节的整数倍；key最短为8字节，超过8字节的部分被丢弃
    -   des3getkey: seed长度最短为80字节
    -   des3encrypt：input长度是8字节的整数倍；which为0时，key最短为16字节，超过16字节的部分被丢弃；which为1时，key最短为24字节，超过24字节的部分被丢弃
    -   des3dencrypt：input长度是8字节的整数倍；which为0时，key最短为16字节，超过16字节的部分被丢弃；which为1时，key最短为24字节，超过24字节的部分被丢弃
    -   md5：无
-   参考文档
    -   函数介绍：函数背景、注意事项等：[https://docs.oracle.com/cd/A97630_01/appdev.920/a96590/adgsec04.htm](https://docs.oracle.com/cd/A97630_01/appdev.920/a96590/adgsec04.htm)
    -   函数参数：参数类型、调用示例等：[https://docs.oracle.com/cd/B10500_01/appdev.920/a96612/d_obtoo2.htm](https://docs.oracle.com/cd/B10500_01/appdev.920/a96612/d_obtoo2.htm)

以下是上述函数的调用示例：

1.  创建辅助函数  
    简单封住数据类型转换函数，方便阅读函数：

    ```sql
    CREATE FUNCTION strtoraw(string VARCHAR2) RETURN RAW IS
    BEGIN
    RETURN utl_raw.cast_to_raw(string);
    END;
    /

    CREATE FUNCTION rawtostr(rawdata RAW) RETURN VARCHAR2 IS
    BEGIN
    RETURN utl_raw.cast_to_varchar2(rawdata);
    END;
    /
    ```

2.  DES生成密钥

    ```sql
    SELECT dbms_obfuscation_toolkit.desgetkey(seed=>strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888')) FROM dual;
    -- seed最短长度为80字节，每次输出的值都是随机的，长度为8字节
    ```

3.  DES加密

    ```sql
    SELECT dbms_obfuscation_toolkit.desencrypt(input=>strtoraw('1111111111111111'), key=>strtoraw('11111111')) FROM dual;
    -- 输出 655EA628CF62585F20D3B8A6E657876B
    ```

4.  DES解密

    ```sql
    SELECT rawtostr(dbms_obfuscation_toolkit.desdecrypt(input=>hextoraw('655EA628CF62585F20D3B8A6E657876B'), key=>strtoraw('11111111'))) FROM dual;
    -- 输出 1111111111111111
    ```

5.  3DES生成密钥

    ```sql
    SELECT dbms_obfuscation_toolkit.des3getkey(which=>0, seed=>strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888')) FROM dual;
    -- seed最短长度为80字节，每次输出的值都是随机的，which=0，输出16字节，which=1，输出24字节
    ```

6.  3DES加密

    ```sql
    SELECT dbms_obfuscation_toolkit.des3encrypt(input=>strtoraw('1111111111111111'), key=>strtoraw('1111111122222222'), which=>0, iv=>strtoraw('11111111')) FROM dual;
    -- 输出 0D28E17571051319ACCE2D19D9AED5C8
    ```

7.  3DES解密

    ```sql
    SELECT rawtostr(dbms_obfuscation_toolkit.des3decrypt(input=>hextoraw('0D28E17571051319ACCE2D19D9AED5C8'), key=>strtoraw('1111111122222222'), which=>0, iv=>strtoraw('11111111'))) FROM dual;
    -- 输出 1111111111111111
    ```

8.  MD5哈希

    ```sql
    SELECT dbms_obfuscation_toolkit.md5(input=>strtoraw('1111111111111111')) FROM dual;
    -- 输出 FA1D3EB08A879DE9A4CD9995A1AA91E1
    ```

## 1.3 vasebase 加密包（旧版本）

vastbase也提供dbms_obfuscation_toolkit包，代码在4年前或更早前合入，函数个数，函数名，函数参数等与oracle保持一致：

-   函数列表：
    -   生成随机数：desgetkey(seed) -> key
    -   加密：desencrypt(input, key) -> encrypted_data
    -   解密：descdecrypt(input, key) -> decrypted_data
    -   生成随机数：des3getkey(seed) / des3getkey(which, seed) -> key
    -   加密：des3encrypt(input, key, which = 0) / des3encrypt(input, key, iv) / des3encrypt(input, key, which, iv) -> encrypted_data
    -   解密：des3decrypt(input, key, which = 0) / des3decrypt(input, key, iv) / des3decrypt(input, key, which, iv) -> encrypted_data -> decrypted_data
    -   哈希：md5(input) -> checksum
-   函数参数：函数参数有3种数据类型: text, bytea, raw

以下是上述函数的调用示例：

1.  创建辅助函数与安装加密插件  
    简单封住数据类型转换函数，方便阅读函数：

    ```sql
    CREATE FUNCTION strtoraw(string VARCHAR2) RETURN RAW IS
    BEGIN
    RETURN utl_raw.cast_to_raw(string);
    END;
    /

    CREATE FUNCTION rawtostr(rawdata RAW) RETURN VARCHAR2 IS
    BEGIN
    RETURN utl_raw.cast_to_varchar2(rawdata);
    END;
    /

    -- 安装加解密插件
    CREATE EXTENSION pgcrypto;
    ```

2.  DES生成密钥

    ```sql
    SELECT dbms_obfuscation_toolkit.desgetkey(strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888')) FROM dual;
    -- seed最短长度为80字节，每次输出的值都是随机的，长度为8字节
    ```

3.  DES加密

    ```sql
    SELECT dbms_obfuscation_toolkit.desencrypt(strtoraw('1111111111111111'), strtoraw('11111111')) FROM dual;
    -- 输出 (vastbase) 5A56366D4B4D3969574638673037696D356C65486138A7616167394370743236
    -- 输出（oracle）  655EA628CF62585F20D3B8A6E657876B
    ```

4.  DES解密

    ```sql
    SELECT rawtostr(dbms_obfuscation_toolkit.desdecrypt(hextoraw('655EA628CF62585F20D3B8A6E657876B'), strtoraw('11111111'))) FROM dual;
    -- 输出 (vastbase) ERROR: invalid symbol
    -- 输出（oracle）  1111111111111111
    ```

5.  3DES生成密钥

    ```sql
    SELECT dbms_obfuscation_toolkit.des3getkey(0, strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888')) FROM dual;
    -- seed最短长度为80字节，每次输出的值都是随机的，which=0，输出16字节，which=1，输出24字节
    ```

6.  3DES加密

    ```sql
    SELECT dbms_obfuscation_toolkit.des3encrypt(strtoraw('1111111111111111'), strtoraw('1111111122222222'), 0, strtoraw('11111111')) FROM dual;
    -- 输出 (vastbase) 4F7A53663334507232592F3542747033644975635673765966543477414C5737
    -- 输出（oracle）  0D28E17571051319ACCE2D19D9AED5C8
    ```

7.  3DES解密

    ```sql
    SELECT rawtostr(dbms_obfuscation_toolkit.des3decrypt(hextoraw('0D28E17571051319ACCE2D19D9AED5C8'), strtoraw('1111111122222222'), 0, strtoraw('11111111'))) FROM dual;
    -- 输出 (vastbase) ERROR: invalid symbol
    -- 输出（oracle） 1111111111111111
    ```

8.  MD5哈希

    ```sql
    SELECT dbms_obfuscation_toolkit.md5(strtoraw('1111111111111111')) FROM dual;
    -- 输出 FA1D3EB08A879DE9A4CD9995A1AA91E1
    ```

## 1.4 需求目标

### 需求场景

以前，客户使用oracle，并通过dbms_obfuscation_toolkit插件加密存储数据。现在，客户使用vastbase，并将数据迁移到vastbase中，包括以前由dbms_obfuscation_toolkit插件加密后的数据。在该场景中，需要满足2个要求：

-   解密旧数据：oracle加密数据，将密文迁移至vasebase，vastbase可解密迁移来的密文
-   加密新数据：客户系统中，vastbase与oracle混用，在数据库运维、数据共享等场景中，确保多个系统中数据一致，存在加密新数据的场景

### 需求背景

早在4年前，vastbase也提供了dbms_obfuscation_toolkit包，该包提供7个函数，函数名与函数参数个数与oracle一致。  
但是，实际使用过程中，这7个函数与oracle的函数存在一些差异，在上述场景中，该差异可能导致客户应用不可用。

-   函数输出不一致：比如，相同的加密函数、明文、密钥、加密算法，vastbase与oracle的输出内容、输出长度不一致。
    -   示例：desencrypt()函数，加密16字节，oracle密文为16字节，vastbase密文为32字节，vastbase的密文中，会携带分组填充，并且以base64编码
-   参数约束不一致：比如，相同的加密函数，vastbase与oracle的参数长度限制不一致

### 需求目标

为解决上述问题，本版本的vastbase需达到以下要求：

1.  加密函数输出结果与oracle一致
2.  解密函数输出结果与oracle一致
3.  函数参数约束与oracle一致
4.  保持前向兼容，即可解密旧版本vastbase加密的结果（需用户主动控制加密函数的版本）

### 相关问题

-   bytea特殊字符转换  
    将text转换为bytea的过程中，可能出现text被阶段的问题。  
    比如一串text数据`abc\0cd`，长度为6，转换为bytea的过程为：先将text转换为cstring，再讲csting转换为bytea，由于cstring无法携带数据长度，所以，csting转换为bytea时，根据`\0`来判断数据结尾。

    ```sql
    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', 0, '11111111') FROM dual;
    -- 预期输出：8字节，实际输出：3字节
    des3encrypt
    ------------
    @jx

    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', 0, '11111111')::bytea FROM dual;
    -- 预期输出：8字节，实际输出：4字节（oracle无bytea类型）
    des3encrypt
    ------------
    \x40826a58

    SELECT dbms_obfuscation_toolkit.des3encrypt('11111111'::bytea, '1111111111111111', 0, '11111111') FROM dual;
        des3encrypt
    -------------------
    \x40826a5800608c87

    SELECT utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', 0, '11111111'));
        des3encrypt
    -------------------
     40826A5800608C87
    ```

    在实际使用场景中，示例如下：

    ```sql
    CREATE TABLE t1 (c1 TEXT, c2 BYTEA, c3 RAW, c4 BYTEA);
    -- 加密
    INSERT INTO t1 VALUES (
        dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', 0, '11111111'),
        dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', 0, '11111111')::bytea,
        utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('11111111', '1111111111111111', 0, '11111111')),
        dbms_obfuscation_toolkit.des3encrypt('11111111'::bytea, '1111111111111111', 0, '11111111')
    );
    SELECT * FROM t1;
      c1 |     c2     |         c3       |          c4
    -----+------------+------------------+--------------------
     @jx | \x40826a58 | 40826A5800608C87 | \x40826a5800608c87

    -- 解密
    SELECT dbms_obfuscation_toolkit.des3decrypt(c1, '1111111111111111', 0, '11111111') FROM t1;
    SELECT dbms_obfuscation_toolkit.des3decrypt(c2, '1111111111111111'::bytea, 0, '11111111'::bytea) FROM t1; -- 解密失败
    SELECT dbms_obfuscation_toolkit.des3decrypt(c3, utl_raw.cast_to_raw('1111111111111111'), 0, utl_raw.cast_to_raw('11111111')) FROM t1;
    SELECT dbms_obfuscation_toolkit.des3decrypt(c4, '1111111111111111', 0, '11111111') FROM t1;
    ```

    上述场景中，该问题的规避方法是，建议用户手动强制将入参函数的类型转换为bytea类型。  
    但是，如果用户没有规避，可能会导致c2列解密失败，因此，只能考虑直接禁用bytea类型。可以考虑解决text转bytea的阶段问题，但该问题是公共问题，且影响范围大，本版本来不及解决。  
    oracle只有raw类型，无bytea类型。

    ```sql
    CREATE TABLE t1 (c1 VARCHAR2(100), c2 RAW(100), c3 RAW(100));
    -- 加密
    INSERT INTO t1 VALUES (
        dbms_obfuscation_toolkit.des3encrypt(input_string=>'11111111', key_string=>'1111111111111111', which=>0, iv_string=>'11111111'),
        utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt(input_string=>'11111111', key_string=>'1111111111111111', which=>0, iv_string=>'11111111')),
        dbms_obfuscation_toolkit.des3encrypt(input=>utl_raw.cast_to_raw('11111111'), key=>utl_raw.cast_to_raw('1111111111111111'), which=>0, iv=>utl_raw.cast_to_raw('11111111'))
    );
    SELECT * FROM t1;
    ```

-   raw类型自动转换  
    vastbase的`::raw`实现与`utl_raw.cast_to_raw`不一致

    ```sql
    SELECT dbms_obfuscation_toolkit.desencrypt(utl_raw.cast_to_raw('11111111'), utl_raw.cast_to_raw('11111111')) FROM dual;
    -- 输出 655EA628CF62585F

    SELECT dbms_obfuscation_toolkit.desencrypt('11111111'::raw, '11111111'::raw) FROM dual;
    -- 底层的加解密函数中，输入的长度变成了4字节，输出结果与上面不一致

    SELECT utl_raw.cast_to_raw('11111111') FROM dual;
    -- 输出 3131313131313131
    SELECT '11111111'::raw FROM dual;
    -- 输出 1111111
    ```

    oracle无`::raw`用法

    ```sql
    SELECT dbms_obfuscation_toolkit.desencrypt(input=>utl_raw.cast_to_raw('11111111'), key=>utl_raw.cast_to_raw('11111111')) FROM dual;
    -- 输出 655EA628CF62585F

    SELECT utl_raw.cast_to_raw('11111111') FROM dual;
    -- 输出 3131313131313131
    ```

### 需求实现

为实现上述目标，主要的工作量如下：

-   加密算法：黑盒识别oracle的des与3des算法的具体实现，包括分组加密模式、分组填充、默认IV值等，确保新版本vastbase的输出与oracle一致
-   数据类型：分析不同类型数据之间的相互转换，比如oracle的[varchar2, raw]，vastbase的[text, bytea, raw]
-   前向兼容：识别旧版本vastbase的des与3des算法的具体实现，包括分组加密模式、分组填充、默认IV值、输出输出编码解码等，避免新版本vastbase无法解密旧版本vastbase加密的数据
-   报错信息：旧版本vastbase对异常入参的报错信息较模糊
-   代码质量：旧版本vastbase的加解密函数不符合cleancode规范，参数命名较模糊

### 需求约束

1.  插件版本：安装dbms_obfuscation_toolkit插件时，默认安装新版本插件，如需使用旧版本插件，需主动指定旧版本。新版本插件与旧版本插件不兼容
    -   解释：vastbase旧版本（本需求交付前的版本）插件的加密结果与oracle不一致，vastbase新版本（本需求交付的版本）插件的加密结果与oracle保持一致，因此，vastbase的新版本插件无法解密旧版本插件加密的数据。加密结果中，并没有存储版本号，即无法自动识别加密结果的版本
2.  数据类型：使用dbms_obfuscation_toolkit插件时，加密与解密函数中，参数类型支持text或raw类型，不支持bytea类型
    -   解释：oracle仅支持text和raw类型，无bytea类型。vastbase旧版本插件支持bytea类型，但是，text转bytea时存在截断的公共问题，本版本无法解决，因此，本版本无法支持bytea类型
3.  函数入参：

    | 编号 | 函数 | 参数 | oracle约束 | vasebase约束（旧版本） | vasebase约束（新版本） |
    | --- | --- | --- | --- | --- | --- |
    | 1 | desgetkey(seed) | seed | 长度为[80, max]字节 | 长度为[0, max]字节 | 与oracle一致 |
    | 2 | des3getkey(which, seed) | seed | 长度为[80, max]字节 | 长度为[0, max]字节 | 与oracle一致 |
    | 3 | desencrypt(input, key) | input | 长度为8字节整数倍 | 长度为[0, max]字节 | 与oracle一致 |
    | 4 | desencrypt(input, key) | key | 长度为[8, max] 字节 | 长度为[0, max]字节 | 与oracle一致 |
    | 5 | desdecrypt(input, key) | input | 长度为8字节整数倍 | 长度为[0, max] | 与oracle一致 |
    | 6 | desdecrypt(input, key) | key | 长度为[8, max] 字节 | 长度为[0, max]字节 | 与oracle一致 |
    | 7 | des3encrypt(input, key, which=0，iv) | input | 长度为8字节整数倍 | 长度为[0, max]字节 | 与oracle一致 |
    | 8 | des3encrypt(input, key, which=0，iv) | key | which=0，key长度[16, max]字节；which=1，key长度[24, max]字节 | which=0，key长度[16, max]字节，前8字节与后8字节不能一致。which=1，key长度[24, max]字节，前，中，后8字节不能一致 | 与oracle一致 |
    | 9 | des3encrypt(input, key, which=0，iv) | which | 0或1 | 所有整数，除0和1，其他整数与0效果一致 | 与oracle一致 |
    | 10 | des3encrypt(input, key, which=0，iv) | iv | 长度为8字节整数倍 | 长度为[0, max]字节 | 与oracle一致 |
    | 11 | des3encrypt(input, key, which=0，iv) | input | 长度为8字节整数倍 | 长度为[0, max]字节 | 与oracle一致 |
    | 12 | des3decrypt(input, key, which=0，iv) | key | which=0，key长度[16, max]字节；which=1，key长度[24, max]字节 | which=0，key长度[16, max]字节，前8字节与后8字节不能一致。which=1，key长度[24, max]字节，前，中，后8字节不能一致 | 与oracle一致 |
    | 13 | des3decrypt(input, key, which=0，iv) | which | 0或1 | 所有整数，除0和1，其他整数与0效果一致 | 与oracle一致 |
    | 14 | des3decrypt(input, key, which=0，iv) | iv | 长度为8字节整数倍 | 长度为[0, max]字节 | 与oracle一致 |

# 2 需求分析

## 2.1 主成功场景

### 一、安装不同版本的pgcrypto

1.  查看pgcrypto可用的版本

    ```sql
    SELECT * FROM pg_available_extension_versions WHERE name = 'pgcrypto';
    -- 预期输出 可用版本包括1.2和2.0
    ```

2.  安装pgcrypto-2.0版本

    ```sql
    CREATE EXTENSION pgcrypto;

    SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
    -- 预期输出 默认版本为 2.0
    -- 源码中，有pgcrypto.control控制

    DROP EXTENSION pgcrypto;
    ```

3.  安装pgcrypto-1.2版本

    ```sql
    CREATE EXTENSION pgcrypto WITH VERSION '1.2';;

    SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
    -- 预期输出 版本为 1.2

    DROP EXTENSION pgcrypto;
    ```

4.  从pgcrypto-2.0降级为pgcrypto-1.2

    ```sql
    CREATE EXTENSION pgcrypto;

    ALTER EXTENSION pgcrypto UPDATE TO '1.2';

    SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
    -- 预期输出 版本为 1.2

    DROP EXTENSION pgcrypto;
    ```

5.  从pgcrypto-1.2升级为pgcrypto-2.0

    ```sql
    CREATE EXTENSION pgcrypto WITH VERSION '1.2';;

    ALTER EXTENSION pgcrypto UPDATE TO '2.0';

    SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
    -- 预期输出 版本为 2.0

    DROP EXTENSION pgcrypto;
    ```

### 二、dbms_obfuscation_toolkit函数基本功能

客户核心需求是，在dbms_obfuscation_toolkit中，加密函数与解密函数与oracle保持一致。即本场景为核心场景。

1.  des加密函数  
    首先，简单封装2个数据类型转换函数，方便阅读SQL语句

    ```sql
    CREATE FUNCTION strtoraw(string VARCHAR2) RETURN RAW IS
    BEGIN
    RETURN utl_raw.cast_to_raw(string);
    END;
    /

    CREATE FUNCTION rawtostr(rawdata RAW) RETURN VARCHAR2 IS
    BEGIN
    RETURN utl_raw.cast_to_varchar2(rawdata);
    END;
    /
    ```

    本场景中，预期输出需与oracle保持一致

    ```sql
    -- 安装加解密插件
    CREATE EXTENSION pgcrypto;

    SELECT dbms_obfuscation_toolkit.desencrypt(strtoraw('1111111111111111'), strtoraw('11111111')) FROM dual;
    -- 预期输出 655EA628CF62585F20D3B8A6E657876B
    ```

2.  des解密函数  
    本场景中，预期输出需与oracle保持一致

    ```sql
    SELECT rawtostr(dbms_obfuscation_toolkit.desdecrypt(hextoraw('655EA628CF62585F20D3B8A6E657876B'), strtoraw('11111111'))) FROM dual;
    -- 预期输出  1111111111111111
    ```

3.  3des加密函数  
    本场景中，预期输出需与oracle保持一致

    ```sql
    SELECT dbms_obfuscation_toolkit.des3encrypt(strtoraw('1111111111111111'), strtoraw('1111111122222222'), 0, strtoraw('11111111')) FROM dual;
    -- 预期输出 0D28E17571051319ACCE2D19D9AED5C8
    ```

4.  3des解密函数  
    本场景中，预期输出需与oracle保持一致

    ```sql
    SELECT rawtostr(dbms_obfuscation_toolkit.des3decrypt(hextoraw('0D28E17571051319ACCE2D19D9AED5C8'), strtoraw('1111111122222222'), 0, strtoraw('11111111'))) FROM dual;
    -- 预期输出 1111111111111111
    ```

5.  3des加密函数iv为空  
    本场景中，预期输出需与oracle保持一致

    ```sql
    SELECT dbms_obfuscation_toolkit.des3encrypt(strtoraw('1111111111111111'), strtoraw('1111111122222222')) FROM dual;
    -- 预期输出 7934131269E334A2BCC64878CC5A075A
    ```

6.  3des解密函数iv为空  
    本场景中，预期输出需与oracle保持一致

    ```sql
    SELECT rawtostr(dbms_obfuscation_toolkit.des3decrypt(hextoraw('7934131269E334A2BCC64878CC5A075A'), strtoraw('1111111122222222'))) FROM dual;
    -- 预期输出 1111111111111111
    ```

### 三、dbms_obfuscation_toolkit函数不同入参

1.  des加密超长数据  
    首先，创建1个表存储加解密结果

    ```sql
    CREATE TABLE plain (c1 RAW);
    CREATE TABLE cipher (c1 RAW);
    ```

    此处，待加密的数据长度为80000字节

    ```sql
    INSERT INTO plain VALUES (strtoraw(repeat('0123456789', 8000)));
    INSERT INTO CIPHER VALUES (dbms_obfuscation_toolkit.desencrypt(strtoraw(repeat('0123456789', 8000)), strtoraw('11111111')));

    SELECT length(c1) FROM plain;
    SELECT length(c1) FROM cipher;

    SELECT (SELECT c1 FROM plain) = (SELECT c1 FROM cipher);
    -- 预期输出 f
    ```

2.  des解密超长数据

    ```sql
    SELECT
    (SELECT c1 FROM plain) =
    (SELECT dbms_obfuscation_toolkit.desdecrypt(c1, strtoraw('11111111'))FROM cipher);
    -- 预期输出 t

    TRUNCATE plain;
    TRUNCATE cipher;
    ```

3.  3des加密超长数据

    ```sql
    INSERT INTO plain VALUES (strtoraw(repeat('0123456789', 8000)));
    INSERT INTO CIPHER VALUES (dbms_obfuscation_toolkit.des3encrypt(strtoraw(repeat('0123456789', 8000)), strtoraw('1111111122222222'), 0, strtoraw('11111111')));

    SELECT length(c1) FROM plain;
    SELECT length(c1) FROM cipher;

    SELECT (SELECT c1 FROM plain) = (SELECT c1 FROM cipher);
    -- 预期输出 f
    ```

4.  3des解密超长数据

    ```sql
    SELECT
    (SELECT c1 FROM plain) =
    (SELECT dbms_obfuscation_toolkit.des3decrypt(c1, strtoraw('1111111122222222'), 0, strtoraw('11111111')) FROM cipher);
    -- 预期输出 t

    DROP TABLE plain;
    DROP TABLE cipher;
    ```

5.  3des中keymode参数为1

    ```sql
    SELECT dbms_obfuscation_toolkit.des3encrypt(strtoraw('1111111111111111'), strtoraw('111111112222222233333333'), 1, strtoraw('11111111')) FROM dual;

    SELECT dbms_obfuscation_toolkit.des3decrypt(hextoraw('7934131269E334A2BCC64878CC5A075A'), strtoraw('111111112222222233333333'), 1, strtoraw('11111111')) FROM dual;
    ```

### 四、

# 附录

## 使用bytea加密

1.  DES加密

    ```sql
    SELECT dbms_obfuscation_toolkit.desencrypt('1111111111111111'::bytea, '11111111'::bytea);
    -- 输出 \x655EA628CF62585F20D3B8A6E657876B
    ```

2.  DES解密

    ```sql
    SELECT convert_from(dbms_obfuscation_toolkit.desdecrypt('\x655EA628CF62585F20D3B8A6E657876B'::bytea, '11111111'::bytea), 'UTF8');
    -- 输出 1111111111111111
    ```
