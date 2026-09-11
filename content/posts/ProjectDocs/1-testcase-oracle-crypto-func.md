+++
title = '海量 1 用例 oracle加密函数'
date = '2025-02-25T15:31:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['Oracle', '加密', '测试用例']
weight = 100
ShowToc = true
TocOpen = true
+++
```sql
CREATE SCHEMA pgcrypto_2_text;
SET search_path TO pgcrypto_2_text;

/* ------------------------------------------------------------------------------------------------
 * part 0: create some utils functions
 * ------------------------------------------------------------------------------------------------
 */
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

-- get data type name
CREATE OR REPLACE FUNCTION oidgettype(typeoid OID)
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT typname FROM pg_type WHERE oid = typeoid);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION oidgettype(typeoids OIDVECTOR)
RETURNS TEXT[] AS $$
DECLARE
    result TEXT[] := '{}';
    typoid OID;
    typename TEXT;
BEGIN
    FOREACH typoid IN ARRAY typeoids LOOP
        SELECT typname INTO typename
        FROM pg_type
        WHERE oid = typoid;
        result := array_append(result, COALESCE(typename, 'Unknown OID'));
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- find all functions from dbms_obfuscation_toolkit
CREATE VIEW allfuncs AS
SELECT proname name,pronargs args,oidgettype(prorettype) output,oidgettype(proargtypes) input
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbms_obfuscation_toolkit') ORDER BY 1,3,2;

/* ------------------------------------------------------------------------------------------------
 * part 1: install pgcrypt with different versions
 * ------------------------------------------------------------------------------------------------
 */
-- available version
SELECT * FROM pg_available_extension_versions WHERE name = 'pgcrypto';

-- 2.0 (default version)
CREATE EXTENSION pgcrypto;
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
SELECT * FROM allfuncs;
DROP EXTENSION pgcrypto;

-- 1.2 (old version)
CREATE EXTENSION pgcrypto WITH VERSION '1.2';
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
SELECT * FROM allfuncs;
DROP EXTENSION pgcrypto;

-- 2.0 --> 1.2
CREATE EXTENSION pgcrypto;
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
ALTER EXTENSION pgcrypto UPDATE TO '1.2';
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
SELECT * FROM allfuncs;
DROP EXTENSION pgcrypto;

-- 1.2 --> 2.0
CREATE EXTENSION pgcrypto WITH VERSION '1.2';
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
ALTER EXTENSION pgcrypto UPDATE TO '2.0';
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
SELECT * FROM allfuncs;
DROP EXTENSION pgcrypto;

/* ------------------------------------------------------------------------------------------------
 * part 2: core functions
 * ------------------------------------------------------------------------------------------------
 */
CREATE EXTENSION pgcrypto;

-- 1 desencrypt
SELECT dbms_obfuscation_toolkit.desencrypt(strtoraw('11111111'), strtoraw('11111111')) FROM dual;
SELECT dbms_obfuscation_toolkit.desencrypt(strtoraw('1111111111111111'), strtoraw('11111111')) FROM dual;

-- 2 desdecrypt
SELECT rawtostr(dbms_obfuscation_toolkit.desdecrypt(hextoraw('655EA628CF62585F'), strtoraw('11111111'))) FROM dual;
SELECT rawtostr(dbms_obfuscation_toolkit.desdecrypt(hextoraw('655EA628CF62585F20D3B8A6E657876B'), strtoraw('11111111'))) FROM dual;

-- 3 des3encrypt
SELECT dbms_obfuscation_toolkit.des3encrypt(strtoraw('11111111'), strtoraw('1111111122222222'), 0, strtoraw('11111111')) FROM dual;
SELECT dbms_obfuscation_toolkit.des3encrypt(strtoraw('1111111111111111'), strtoraw('1111111122222222'), 0, strtoraw('11111111')) FROM dual;

-- 4 des3decrypt
SELECT rawtostr(dbms_obfuscation_toolkit.des3decrypt(hextoraw('0D28E17571051319'), strtoraw('1111111122222222'), 0, strtoraw('11111111'))) FROM dual;
SELECT rawtostr(dbms_obfuscation_toolkit.des3decrypt(hextoraw('0D28E17571051319ACCE2D19D9AED5C8'), strtoraw('1111111122222222'), 0, strtoraw('11111111'))) FROM dual;

-- 5 des3encrypt -- without iv
SELECT dbms_obfuscation_toolkit.des3encrypt(strtoraw('11111111'), strtoraw('1111111122222222')) FROM dual;
SELECT dbms_obfuscation_toolkit.des3encrypt(strtoraw('1111111111111111'), strtoraw('1111111122222222')) FROM dual;

-- 6 des3decrypt -- without iv
SELECT rawtostr(dbms_obfuscation_toolkit.des3decrypt(hextoraw('7934131269E334A2'), strtoraw('1111111122222222'))) FROM dual;
SELECT rawtostr(dbms_obfuscation_toolkit.des3decrypt(hextoraw('7934131269E334A2BCC64878CC5A075A'), strtoraw('1111111122222222'))) FROM dual;

/* ------------------------------------------------------------------------------------------------
 * part 3: different args
 * ------------------------------------------------------------------------------------------------
 */
-- 1 des
CREATE TABLE tplain (id INT, plain TEXT, key TEXT);
INSERT INTO tplain VALUES
    (1, '', ''),
    (2, NULL, NULL),
    -- different plain
    (11, NULL,                      '88888888'),
    (12, '',                        '88888888'),
    (13, '1',                       '88888888'),
    (14, '7777777',                 '88888888'),
    (15, '88888888',                '88888888'),
    (16, '999999999',               '88888888'),
    (17, '17171717171717171',       '88888888'),
    (18, '242424242424242422424242','88888888'),
    -- different key
    (31, '88888888',    NULL),
    (32, '88888888',    ''),
    (33, '88888888',    '1'),
    (34, '88888888',    '7777777'),
    (37, '88888888',    '88888888'),
    (38, '88888888',    '999999999'),
    (37, '88888888',    '17171717171717171'),
    (38, '88888888',    '242424242424242422424242');

CREATE TABLE tcipher (id INT, key TEXT, cipher RAW);
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 1;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 2;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 11;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 12;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 13;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 14;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 15;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 16;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 17;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 18;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 31;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 32;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 33;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 34;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 35;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 36;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 37;
INSERT INTO tcipher SELECT id, key, dbms_obfuscation_toolkit.desencrypt(strtoraw(plain), strtoraw(key)) FROM tplain WHERE id = 38;
SELECT id,cipher,length(cipher) FROM tcipher ORDER BY id;

SELECT id,rawtostr(dbms_obfuscation_toolkit.desdecrypt(cipher, strtoraw(key))) FROM tcipher ORDER BY id;

DROP TABLE tplain,tcipher;

-- 2 3des
CREATE TABLE tplain (id INT, plain TEXT, keymod INT, key TEXT, iv TEXT);
INSERT INTO tplain VALUES
    (1, '', 0, '', ''),
    (2, NULL, 0, NULL, NULL),
    -- different plain
    (11, NULL,                      0, '1616161616161616', '88888888'),
    (12, '',                        0, '1616161616161616', '88888888'),
    (13, '1',                       0, '1616161616161616', '88888888'),
    (14, '7777777',                 0, '1616161616161616', '88888888'),
    (15, '88888888',                0, '1616161616161616', '88888888'),
    (16, '999999999',               0, '1616161616161616', '88888888'),
    (17, '17171717171717171',       0, '1616161616161616', '88888888'),
    (18, '242424242424242422424242',0, '1616161616161616', '88888888'),
    -- different keymod
    (31, '1616161616161616',    NULL,   '1616161616161616', '88888888'),
    (32, '1616161616161616',    -1,     '1616161616161616', '88888888'),
    (33, '1616161616161616',    -1.1,   '1616161616161616', '88888888'),
    (34, '1616161616161616',    1.1,    '1616161616161616', '88888888'),
    (35, '1616161616161616',    2,      '1616161616161616', '88888888'),
    (36, '1616161616161616',    '0',    '1616161616161616', '88888888'),
    (37, '1616161616161616',    1,      '242424242424242422424242', '88888888'),
    -- different key
    (51, '1616161616161616',    0,      NULL,                           '88888888'),
    (52, '1616161616161616',    0,      '',                             '88888888'),
    (53, '1616161616161616',    0,      '1',                            '88888888'),
    (54, '1616161616161616',    0,      '7777777',                      '88888888'),
    (55, '1616161616161616',    0,      '88888888',                     '88888888'),
    (56, '1616161616161616',    0,      '999999999',                    '88888888'),
    (57, '1616161616161616',    0,      '17171717171717171',            '88888888'),
    (58, '1616161616161616',    0,      '242424242424242422424242',     '88888888'),
    (59, '1616161616161616',    0,      '272727272727272727272727272',  '88888888'),
    (61, '1616161616161616',    1,      NULL,                           '88888888'),
    (62, '1616161616161616',    1,      '',                             '88888888'),
    (63, '1616161616161616',    1,      '1',                            '88888888'),
    (64, '1616161616161616',    1,      '7777777',                      '88888888'),
    (65, '1616161616161616',    1,      '88888888',                     '88888888'),
    (66, '1616161616161616',    1,      '999999999',                    '88888888'),
    (67, '1616161616161616',    1,      '17171717171717171',            '88888888'),
    (68, '1616161616161616',    1,      '242424242424242422424242',     '88888888'),
    (69, '1616161616161616',    1,      '272727272727272727272727272',  '88888888'),
    -- different iv
    (81, '1616161616161616', 1, '242424242424242422424242',     NULL),
    (82, '1616161616161616', 1, '242424242424242422424242',     ''),
    (83, '1616161616161616', 1, '242424242424242422424242',     '1'),
    (84, '1616161616161616', 1, '242424242424242422424242',     '7777777'),
    (85, '1616161616161616', 1, '242424242424242422424242',     '88888888'),
    (86, '1616161616161616', 1, '242424242424242422424242',     '999999999'),
    (87, '1616161616161616', 1, '242424242424242422424242',     '17171717171717171'),
    (88, '1616161616161616', 1, '242424242424242422424242',     '242424242424242422424242'),
    (89, '1616161616161616', 1, '242424242424242422424242',     '272727272727272727272727272');

CREATE TABLE tcipher (id INT, CIPHER RAW, keymod INT, key TEXT, iv TEXT);
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 1;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 2;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 11;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 12;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 13;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 14;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 15;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 16;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 17;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 18;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 31;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 32;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 33;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 34;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 35;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 36;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 37;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 51;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 52;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 53;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 54;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 55;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 56;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 57;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 58;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 59;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 61;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 62;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 63;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 64;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 65;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 66;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 67;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 68;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 69;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 81;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 82;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 83;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 84;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 85;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 86;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 87;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 88;
INSERT INTO tcipher SELECT id, dbms_obfuscation_toolkit.des3encrypt(strtoraw(plain), strtoraw(key), keymod, strtoraw(iv)), keymod, key, iv FROM tplain WHERE id = 89;
SELECT * FROM tcipher;

SELECT id, rawtostr(dbms_obfuscation_toolkit.des3decrypt(cipher, strtoraw(key), keymod, strtoraw(iv))) FROM tcipher ORDER BY id;

DROP TABLE tplain, tcipher;

/* ------------------------------------------------------------------------------------------------
 * part 4: other functions
 * ------------------------------------------------------------------------------------------------
 */
SELECT length(dbms_obfuscation_toolkit.desgetkey(strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888'))) FROM dual;
SELECT length(dbms_obfuscation_toolkit.des3getkey(0, strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888'))) FROM dual;
SELECT length(dbms_obfuscation_toolkit.des3getkey(1, strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888'))) FROM dual;
SELECT dbms_obfuscation_toolkit.md5(strtoraw('1111111111111111')) FROM dual;

CREATE TABLE deskey(id INT, key RAW);
CREATE TABLE des3key0 (id INT, key RAW);
CREATE TABLE des3key1 (id INT, key RAW);

INSERT INTO deskey SELECT generate_series(1, 1000),
    dbms_obfuscation_toolkit.desgetkey(strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888'));
INSERT INTO des3key0 SELECT generate_series(1, 1000),
    dbms_obfuscation_toolkit.des3getkey(0, strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888'));
INSERT INTO des3key1 SELECT generate_series(1, 1000),
    dbms_obfuscation_toolkit.des3getkey(1, strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888'));

CREATE TABLE allcnt (cnt INT);
INSERT INTO allcnt SELECT count(*) FROM deskey GROUP BY key;
INSERT INTO allcnt SELECT count(*) FROM des3key0 GROUP BY key;
INSERT INTO allcnt SELECT count(*) FROM des3key1 GROUP BY key;
SELECT cnt,count(*) FROM allcnt GROUP BY cnt;

-- test (need to spend too much time)

-- CREATE TABLE moretime(id INT, key RAW);
-- INSERT INTO moretime SELECT generate_series(1, 100000),
--     dbms_obfuscation_toolkit.desgetkey(strtoraw('11111111112222222222333333333344444444445555555555666666666677777777778888888888'));
-- -- 预期 key列重复的字符不多
-- SELECT * FROM moretime ORDER BY key ASC LIMIT 10;
-- SELECT * FROM moretime ORDER BY key DESC LIMIT 10;
-- DROP TABLE moretime;

DROP TABLE deskey, des3key0, des3key1, allcnt;

DROP EXTENSION pgcrypto;
RESET search_path;
DROP SCHEMA pgcrypto_2_text CASCADE;
```
