+++
title = '数据库安全 Oracle'
date = '2025-01-25T11:07:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['Oracle']
weight = 400
ShowToc = true
TocOpen = true
+++
[https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001006330](https://www.tapd.cn/60475194/markdown_wikis/show/#1160475194001006330)

# 3 异常参数

## 3.1 DES encrypt

1.  封装函数

    ```sql
    CREATE OR REPLACE FUNCTION desencrypt(hex_plain VARCHAR2, hex_key VARCHAR2)
    RETURN VARCHAR2 IS
        cipher RAW(100);
    BEGIN
        dbms_obfuscation_toolkit.desencrypt(hextoraw(hex_plain), hextoraw(hex_key), encrypted_data=>cipher);
        RETURN rawtohex(cipher);
    END;
    /
    ```

2.  函数格式

    ```sql
    desencrypt(plain, key, cipher);
    ```

    约束：
3.  构造用例

    | 明文长度 | 密钥长度 | 输出：密文长度 | 示例 | 结果 |
    | --- | --- | --- | --- | --- |
    | 一、正常用例 |  |  |  |  |
    | 8 | 8 | 8 | desencrypt() | abc |
    | 16 | 8 | 16 | desencrypt() | abc |
    | 一、明文长度异常 |  |  |  |  |
    | 0 | 8 | 16 | desencrypt() | 明文不是8的倍数 |
    | 1 | 8 | \- | desencrypt() | 明文不是8的倍数 |
    | 7 | 8 | \- | desencrypt() | 明文不是8的倍数 |
    | 15 | 8 | \- | desencrypt() | 明文不是8的倍数 |
    | 二、密钥长度异常 |  |  |  |  |
    | 8 | 0 | 8 | desencrypt() | 密钥长度不是8 |
    | 8 | 1 | 8 | desencrypt() | 密钥长度不是8 |
    | 8 | 15 | 8 | desencrypt() | 密钥长度不是8 |
    | 8 | 16 | 8 | desencrypt() | 密钥长度不是8 |

## 3.2 DES decrypt

## 3.3 3DES encrypt

1.  封装函数

    ```sql
    CREATE OR REPLACE FUNCTION des3encrypt(hex_plain VARCHAR2, hex_key VARCHAR2, hex_iv VARCHAR2, key_mode INT)
    RETURN VARCHAR2 IS
        cipher RAW(100);
    BEGIN
        dbms_obfuscation_toolkit.des3encrypt(input=>hextoraw(hex_plain), key=>hextoraw(hex_key), encrypted_data=>cipher, which=>key_mode, iv=>hextoraw(hex_iv));
        RETURN rawtohex(cipher);
    END;
    /
    ```

2.  函数格式

    ```sql
    des3encrypt(plain, key, iv, mode, cipher);
    ```

3.  构造用例

# 7 oracle 加密函数

## 7.1 DES

-   函数格式

    ```sql
    dbms_obfuscation_toolkit.desencrypt(plain, key, cipher);
    ```

-   前置知识

    ```sql
    -- varchar --> raw
    SELECT utl_raw.cast_to_raw('11111111') FROM dual;
    -- raw --> varchar
    SELECT utl_raw.cast_to_varchar2(hextoraw('3131313131313131')) FROM dual;
    -- raw -> hex
    SELECT rawtohex('11111111') FROM dual;
    SELECT hextoraw('3131313131313131') FROM dual;
    ```

-   加密函数
    -   示例1

        ```sql
        SET SERVEROUTPUT ON;

        DECLARE
            cipher RAW(100);
        BEGIN
            dbms_obfuscation_toolkit.desencrypt(hextoraw('3131313131313131'), hextoraw('3131313131313131'), encrypted_data=>cipher);
            dbms_output.put_line(rawtohex(cipher));
        END;
        /
        ```

    -   示例2

        ```sql
        CREATE OR REPLACE FUNCTION desencrypt(hex_plain VARCHAR2, hex_key VARCHAR2)
        RETURN VARCHAR2 IS
            cipher RAW(100);
        BEGIN
            dbms_obfuscation_toolkit.desencrypt(hextoraw(hex_plain), hextoraw(hex_key), encrypted_data=>cipher);
            RETURN rawtohex(cipher);
        END;
        /

        SELECT desencrypt('3131313131313131', '3131313131313131') FROM dual;
        -- 输出 655EA628CF62585F
        SELECT desencrypt('31313131313131313131313131313131', '3131313131313131') FROM dual;
        -- 输出 655EA628CF62585F20D3B8A6E657876B
        ```

-   解密函数
    -   示例2

        ```sql
        CREATE OR REPLACE FUNCTION desdecrypt(hex_cipher VARCHAR2, hex_key VARCHAR2)
        RETURN VARCHAR2 IS
            plain RAW(100);
        BEGIN
            dbms_obfuscation_toolkit.desdecrypt(hextoraw(hex_cipher), hextoraw(hex_key), decrypted_data=>plain);
            RETURN rawtohex(plain);
        END;
        /

        SELECT desdecrypt('655EA628CF62585F', '3131313131313131') FROM dual;
        -- 输出 3131313131313131
        SELECT desdecrypt('655EA628CF62585F20D3B8A6E657876B', '3131313131313131') FROM dual;
        -- 输出 31313131313131313131313131313131
        ```

## 7.2 3DES

-   函数格式

    ```sql
    dbms_obfuscation_toolkit.DESencrypt(plain, key, mode);
    ```

    which的含义：
    -   0：2密钥格式，k1 = k3
    -   1：3密钥格式

-   加密函数

    ```sql
    CREATE OR REPLACE FUNCTION des3encrypt(hex_plain VARCHAR2, hex_key VARCHAR2, hex_iv VARCHAR2, key_mode INT)
    RETURN VARCHAR2 IS
        cipher RAW(100);
    BEGIN
        dbms_obfuscation_toolkit.des3encrypt(input=>hextoraw(hex_plain), key=>hextoraw(hex_key), encrypted_data=>cipher, which=>key_mode, iv=>hextoraw(hex_iv));
        RETURN rawtohex(cipher);
    END;
    /

    SELECT des3encrypt('3131313131313131', '31313131313131313131313131313131'，'31313131313131313131313131313131', 0) FROM dual;

    SELECT des3encrypt('31313131313131', '31313131313131313131313131313131'，NULL, 0) FROM dual;

    -- 废弃
    SELECT rawtohex(dbms_obfuscation_toolkit.des3encrypt(hextoraw('3131313131313131'), hextoraw('31313131313131313131313131313131'), 0)) FROM dual;

    SELECT dbms_obfuscation_toolkit.des3encrypt(hextoraw('3131313131313131'), hextoraw('3131313131313131'), 0) FROM dual;
    ```

-   其他
    -   示例1

        ```sql
        select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('11111111', key_string=>010199010401050110974949, which=>0)) from dual;
        -- 输出：
        E7E14DFD9E0DED3B
        ```

    -   验证

        ```sql
        -- 3des
        select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('11111111', key_string=>010199010401050110974949, which=>0)) from dual;
        -- 密钥长度为12字节，实际只用了10字节，后面的被截断扔了
        -- 明文为8字节，密文为8字节
        -- 输出：
        E7E14DFD9E0DED3B

        -- 明文7，9字节都不行，只能是8的整数倍
        -- 明文16字节
        select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('1111111111111111', key_string=>010199010401050110974949, which=>0)) from dual;
        -- 输出：
        E7E14DFD9E0DED3B D80084E1EDD76DF1

        -- 密钥截断
        select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('11111111', key_string=>010199010401050110, which=>0)) from dual;
        -- 输出：
        E7E14DFD9E0DED3B

        -- 最低为18位，后几位没用，实际为14位
        select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('11111111', key_string=>010199010401050000, which=>0)) from dual;
        -- 输出：
        E7E14DFD9E0DED3B

        -- 18字节密钥，截断6位，明文变长
        select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('1111111111111111', key_string=>010199010401050000, which=>0)) from dual;
        -- 输出：
        E7E14DFD9E0DED3B D80084E1EDD76DF1

        -- 14最后一位变化也不影响
        select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('11111111', key_string=>010199010401040000, which=>0)) from dual;
        -- 输出：
        E7E14DFD9E0DED3B

        select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('11111111', key_string=>010199010401030000, which=>0)) from dual;
        -- 输出
        C725C0228F108C77
        -- 20也是
        C725C0228F108C77

        select utl_raw.cast_to_raw(dbms_obfuscation_toolkit.des3encrypt('11111111', key_string=>010199010401010000, which=>0)) from dual;
        -- 输出
        69AB538F1542F919
        ```
