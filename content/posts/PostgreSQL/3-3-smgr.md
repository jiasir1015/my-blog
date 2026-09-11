+++
title = 'PostgreSQL 3-6 Smgr'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '存储引擎']
weight = 303
ShowToc = true
TocOpen = true
+++
接口

```c
void smgrcreate(SMgrRelation reln, ForkNumber forknum, bool isRedo); // 创建文件
void smgrdounlink(SMgrRelation reln, bool isRedo);

SMgrRelation smgropen(RelFileNode rnode, BackendId backend);
void smgrclose(SMgrRelation reln);

void smgrwrite(SMgrRelation reln, ForkNumber forknum, BlockNumber blocknum, char *buffer, bool skipFsync);
void smgrread(SMgrRelation reln, ForkNumber forknum, BlockNumber blocknum, char *buffer);
void smgrextend(SMgrRelation reln, ForkNumber forknum, BlockNumber blocknum, char *buffer, bool skipFsync);
```

调用关系

```c
// 索引模块
btbuildempty()
    smgrwrite(metapage)
_bt_blwritepage()
    smgrwrite()
spgbuildempty()
    smgrwrite()

|- FlushBuffer() ...
|- FlushRelationBuffers()
|- LocalBufferAlloc()
    smgrwrite()
```

```c
// FlushBuffer
|- BufferAlloc() // readBuffer时，申请一个buffer，可能调用页面淘汰算法
|- FlushDatabaseBuffers()
|- FlushRelationBuffers()
|- FlushOneBuffer()
    FlushBuffer()

// FlushOneBuffer
XLogReadBufferForRedoExtended()
    FlushOneBuffer()

// FlushRelationBuffers
|- heap_sync()
|- ATExecSetTableSpace() // ALTER TABLE SET TABLESPACE
    FlushRelationBuffers()
// heap_sync when HEAP_INSERT_SKIP_WAL
|- intorel_shutdown()
|- CopyFrom()
|- transientrel_shutdown()
|- ATRewriteTable()
    heap_sync()

// FlushDatabaseBuffers
dbase_redo()
    FlushDatabaseBuffers()
```

write时机：

1.  readBuffer时，如果buffer不在内存，且共享缓冲池已满，调用页面置换算法进行刷盘
2.  alter table set table space
3.  copy
