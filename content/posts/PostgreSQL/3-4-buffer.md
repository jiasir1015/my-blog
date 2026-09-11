+++
title = 'PostgreSQL 3-3 Buffer'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '存储引擎']
weight = 304
ShowToc = true
TocOpen = true
+++
# 1 Buffer基本介绍

## 1.1 Buffer解决的问题

实际应用场景中，PostgreSQL可能需要1分钟处理数十万次事务，频繁读写Page。Buffer提供以下2个基本功能：

-   加载Page至内存：PostgreSQL需要读写数时，都需先从磁盘中，将指定的Page加载至内存中，再在内存中操作Page
-   缓存常用Page：Page被加载至内存后，还会在内存停留一段时间，降低PostgreSQL直接从磁盘读写Page的频率

## 1.2 Buffer的基本功能

Buffer缓存Page时，需考虑以下几个场景：

-   插入Page：大部分事务操作表的Page时，先从Buffer中查找Page，如果Page不在Buffer中，再从磁盘读取Page，将其放入Buffer中，再操作Buffer中的Page
-   查找Page：访问Page时，通过文件名和Page编号等信息可确定唯一Page
-   访问Page：所有事务均可访问Buffer，需考虑多事务并发读写同一Pape的场景
-   淘汰Page：Buffer能缓存的Page数量有限，在Page数量过多时，需淘汰一些Page
-   落盘Page：Buffer中通常缓存表数据文件的Page，前文提到，事务持久化的标志是WAL日志落盘，因此，Buffer中的Page无需实时落盘，仅需异步落盘即可

# 2 Buffer的基本原理

## 2.1 插入Page

插入Page主要由读Page操作触发，上层函数读取Page的主要流程如下：

1.  上层模块统一调用ReadBuffer()接口，读取指定表的指定Page
2.  ReadBuffer()中，先从Buffer查找Page，如果找到Page，则直接返回Buffer中的Page
3.  如果未从Buffer找到Page，现在Buffer中预留存储Page的空间
4.  之后，调用Smgr模块，从磁盘读取指定Page，并将其放入预留的空间内，再返回Buffer中的Page

函数调用关系大概如下图所示：

```python
ReadBuffer(Relation, BlockNumber) # 1
    ReadBufferExtended()
        ReadBuffer_common()
            BufferAlloc() # 2,3 查找Page，如找到，返回；如未找到，预留存储Page的空间
            smgrread(.., BlockNumber) # 4 如果未找到Page，从磁盘将Page读入预留的Page空间内，返回
```

## 2.2 查找Page

上层函数读Page时，首先进入查找Page阶段。

## 1.1 buffer池模型

模型：

![1](/images/PostgreSQL/3-4-buffer/1.png)

## 1.2 buffer池接口

缓冲区接口：

```c
/* bufmgr.h */

/* 1 buffer池管理 */
void InitBufferPool(void);
void InitBufferPoolAccess(void);
void InitBufferPoolBackend(void);

/* 2 buffer管理 */
/* 2.1 读buffer */
Buffer ReadBuffer(Relation reln, BlockNumber blockNum);
Buffer ReadBufferExtended(Relation reln, ForkNumber forkNum, BlockNumber blockNum, ReadBufferMode mode, BufferAccessStrategy strategy);
Buffer ReadBufferWithoutRelcache(RelFileNode rnode, ForkNumber forkNum, BlockNumber blockNum,ReadBufferMode mode, BufferAccessStrategy strategy);
/* 2.2 清理buffer */
oid ReleaseBuffer(Buffer buffer);
void UnlockReleaseBuffer(Buffer buffer);
void MarkBufferDirty(Buffer buffer);
void IncrBufferRefCount(Buffer buffer);
Buffer ReleaseAndReadBuffer(Buffer buffer, Relation relation, BlockNumber blockNum);
/* 2.3 刷盘buffer */
void CheckPointBuffers(int flags);
void FlushOneBuffer(Buffer buffer);
void FlushRelationBuffers(Relation rel);
void FlushDatabaseBuffers(Oid dbid);
void BufmgrCommit(void);
bool BgBufferSync(void);
/* 2.4 删除关联buffer */
void DropRelFileNodeBuffers(RelFileNodeBackend rnode, ForkNumber forkNum, BlockNumber firstDelBlock);
void DropRelFileNodesAllBuffers(RelFileNodeBackend *rnodes, int nnodes);
void DropDatabaseBuffers(Oid dbid);
/* 2.5 锁buffer */
void UnlockBuffers(void);
void LockBuffer(Buffer buffer, int mode);
bool ConditionalLockBuffer(Buffer buffer);
void LockBufferForCleanup(Buffer buffer);
bool ConditionalLockBufferForCleanup(Buffer buffer);
bool HoldingBufferPinThatDelaysRecovery(void);
```

## 1.3 buffer调用

**插入数据**

```c
heap_insert()
    RelationGetBufferForTuple()
        /* 已有page，查找空闲的page */
        GetPageWithFreeSpace()

        /* 读取page，放入缓冲池 */
        ReadBufferBI()
            ReadBuffer() /* buffer接口 */
                ReadBufferExtended()
                    ReadBuffer_common()
                        BufferAlloc() /* 遍历buffer池，查找 */
```

**查找页面**

