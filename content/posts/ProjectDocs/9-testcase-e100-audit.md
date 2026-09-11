+++
title = '海量 9 用例 E100审计'
date = '2025-07-25T15:33:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['审计', '测试用例']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 adt_scope_ddl

```sql
/*
=============================
Operate
    create
    alter
    drop
    truncate

    prepare
    dealocate

    abort
    begin
    release savepoint

    analyze
    checkpoint
    commit
    commit prepared
    end
    rollback
    rollback prepare
    prepare
    prepare transcation
    rollback to savepoint
    savepoint
    start transaction

    call
    execute

    close

    explain
    cluster
    comment

    copy

    discard
    do
    declare

    move
    fetch

    grant
    revoke

    import

    listen
    notify
    unlisten

    load

    lock

    reassign
    refresh
    reindex

    reset
    set
    set constraints
    set role
    set session authorization
    set transcation
    show

    values
Object:
    system

    user
    role
    group

    database
    table space
    schema
    table
        temp table
        forgien table
    index
    view
        materialized view
    sequence

    function
    procedure
    trigger
    aggregate

    larger object

    domain
    type
    cast
    conversion
    collation
    language
    rule

    forgien data wrapper
    server
    user mapping

    publication
    subscription

    privileges
    policy

    statistics
    routine

    text search configuration
    text search dictionary
    text search parser
    text search template

    operator
    operator class
    operator family
    access method

    extension
-- =============================
*/

-- fdw
\c atlasdb
CREATE EXTENSION postgres_fdw;
CREATE USER u1 PASSWORD 'u1.password';
CREATE SERVER s1 FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host '172.16.100.134', port '5432', dbname 'fdb1');
GRANT ALL ON FOREIGN SERVER s1 TO u1;
set role u1;
CREATE FOREIGN TABLE t1 (c1 INT) SERVER s1 OPTIONS (schema_name 'public', table_name 'ft1');
CREATE USER MAPPING FOR u1 SERVER s1 OPTIONS (user 'fu1', password 'fu1.password');

-- common
CREATE TABLE tbl(c1 INT, c2 TEXT);
INSERT INTO tbl VALUES(generate_series(1, 100), 'bbbbbbbbb');

-- cursor | declare,fetch,move,close |  (must in transaction block)
BEGIN;
DECLARE cu1 CURSOR FOR SELECT * FROM tbl; -- consider it as a cache for select result
FETCH 3 FROM cu1;
FETCH 3 FROM cu1;
MOVE FORWARD 2 FROM cu1;
CLOSE cu1;
COMMIT;

-- channel | listen,unlisten,notify
-- session 1
LISTEN ch1;
-- session 2 --> session 1, session 1 receive and cache message
NOTIFY ch1, 'hello';
SELECT pg_notify('ch1', 'hello' || 'a');
UNLISTEN ch1;

-- table | create,alter(rename,move),drop,lock,insert,update,select,delete
CREATE TABLE tb1(c1 INT);
ALTER TABLE tb1 ADD COLUMN c3(INT);
ALTER TABLE tb1 RENAME COLUMN c3 TO c2;
BEGIN;
LOCK TABLE tb1 IN ACCESS EXCLUSIVE MODE;
COMMIT;
DROP TABLE tb1;

-- materialized view
CREATE MATERIALIZED VIEW mv1 AS SELECT * FROM tbl;

-- dictionary & configuration |
CREATE TEXT SEARCH DICTIONARY tsd1 (
    TEMPLATE = snowball,
    language = english
);
ALTER TEXT SEARCH DICTIONARY tsd1 (stopwords = english);
CREATE TEXT SEARCH CONFIGURATION tsc1 (copy = english);
ALTER TEXT SEARCH CONFIGURATION tsc1 ALTER MAPPING FOR asciiword, asciihword, hword_asciipart WITH tsd1, simple;
SELECT to_tsvector('tsc1', 'abc bb cc bb');
DROP TEXT SEARCH CONFIGURATION tsc1;
DROP TEXT SEARCH DICTIONARY tsd1;

-- domain | create,alter,drop
CREATE DOMAIN do1 AS TEXT CONSTRAINT c1 CHECK ( VALUE ~ '^[0-9]+$' ) DEFAULT '3'; -- consider a group of 'check / not null / default' for column
ALTER DOMAIN do1 ADD CONSTRAINT c2 CHECK (LEFT(VALUE, 1) < '5');
    CREATE TABLE t1(c1 do1);
    INSERT INTO t1 VALUES ('12');
    INSERT INTO t1 VALUES ('89');
    INSERT INTO t1 VALUES (default);
    DROP TABLE t1;
DROP DOMAIN do1;

-- conversion | create | (need define c code)
-- CREATE FUNCTION f1(integer, cstring, integer, cstring) RETURNS integer AS 'latin1_utf8', 'latin1_to_utf8' LANGUAGE C STRICT;
-- CREATE CONVERSION co1 FOR 'LATIN1' TO 'UTF8' FROM f1;
-- SELECT CONVERT('\xe4\xf6\xfc'::bytea, 'latin1_utf8_cnv');
-- DROP CONVERSION co1;
-- DROP FUNCTION f1;

-- user
CREATE USER u1 PASSWORD 'u1.password';
CREATE USER u2 PASSWORD 'u2.password';
CREATE USER u3 PASSWORD 'u2.password';
ALTER USER u1 PASSWORD 'u1.newpass';
DROP USER u1;
DROP USER IF EXISTS u1,u2,u3,u4;

-- type
CREATE TYPE int_2 AS (a INT, b INT);

-- synonym (only oracle)
CREATE TABLE t1 (c1 INT);
CREATE SYNONYM s1 FOR t1;
CREATE PUBLIC SYNONYM ps1 FOR t1;
SELECT * FROM s1;
SELECT * FROM ps1;
DROP SYNONYM s1;
DROP SYNONYM ps1;

-- aggregate
CREATE FUNCTION f_add_a_int(state bigint[], val int)
RETURNS bigint[] LANGUAGE sql AS
$$ SELECT ARRAY[state[1] + val, state[2] + 1] $$;

CREATE FUNCTION f_avg_final(state bigint[])
RETURNS numeric LANGUAGE sql AS
$$ SELECT state[1]::numeric / state[2] $$;

CREATE AGGREGATE a_int_avg(int) (
  SFUNC    = f_add_a_int,
  STYPE    = bigint[],
  FINALFUNC = f_avg_final,
  INITCOND = '{0,0}'
);

SELECT a_int_avg(v) FROM generate_series(1,6) v;

DROP AGGREGATE a_int_avg(int);
DROP FUNCTION f_add_a_int;
DROP FUNCTION f_avg_final;
```

# 2 adt_scope_dcl

# 3 adt_scope_dml

# 4 adt_scope_dql

# 5 adt_scope_tcl

# 6 adt_scope_func

# 7 adt_scope_mng

# 8 adt_scope_misc
