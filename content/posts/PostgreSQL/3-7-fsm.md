+++
title = 'PostgreSQL 3-5 FSM'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL', '存储引擎']
weight = 307
ShowToc = true
TocOpen = true
+++
# 1 概述

## 1.1 思想

**fsm结构**

-   用数组表示完全二叉树

    ```bash
          | 8 |
        | 4 | 8 |
    | 4 | 2 | 1 |  8 |
    ```

## 1.2 FSM涉及

**物理页号**

```bash
            +-------+-------+-------+-------+-------+
FSMFile     | 8k     | 8k   | 8k    | 8k    | ...   |
            +-------+-------+-------+-------+-------+
FSMBlock    | 0     | 1     | 2     | 3     | ...   |
            +-------+-------+-------+-------+-------+
```

**逻辑页号**  
第2层：1个FSMBlock  
第1层：4069个FSMBlock  
第0层：4069 \* 4069个FSMBlock，每个FSM可映射4069个DataBlock  
FSMAddress: [层次，页号]，页号即FSMBlock号  
每个表最大容量是32T，只需3层也页面即可管理整个表的空闲空间

```bash
# [FSMAddress.level, FSMAddress.logpageno, FSMBlockNum（1个page即1个FSMBlock）]
                                             [2,0,0]
                                                |
                    +---------------------------+---------------------------+
                    |                           |                           |
                [1,0,1]                 [1,1,1*4070+1]  ...  [1,4069,4069*4070+1]  本层共4069个FSMBlock
                    |
         +----------+------------+
         |          |            |
    [2,0,1+1]  [2,1,1+2] ... [2,2,1+4069]     ......                                本层共4069*4069个FSMBlock
         |
（映射DataBlock 0 ~ 4065）
```

**整体架构**  
3层FSMBlock

```bash
                [8]
                [8 0]
                [8 0 0 0]
                [...]
                [8 0 0 0 0 ...]

        [8]
        [8 0]
        [8 0 0 0]
        [...]
        [8 0 0 0 0 ...]

[8]
[8 0]
[8 0 0 0]
[...]
[8 0 0 0 0 ...]
```

测试

```sql
CREATE TABLE t1(c1 INT, c2 TEXT);
INSERT INTO t1 VALUES(1, 'aaaaa');
CHECKPOINT;
VACUUM t1;
SELECT pg_relation_filepath('t1');
SELECT * FROM pg_stat_file('base/12926/16387_fsm');
-- output: size = 24576
```

第一个page的内容，且与第二个与第三个page内容一致

```bash
00000000  00 00 00 00 00 00 00 00  00 00 00 00 18 00 00 20  |............... |
00000010  00 20 04 20 00 00 00 00  00 00 00 00 fd fd 00 fd  |. . ............| # 00 20是special位置，fd开始为完全二叉树
00000020  00 00 00 fd 00 00 00 00  00 00 00 fd 00 00 00 00  |................|
00000030  00 00 00 00 00 00 00 00  00 00 00 fd 00 00 00 00  |................|
00000040  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
00000050  00 00 00 00 00 00 00 00  00 00 00 fd 00 00 00 00  |................|
00000060  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
*
00000090  00 00 00 00 00 00 00 00  00 00 00 fd 00 00 00 00  |................|
000000a0  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
*
00000110  00 00 00 00 00 00 00 00  00 00 00 fd 00 00 00 00  |................|
00000120  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
*
00000210  00 00 00 00 00 00 00 00  00 00 00 fd 00 00 00 00  |................|
00000220  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
*
00000410  00 00 00 00 00 00 00 00  00 00 00 fd 00 00 00 00  |................|
00000420  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
*
00000810  00 00 00 00 00 00 00 00  00 00 00 fd 00 00 00 00  |................|
00000820  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
*
00001010  00 00 00 00 00 00 00 00  00 00 00 fd 00 00 00 00  |................|
00001020  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
*
```