```c
BufferDesc BufferAlloc()
    BufTableHashCode(newtag)
    buf_id = BufTableLookup()
    if buf_id:
        buf_desc = GetBufferDescriptor(buf_id)
        PinBuffer(buf_desc)
        return buf_desc;

    for (;;) {
        buf_desc = StrategyGetBuffer()
        if buf_desc dirty :
            FlushBuffer(buf_desc)
        if buf_desc tab_valid: /* 旧buf有数据，但旧buf可用 */
            /* partition lock ? */
        buf_id = BufTableInsert(newtag, buf_desc->buf_id) /* 可能失败，多进程一起申请同一page */
        if buf_id:
            return buf_desc
        BufTableDelete(newtag)
    }

    BufTableDelete(oldtag)
```

# 2 实现

## 2.1 ReadBuffer

```c
Buffer ReadBuffer(Relation reln, BlockNumber blockNum)
    Buffer buf = ReadBufferExtended(reln, MAIN_FORKNUM, blockNum, RBM_NORMAL, NULL) /* 读场景 strategy = NULL */
        Buffer buf = ReadBuffer_common(SMgrRelation smgr, char relpersistence, ForkNumber forkNum, BlockNumber blockNum, ReadBufferMode mode, BufferAccessStrategy strategy, bool *hit) {
            /* 1. 根据表类型判断，使用LocalBuffer还是共享Buffer */
            bool isLocalBuf = SmgrIsTemp(smgr)
            if isLocalBuf:
                LocalBufferAlloc()
            else:
                /* 选择1个buffer槽，{fornNum, BlockNum}等信息写入buffer槽 */
                BufferDesc *bufHdr = BufferAlloc(smgr, forkNum, blockNum, strategy, &found) {
                    uint32 newHash = BufTableHashCode({smgr->smgr_rnode.node, forkNum, blockNum})
                    /* 2. 根据blockNum等信息，从哈希表中查找buf_id */
                    int buf_id = BufTableLookup(&newTag, newHash)
                    if buf_id >= 0: /* 如果找到（已在buffer池中） */
                        /* 3.1 根据buf_id，查找BufferDesc */
                        BufferDesc *buf = GetBufferDescriptor(buf_id)
                        /* 3.2 根据BufferDesc，引用计数++，使用计数++ */
                        PinBuffer(BufferDesc *buf)
                            buf->refcount++
                            buf->usage_count++
                        /* 异常处理 */
                        return buf

                    for (;;) /* 如果没找到 */
                        BufferDesc *buf = StrategyGetBuffer(strategy)
                            BufferDesc *buf = GetBufferFromRing()
                                bgwprocno = StrategyControl->bgwprocno
                                /* 4.1 唤醒bg writer */
                                SetLatch(&ProcGlobal->allProcs[bgwprocno].procLatch)
                                /* 4.2 检查是否有空闲Buffer */
                                if StrategyControl->firstFreeBuffer >= 0:
                                    buf = GetBufferDescriptor(StrategyControl->firstFreeBuffer)
                                    StrategyControl->firstFreeBuffer = buf->freeNext
                                    /* 4.3 TODO */
                        /* 4.4 根据BufferDesc，引用计数++，使用计数++ */
                        if buf->flags & BM_DIRTY:
                            /* 4.5 将选中的Buffer落盘 */
                            FlushBuffer(buf)
                        if buf->flags & BM_TAG_VALID:
                            oldTag = buf->tag
                            oldHash = BufTableHashCode(&oldTag)
                        /* 4.6 将hash表中受害者Buffer对应的位置替换为即将写入的的BufferTag，-1表示成功，否则返回已存在的冲突的buffer id */
                        buf_id = BufTableInsert(&newTag, newHash, buf->buf_id)
                        /* 4.7 如果其他进程已经将新的buffer写入哈希表，直接返回即可 */
                        if buf_id >= 0:
                            PinBuffer(buf)
                            return buf
                        /* 4.8 替换映射成功 */
                        LockBufHdr(buf)
                        oldFlags = buf->flags
                        if buf->refcount == 1 && !(oldFlags & BM_DIRTY): /* 4.9 替换映射成功，且受害者buffer没有被重新写入数据 */
                            break;
                        /* 4.10 受害者buffer又被重新写入新数据，需要重新进入循环选择新的受害者 */
                        BufTableDelete(&newTag, newHash)
                        UnpinBuffer(buf, true)

                    /* 将受害者buffer对用的信息替换为新page，并将buffer槽标记为VM_INVALID */
                    buf->tag = newTag
                    buf->flags &= ~(BM_VALID | BM_DIRTY | BM_JUST_DIRTIED | BM_CHECKPOINT_NEEDED | BM_IO_ERROR | BM_PERMANENT)
                    buf->usage_count = 1
                    if oldFlags & BM_TAG_VALID:
                        BufTableDelete(&oldTag, oldHash)
                    return buf
                }

                /* 5. 如果page已在Buffer池中，直接返回即可 */
                if found:
                    *hit = true
                    return BufferDescriptorGetBuffer(bufHdr)

                /* 6. 从磁盘读取page，并且直接读如buffer槽中 */
                bufBlock = isLocalBuf ? LocalBufHdrGetBlock(bufHdr) : BufHdrGetBlock(bufHdr)
                smgrread(smgr, forkNum, blockNum, bufBlock)

                if !PageIsVerified(bufBlock):
                    ereport ...

                /* 7. 在bufHdr中将buffer设置未BM_VALID */
                TerminateBufferIO(bufHdr, false, BM_VALID)

                return BufferDescriptorGetBuffer(bufHdr)
        }
```
