+++
title = '海量 5 用例 G100审计重构'
date = '2025-10-16T18:05:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['审计', '测试用例']
weight = 500
ShowToc = true
TocOpen = true
+++
# 1 正常场景

```sql
CREATE USER u1 PASSWORD 'u1.password';
set role u1 password 'u1.password';

-- ddl
DROP TABLE t1;
DROP FUNCTION f1;

CREATE TABLE t1(c1 INT, c2 TEXT);
-- dml
INSERT INTO t1 VALUES (1, 'aaa'), (2, 'bbb');
UPDATE t1 SET c2 = 'aba' WHERE c1 = 1;
SELECT * FROM t1;
DELETE FROM t1 WHERE c1 = 2;
-- func
CREATE FUNCTION f1() RETURNS INT AS $$ SELECT count(*)::INT FROM t1 $$ LANGUAGE sql;
SELECT f1();
-- trans
BEGIN;
SELECT * FROM t1;
COMMIT;

DROP TABLE t1;
DROP FUNCTION f1;

reset role;
select * from pg_audit_log;
```

# 2 异常场景

```sql
CREATE USER u1 PASSWORD 'u1.password';
CREATE TABLE st1(c1 INT, c2 TEXT);

set role u1 password 'u1.password';
-- doest't exist
SELECT * FROM nt1;
-- permission deny
SELECT * FROM st1;

reset role;
select * from pg_audit_log;
```