```c
/* FSMBlock 逻辑地址 */
typedef struct {
    int level;
    int logpageno; /* 当前层内的块号 */
} FSMAddress;

typedef struct {
    int fp_next_slot;
    uint8 fp_nodes[FLEXIBLE_ARRAY_MEMBER];
} FSMPage;

/* 每个FSMBlock中的节点数 8192 - 24 - 4 = 8164 */
#define NodesPerPage (BLCKSZ - MAXALIGN(SizeOfPageHeaderData) - offsetof(FSMPageData, fp_nodes))
/* 每个FSMBlock中的非叶子节点数 8192/2 - 1 = 4095 */
#define NonLeafNodesPerPage (BLCKSZ / 2 - 1)
/* 每个FSMBlock中的叶子节点数 8164 - 4095 = 4069 */
#define LeafNodesPerPage (NodesPerPage - NonLeafNodesPerPage)
/* 每个FSMBlock中slot数 4069 */
#define SlotsPerFSMPage LeafNodesPerPage

/* 根节点所在层号 0 */
#define FSM_ROOT_LEVEL  (FSM_TREE_DEPTH - 1)
/* 叶子节点所在的层号 0 */
#define FSM_BOTTOM_LEVEL 0
```

**叶子节点取值**  
用1个字节表示对应DataBlock的空闲空间级别  
每个级别表示32字节空闲空间

| 级别 | 对应data page的空闲空间 |
| --- | --- |
| 0 | 0 ~ 31 |
| 1 | 31 ~ 63 |
| 3 | 64 ~ 92 |
| … | … |
| 255 | 8164 ~ 8192 |

```c
/* FSM空闲空间级别 */
#define FSM_CATEGORIES  256
/* FSM空闲空间级别的步长 8192/256 = 32 */
#define FSM_CAT_STEP    (BLCKSZ / FSM_CATEGORIES)
```

# 2 需求

# 2.1 模块对外接口

```c
BlockNumber GetPageWithFreeSpace(Relation rel, Size spaceNeeded);
BlockNumber RecordAndGetPageWithFreeSpace(Relation rel, BlockNumber oldPage, Size oldSpaceAvail, Size spaceNeeded)
Size GetRecordedFreeSpace(Relation rel, BlockNumber heapBlk);
void RecordPageWithFreeSpace(Relation rel, BlockNumber heapBlk, Size spaceAvail);
void XLogRecordPageWithFreeSpace(RelFileNode rnode, BlockNumber heapBlk, Size spaceAvail);
void FreeSpaceMapVacuum(Relation rel);
void UpdateFreeSpaceMap(Relation rel, BlockNumber startBlkNum, BlockNumber endBlkNum, Size freespace);

Size GetRecordedFreeSpace(Relation rel, BlockNumber heapBlk)
    uint16 slog;
    FSMAddress	addr = fsm_get_location(heapBlk, &slot)
    Buffer buf = fsm_readbuf(rel, addr, false)
    unint8 cat = fsm_get_avail(BufferGetPage(buf), slot)
    return fsm_space_cat_to_avail(cat)
```

## 2.2 其他接口

```c
Size PageGetHeapFreeSpace(Page page)
    Size space = PageGetFreeSpace(page) {
        space = page->pd_upper - page->pd_lower
        if space < sizeof(ItemIdData):
            return 0;
        space -= sizeof(ItemIdData) /* 留1个td */
    }

    if space <= 0:
        return space
    OffsetNumber nline = PageGetMaxOffsetNumber(page) {
        (page->pd_lower - SizeOfPageHeaderData) / sizeof(ItemIdData)
    }
    if nline >= MaxHeapTuplesPerPage：
        ...
    return space
```

## 2.2 调用点

