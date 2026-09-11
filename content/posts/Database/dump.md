+++
title = 'pg_dump'
date = '2025-07-29T18:07:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['PostgreSQL']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 使用方式

```sql
vsql -d vastbase -r

CREATE USER u1 PASSWORD 'u1.password';
CREATE USER u2 SYSADMIN PASSWORD 'u2.password';
CREATE USER u3 SUPERUSER PASSWORD 'u3.password';
SELECT rolname,rolsuper,rolsystemadmin FROM pg_authid ORDER BY rolname;
```

```bash
vsql -d vastbase -c "SELECT rolname,rolsuper,rolsystemadmin FROM pg_authid ORDER BY rolname;"

# 导出
vb_dumpall --roles-only -f ./u.sql

# 清理
vsql -d vastbase -c " DROP USER IF EXISTS u1,u2,u3; "

# 恢复
vsql -d vastbase -f ./u.sql

vsql -d vastbase -c "SELECT rolname,rolsuper,rolsystemadmin FROM pg_authid ORDER BY rolname;"
```