```c
/* 查找空闲空间 GetPageWithFreeSpace, RecordAndGetPageWithFreeSpace */
RelationGetBufferForTuple()
    /* 首先，通过FSM，获取1个DataBlock */
    targetBlock = GetPageWithFreeSpace()
    while targetBlock != InvalidBlockNumber:
        /* 不信任fsm，判断DataBlock的空闲空闲空间是否足够 */
        pageFreeSpace = PageGetHeapFreeSpace(page)
        if len + saveFreeSpace > pageFreeSpace:
            return buffer
        /* 重新通过FSM，获取1个DataBlock */
        targetBlock = RecordAndGetPageWithFreeSpace(relation, targetBlock, pageFreeSpace, len + saveFreeSpace)
GetFreeIndexPage()
    BlockNumber blkno = GetPageWithFreeSpace(BLCKSZ / 2)

/* 设置空闲空间 RecordPageWithFreeSpace */
lazy_scan_heap()
    freespace = PageGetHeapFreeSpace(page)
    RecordPageWithFreeSpace(onerel, blkno, freespace)
lazy_vacuum_heap(Relation onerel, LVRelStats *vacrelstats)
    freespace = PageGetHeapFreeSpace(page)
    RecordPageWithFreeSpace(onerel, tblk, freespace)
RecordFreeIndexPage()
    RecordPageWithFreeSpace(rel, freeBlock, BLCKSZ - 1)
RecordUsedIndexPage(Relation rel, BlockNumber usedBlock)
	RecordPageWithFreeSpace(rel, usedBlock, 0);

/* 设置空闲空间（xlog重放场景）XLogRecordPageWithFreeSpace */
heap_xlog_clean(XLogReaderState *record)
    XLogRecordPageWithFreeSpace(rnode, blkno, freespace)
heap_xlog_insert(XLogReaderState *record)
    XLogRecordPageWithFreeSpace(target_node, blkno, freespace)
heap_xlog_multi_insert(XLogReaderState *record)
    XLogRecordPageWithFreeSpace(rnode, blkno, freespace)
heap_xlog_update(XLogReaderState *record, bool hot_update)
    XLogRecordPageWithFreeSpace(rnode, newblk, freespace)

/* 更新FSM树 FreeSpaceMapVacuum */
```

# 2 函数

## 2.1 FSMBlock树 定位

```c
FSMAddress fsm_get_location(BlockNumber heapblk, uint16 *slot)
    FSMAddress addr
    addr.level = FSM_BOTTOM_LEVEL
    addr.logpageno = heapblk / SlotsPerFSMPage
    slot = heapblk % SlotsPerFSMPage
    return addr
BlockNumber fsm_get_heap_blk(FSMAddress addr, uint16 slot)
    Assert(addr.level == FSM_BOTTOM_LEVEL)
    return ((unsigned int)addr.logpageno) * SlotsPerFSMPage + slot
BlockNumber fsm_logical_to_physical(FSMAddress addr)
    int leafno = addr.logpageno
    for (l = 0; l < addr.level; l++)
        leafno *= SlotsPerFSMPage /* e.g [1,1] = 1 * 4069 */
    BlockNumber pages = 0
    for (l = 0; l < FSM_TREE_DEPTH; l++)
        pages += leafno + 1 /* e.g [1,1] -> 4069 -> 4069 + 1 */
        leafno /= SlotsPerFSMPage
    pages -= addr.level
    return pages - 1
FSMAddress fsm_get_child(FSMAddress parent, uint16 slot) /* slog为块内地址 */
    FSMAddress child
    child.level = parent.level - 1
    child.logpageno = parent.logpageno * SlotsPerFSMPage + slot
    return child
FSMAddress fsm_get_parent(FSMAddress child, uint16 *slot)
    SMAddress parent
    parent.level = child.level + 1
    parent.logpageno = child.logpageno / SlotsPerFSMPage
    *slot = child.logpageno % SlotsPerFSMPage

/* FSMBlock树查找 */
BlockNumber fsm_search(Relation rel, uint8 min_cat)
    FSMAddress addr = FSM_ROOT_ADDRESS
    uinit8 max_avail = 0
    for (;;):
        Buffer buf = fsm_readbuf(addr)
        if BufferIsValid(buf):
            LockBuffer(buf, BUFFER_LOCK_SHARE)
            /* 进行当前FSMBlock块内搜索 */
            slot = fsm_search_avail(buf, min_cat, (addr.level == FSM_BOTTOM_LEVEL))
            if slog == -1:
                max_avail = fsm_get_max_avail(BufferGetPage(buf))
        /* 如果当前FSMBlock已找到合适的节点 */
        if slot != -1:
            if addr.level == FSM_BOTTOM_LEVEL： /* 符合条件，直接返回 */
                return fsm_get_heap_blk(addr, slot)
            else: /* 当前FSMBlock为0层或1层非叶子FSMBlock，从子节点中继续搜索 */
                addr = fsm_get_child(addr, slot)
        /* 0层FSMBlock无合适节点，直接返回 */
        else if addr.level == FSM_ROOT_LEVEL:
            return InvalidBlockNumber
        /* 0层满足，说明1层中至少1个FSMBlock满足，2层中至少1个叶子FSMBlock满足 */
        else: /* 如果在1层和2层都无满足条件的节点，说明1层或2层FSMBlock中的最大值被用了，重新返回根节点开始扫描 */
            uint16 parentslot
            FSMAddress parent = fsm_get_parent(addr, &parentslot)
            fsm_set_and_search(rel, parent, parentslot, max_avail)
            if restarts++ > 1000:
                return InvalidBlockNumber
            addr = FSM_ROOT_ADDRESS
```

## 2.2 FSMBlock读写

```c
/* 初始化fsm page */
fsm_extend(Relation rel)
    PageInit(page)
    fsm_nblocks_now = smgrnblocks(rel->rd_smgr, FSM_FORKNUM)
    smgrextend(rel->rd_smgr, FSM_FORKNUM, fsm_nblocks_now)

/* 读取fsm page */
Buffer fsm_readbuf(Relation rel, FSMAddress addr)
    lockNumber blkno = fsm_logical_to_physical(addr)
    buf = ReadBufferExtended(rel, FSM_FORKNUM)
    if PageIsNew(BufferGetPage(buf))
        PageInit(BufferGetPage(buf))
    return buf
```

## 2.3 FSMBlock内定位

```c
/* 完全二叉树 */
#define leftchild(x)    (2 * (x) + 1)
#define rightchild(x)   (2 * (x) + 2)
#define parentof(x)     (((x) - 1) / 2)

int fsm_search_avail(Buffer buf, uint8 min_cat, bool advancenext, bool exclusive_lock_held);
uint8 fsm_get_avail(Page page, int slot);
uint8 fsm_get_max_avail(Page page);
bool fsm_set_avail(Page page, int slot, uint8 value);
bool fsm_truncate_avail(Page page, int nslots);
bool fsm_rebuild_page(Page page);

/* FSMBlock内查找，FSMBlock是大根对 */
int fsm_search_avail(Buffer buf, uint8 minvalue, bool advancenext, bool exclusive_lock_held)
restart:
    /* 先判断根节点，如果本Block内的空闲空间较小，直接返回 */
    if fsmpage->fp_nodes[0] < minvalue:
        return -1;

    /* 从上一次查找的叶子节点开始查找 */
    FSMPage	fsmpage = (FSMPage)PageGetContents(BufferGetPage(buf))
    int target = fsmpage->fp_next_slot
    if target < 0 || target >= LeafNodesPerPage:
        target = 0
    target += NonLeafNodesPerPage

    /* 从子节点上升至满足条件的父节点 */
    int nodeno = target
    while nodeno > 0:
        if fsmpage->fp_nodes[nodeno] >= minvalue:
            break;
        nodeno = parentof(rightneighbor(nodeno))

    /* 从满足条件的父节点开始查找子节点 */
    while nodeno < NonLeafNodesPerPage:
        /* 先判断左孩子 */
        int childnodeno = leftchild(nodeno)
        if childnodeno < NodesPerPage && fsmpage->fp_nodes[childnodeno] >= minvalue:
            nodeno = childnodeno
            continue
        /* 再判断右孩子 */
        childnodeno++
        if childnodeno < NodesPerPage && fsmpage->fp_nodes[childnodeno] >= minvalue:
            nodeno = childnodeno
        else:
            /* 左右孩子都不满足，可能写FSMBlock时发生奔溃，需重建FSMBlock */
            RelFileNode rnode
            ForkNumber forknum
            BlockNumber blknum
            BufferGetTag(buf, &rnode, &forknum, &blknum)
            LockBuffer(buf, BUFFER_LOCK_EXCLUSIVE)
            fsm_rebuild_page(page)
            MarkBufferDirtyHint(buf, false)
            goto restart

    /* 找到叶子节点，返回叶子节点索引 */
    slot = nodeno - NonLeafNodesPerPage
    fsmpage->fp_next_slot = slot + (advancenext ? 1 : 0) /* 大部分场景下，返回的DataBlock会被插入多条数据，下一次查找FSM时，直接从下一个FSMBlock查找即可 */
    return slot
```

-   [https://www.jianshu.com/p/4064dbb72414](https://www.jianshu.com/p/4064dbb72414)
