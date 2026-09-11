+++
title = 'PostgreSQL 3-7 Xlog'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['PostgreSQL']
tags = ['PostgreSQL']
weight = 305
ShowToc = true
TocOpen = true
+++
# 5 wal落盘

```python
WalWriterMain
    for ::
        XLogBackgroundFlush
            LWLockAcquire(LW_EXCLUSIVE)
            XLogWrite
            LWLockRelease()

CommitTransaction
    RecordTransactionCommit
        BufmgrCommit
        XactLogCommitRecord # xlog记录commit
        TransactionTreeSetCommitTsData
        XLogFlush(XactLastRecEnd)
            for ::
                WaitXLogInsertionsToFinish
                XLogWrite
                write
    ResourceOwnerRelease
    AtEOXact_Buffers
    AtEOXact_RelationCache
    ...
```

# 1 概述

## 1.1 背景

[https://zhmin.github.io/posts/postgresql-wal-format/](https://zhmin.github.io/posts/postgresql-wal-format/)  
wal机制解决的问题：持久性、原子性、性能、数据同步、恢复

-   持久性需求：
    -   执行一次事务/事务块，例如INSERT语句，除了要写数据文件，还需要更新系统表、索引文件、fsm文件、vm文件、事务提交文件等
    -   为避免故障导致数据丢失，产生的数据写入磁盘才算事务成功

        ```bash
        应用                    数据库                  磁盘
        | 1. INSERT (5) -->     |
                                | 2. 读取数据页 <--     |
                                | 3. 将数据写入数据页
                                | 4. 存储数据页  -->    |
                                | 5. 读取索引文件 -->   |
                                | 6...
                                | 7. 读取fsm文件 -->    |
                                | 8...
                                | 9. 读取vm文件 -->     |
                                | 10...
        | 11. INSERT 成功   <-- |
        ```

-   原子性需求：
    -   大量连续读写可能会失败，如果中途失败，无法恢复现场
-   性能需求：
    -   首先，执行一次事务或事务块，涉及大量IO操作，且都是随机读写
-   数据同步：
    -   主机和备机之间数据同步问题
-   恢复
    -   故障恢复
    -   时间点恢复

## 1.2 解决方案

lsn

```sql
-- 查看当前lsn
SELECT pg_current_wal_lsn();
-- 查看当前lsn的文件名
SELECT pg_walfile_namae(pg_current_wal_lsn());
SELECT pg_walfile_name_offset(pg_current_wal_lsn());
-- 查看你page的lsn
SELECT lsn FROM page_header(get_raw_page('t1', 0));
```

wal文件命令：24个字符，每个字符为16进制

```c
00000000 00000000 00000000
 时间线    逻辑id   物理id
```

[http://dbaselife.com/doc/1955/](http://dbaselife.com/doc/1955/)

## 1.1 格式

通用的xlog记录格式 (pg 9.5+)

```bash
+---------------------------------+
| XLogRecord                      |
+---------------------------------+ 设置对应flag则有BlockHeader，否则没有
| XlogRecordBlockHeader           | 设置flag
|   XLogRecordBlockImageHeader    | - if BKPBLOCK_HAS_IMAGE
|   XLogRecordBlockCompressHeader | - if BKPBLOCK_HAS_HOLE & BKPIMAGE_IS_COMPRESSED
|   RelFileNode                   | - if not BKPBLOCK_SAME_REL
| XlogRecordBlockHeader           |
| ...                             |
+---------------------------------+
| XlogRecordDataHeader            | Short/Long (判断条件：长度 < 256 bytes)
+---------------------------------+
| block data                      |
| block data                      |
| ...                             |
| data                            |
+---------------------------------+
```

各字段结构体定义

```c
/* 1 */
typedef struct {
    uint32          xl_tot_len; /* 本条xlgo记录全部长度 */
    TransactionId   xl_xid;
    XLogRecPtr      xl_prev;    /* 上一条xlog记录的位置 */
    uint8		    xl_info;    /* 资管管理器使用，判断调用哪个重放函数 */
    RmgrId		    xl_rmid;    /* 资源管理器 */
    pg_crc32c	    xl_crc;		/* 本条xlog记录的crc */
} XLogRecord;

/* 2 */
typedef struct {
    uint8		id;	         /* block reference id */
    uint8		fork_flags;
    uint16		data_length; /* 数据实际长度，不包括image */

	/* If BKPBLOCK_HAS_IMAGE, an XLogRecordBlockImageHeader struct follows */
	/* If BKPBLOCK_SAME_REL is not set, a RelFileNode follows */
	/* BlockNumber follows */
} XLogRecordBlockHeader;

/* 其中，根据fork_flags，判断是否有其他BlockHeader */
#define BKPBLOCK_HAS_IMAGE	0x10	/* block data is an XLogRecordBlockImage */
#define BKPBLOCK_HAS_DATA	0x20
#define BKPBLOCK_WILL_INIT	0x40	/* redo will re-init the page */
#define BKPBLOCK_SAME_REL	0x80	/* RelFileNode omitted, same as previous */

typedef struct {
	uint16		length;			/* number of page image bytes */
	uint16		hole_offset;	/* number of bytes before "hole" */
	uint8		bimg_info;		/* flag bits, see below */
} XLogRecordBlockImageHeader;

typedef struct {
    uint16		hole_length; /* number of bytes in "hole" : page中没有数据的tup就是孔 */
} XLogRecordBlockCompressHeader;

/* 3 */
typedef struct {
	uint8		id;				/* XLR_BLOCK_ID_DATA_SHORT */
	uint8		data_length;	/* number of payload bytes */
} XLogRecordDataHeaderShort;

typedef struct {
	uint8		id;				/* XLR_BLOCK_ID_DATA_LONG */
} XLogRecordDataHeaderLong;

/* 其中，id的取值包括 */
#define XLR_MAX_BLOCK_ID			32
#define XLR_BLOCK_ID_DATA_SHORT		255
#define XLR_BLOCK_ID_DATA_LONG		254
#define XLR_BLOCK_ID_ORIGIN			253
```

## 1.2 插入顺序

```c
XLogBeginInsert() /* 检查受否在故障恢复 */
XLogRegisterData(data, datasz) /*  */
XLogRecPtr XLogInsert(RmgrId rmid, uint8 info)
XLogFlush(XLogRecPtr record)
```

heap_insert

```c
/* 结构体：输入 */
typedef struct {
    uint32 t_len;
    ItemPointerData t_self;
    Oid t_tableOid;
    HeapTupleHeader t_data;
} HeapTuple;

/* 输出 */
typedef struct {
    OffsetNumber offnum;
    uint8        flags;
} xl_heap_insert;

typedef struct {
    uint16 t_infomask2;
    uint16 t_infomask
    uint8  t_hoff;
} xl_heap_header;

/* 执行流程 */
HeapTuple tup;

xl_heap_insert xlrec;
xl_heap_header xlhdr;
uint8 info = XLOG_HEAP_INSERT;
int bufflags = 0;
XLogRecPtr recptr;

xlrec.offnum = tup.t_self.offset;
xlrec.flag = 0; /* if page XLH_INSERT_ALL_VISIBLE_CLEARED XLH_INSERT_IS_SPECULATIVE */

xlhdr.t_infomask2 = tup->t_data->t_infomask2;
xlhdr.t_infomask = tup->t_data->t_infomask;
xlhdr.t_hoff = tup->t_data->t_hoff;

XLogBeginInsert()
/* put tup place */
XLogRegisterData(&xlrec, sizeof(xlrec));
/* put buffer where tup come from */
XLogRegisterBuffer(0, buffer, bufflags | REGBUF_STANDARD);
/* put tup */
XLogRegisterBufData(0, &xlhdr, sizeof(xlhdr));
XLogRegisterBufData(0, tup->t_data + sizeof(HeapTupleHeader), tup->t_len - sizeof(HeapTupleHeader));
XLogIncludeOrigin();
recptr = XLogInsert(RM_HEAP_ID, info);

PageSetLSN(page, recptr);
```

内部实现：

```c
typedef struct XlogRecData {
    struct XlogRecData *next;
    char *data;
    uint32 len;
} XLogRecData;

/* 进程级全局变量：

+-------------+-------------+-------------+
| XLogRecData | XLogRecData | ...         |
+-------------+-------------+-------------+
              ^ last
*/

XLogRecData *rdatas; /* XLogRecData 数组, len = 20 */
int num_rdatas;
int max_rdatas;

XLogRecData *mainrdata_head;
XLogRecData *mainrdata_last;
uint32 mainrdata_len; /* chain中的数据总长度 */

XLogRegisterData(data, len)
    XLogRecData *rdata = rdatas[num_rdatas++]; /* global arr */
    rdata->data = data;
    rdata->len = len;

    mainrdata_last->next = rdata;
    mainrdata_last = rdata;
    mainrdata_len += len;

typedef struct {
    bool        in_use;
    uint8       flags;
    RelFileNode rnode;
    ForkNumber	forkno;
    BlockNumber block;
    Page		page;

    uint32		rdata_len; /* total length of data in rdata chain */
    XLogRecData *rdata_head;
    XLogRecData *rdata_tail;
    XLogRecData bkp_rdatas[2]; /* temporary rdatas */

    char compressed_page[8192 + 4];
} registered_buffer;

/* 进程级全局变量：

+-------------------+-------------------+-------------+
| registered_buffer | registered_buffer | ...         |
+-------------------+-------------------+-------------+
|-> rdata -> rdata  |-> ...
*/

registered_buffer *registered_buffers; /* len = 4 + 1, may realloc */
int max_registered_buffers;
int max_registered_block_id = 4 + 1;

XLogRegisterBuffer(block_id, buffer, flags)
    /* block_id = 0 */
    max_registered_block_id += (block_id >= max_registered_block_id) ? 1 : 0;

    registered_buffer regbuf = &registered_buffers[block_id]; /* global arr */
    BufferGetTag(buffer, &regbuf->rnode, &regbuf->forkno, &regbuf->block);
	regbuf->page = BufferGetPage(buffer);
	regbuf->flags = flags;

	regbuf->rdata_tail = (XLogRecData *) &regbuf->rdata_head;
	regbuf->rdata_len = 0;
    regbuf->in_use = true;

XLogRegisterBufData(block_id, data, len)
    XLogRecData *rdata = &rdatas[num_rdatas++]; /* global arr */
    rdata->data = data;
    rdata->len = len;

    registered_buffer *regbuf = &registered_buffers[block_id]; /* global arr */
    regbuf->rdata_tail->next = rdata;
    regbuf->rdata_tail = rdata;
    regbuf->rdata_len += len;

typedef uint64 XLogRecPtr;

/* 进程全局变量 */
XLogRecPtr RedoRecPtr;
bool doPageWrites;

/* 1 */
XLogInsert(rmid, info)
    XLogRecPtr	fpw_lsn;
    XLogRecData rdt = XLogRecordAssemble(rmid, info, RedoRecPtr, doPageWrites, &fpw_lsn) /* 封装头部 */
    XLogRecPtr EndPos = XLogInsertRecord(rdt, fpw_lsn); /* 封装数据 */
    return EndPos; /* 即 page lsn */

XLogRecData hdr_rdt; /* 把所有buffer里和buffer外的所有list merge在一起 */
char *hdr_scratch = NULL; /* 把所有buffer里和buffer外的所有数据拼接在一起 */

/* 1.1 */
XLogRecData *XLogRecordAssemble(rmid, info, RedoRecPtr, doPageWrites, fpw_lsn)
    char	   *scratch = hdr_scratch;
    XLogRecord *rechdr = (XLogRecord)scratch;
    scratch += sizeof(XLogRecord);

    hdr_rdt.next = NULL;
	XLogRecData *rdt_datas_last = &hdr_rdt;
	hdr_rdt.data = hdr_scratch;

    /* 处理buffer */
    registered_buffer *prev_regbuf = NULL;
    for (block_id = 0; block_id < max_registered_block_id; block_id++) {
        registered_buffer *regbuf = &registered_buffers[block_id]

        if !regbuf->in_use:
            continue;

        if regbuf->flags & REGBUF_FORCE_IMAGE：
            needs_backup = true
        else：
            XLogRecPtr	page_lsn = PageGetLSN(regbuf->page);
            if *fpw_lsn == InvalidXLogRecPtr || page_lsn < *fpw_lsn:
                *fpw_lsn = page_lsn;

        if regbuf->rdata_len == 0:
            needs_data = false;

        XLogRecordBlockHeader bkpb;
		bkpb.id = block_id;
		bkpb.fork_flags = regbuf->forkno;
		bkpb.data_length = 0;

        if regbuf->flags & REGBUF_WILL_INIT:
            bkpb.fork_flags |= BKPBLOCK_WILL_INIT;

        if needs_backup:
            TODO

        if needs_data:
			bkpb.fork_flags |= BKPBLOCK_HAS_DATA;
			bkpb.data_length = regbuf->rdata_len;
			total_len += regbuf->rdata_len;

			rdt_datas_last->next = regbuf->rdata_head;
			rdt_datas_last = regbuf->rdata_tail;

        if prev_regbuf && regbuf->rnode == prev_regbuf->rnode:
            samerel = true;
            bkpb.fork_flags |= BKPBLOCK_SAME_REL;
        else:
            samerel = false;
        prev_regbuf = regbuf;

        memcpy(scratch, &bkpb, sizeof(XLogRecordBlockHeader));
        scratch += sizeof(XLogRecordBlockHeader);
        if (!samerel):
            memcpy(scratch, &regbuf->rnode, sizeof(RelFileNode));
            scratch += sizeof(RelFileNode);
        memcpy(scratch, &regbuf->block, sizeof(BlockNumber));
        scratch += sizeof(BlockNumber);
    }

    if (mainrdata_len > 0)
        if (mainrdata_len > 255)
            *(scratch++) = XLR_BLOCK_ID_DATA_LONG; /* 255 */
            memcpy(scratch, &mainrdata_len, sizeof(uint32));
            scratch += sizeof(uint32);
        else:
            *(scratch++) = XLR_BLOCK_ID_DATA_SHORT; /* 254 */
            *(scratch++) = (uint8) mainrdata_len;

        rdt_datas_last->next = mainrdata_head;
		rdt_datas_last = mainrdata_last;
		total_len += mainrdata_len;
    rdt_datas_last->next = NULL;

    hdr_rdt.len = (scratch - hdr_scratch);
    total_len += hdr_rdt.len;

    COMP_CRC32C(rdata_crc, hdr_scratch + sizeof(XLogRecord), hdr_rdt.len - sizeof(XLogRecord));
	for (rdt = hdr_rdt.next; rdt != NULL; rdt = rdt->next)
		COMP_CRC32C(rdata_crc, rdt->data, rdt->len);

	rechdr->xl_xid = GetCurrentTransactionIdIfAny();
	rechdr->xl_tot_len = total_len;
	rechdr->xl_info = info;
	rechdr->xl_rmid = rmid;
	rechdr->xl_prev = InvalidXLogRecPtr;
	rechdr->xl_crc = rdata_crc;

    return &hdr_rdt;

/* 1.2 */
XLogRecPtr XLogInsertRecord(XLogRecData rdata, XLogRecPtr fpw_lsn)
    XLogCtlInsert *Insert = &XLogCtl->Insert;
    XLogRecord *rechdr = (XLogRecord *) rdata->data;

    isLogSwitch = rechdr->xl_rmid == RM_XLOG_ID && rechdr->xl_info == XLOG_SWITCH
    if isLogSwitch:
        WALInsertLockAcquireExclusive()
    else:
        WALInsertLockAcquire()

    if RedoRecPtr != Insert->RedoRecPtr:
        RedoRecPtr = Insert->RedoRecPtr;
    doPageWrites = Insert->fullPageWrites || Insert->forcePageWrites;

    XLogRecPtr	StartPos;
    XLogRecPtr	EndPos;
    if isLogSwitch:
        insert = ReserveXLogSwitch(&StartPos, &EndPos, &rechdr->xl_prev)
    else:
        ReserveXLogInsertLocation(rechdr->xl_tot_len, &StartPos, &EndPos, &rechdr->xl_prev)
        inserted = true

    if inserted:
        CopyXLogRecordToWAL(rechdr->xl_tot_len, isLogSwitch, rdata, StartPos, EndPos) /* 封装实际数据 */

    WALInsertLockRelease();
    MarkCurrentTransactionIdLoggedIfAny();

    /* Update shared LogwrtRqst.Write, if we crossed page boundary */
    if StartPos / XLOG_BLCKSZ != EndPos / XLOG_BLCKSZ:
        if XLogCtl->LogwrtRqst.Write < EndPos:
            XLogCtl->LogwrtRqst.Write = EndPos; /* 更新所有进程的xlog写入位置 */
        LogwrtResult = XLogCtl->LogwrtResult;

    if isLogSwitch:
        XLogFlush(EndPos)
        TODO

    ProcLastRecPtr = StartPos;
    XactLastRecEnd = EndPos;

/* 1.2.1 */
CopyXLogRecordToWAL(int write_len, XLogRecData *rdata, XLogRecPtr StartPos, XLogRecPtr EndPos)
    char *currpos = StartPos
    currpos = GetXLogBuffer(CurrPos)
    freespace = INSERT_FREESPACE(CurrPos)

    while (rdata != NULL)
        char *rdata_data = rdata->data
        int rdata_len = rdata->len

        while (rdata_len > freespace)
            memcpy(currpos, rdata_data, freespace)
            rdata_data += freespace
            rdata_len -= freespace
            written += freespace
            CurrPos += freespace

            currpos = GetXLogBuffer(CurrPos)
            ...

        memcpy(currpos, rdata_data, rdata_len)
        ...

    if isLogSwitch
        while (CurrPos < EndPos)
            WALInsertLockUpdateInsertingAt(CurrPos)
            AdvanceXLInsertBuffer(CurrPos)
```

## 1.4 log page

```c
log_newpage_buffer()
```

# 2 xlog重放

```c
XLogReaderState *xlogreader = XLogReaderAllocate();
    XLogRecord record = ReadRecord(xlogreader);
    do {
        RmgrTable[record->xl_rmid].rm_redo(xlogreader);
        record = ReadRecord(xlogreader);
    }

heap_redo(XLogReaderState *record)
    uint8 info = XLogRecGetInfo(record) & ~XLR_INFO_MASK;
    switch info & XLOG_HEAP_OPMASK:
        case XLOG_HEAP_INSERT:
            heap_xlog_insert(record)
        case XLOG_HEAP_DELETE:
            TODO

heap_xlog_insert(XLogReaderState *record)
    XLogRecPtr	lsn = record->EndRecPtr;

    RelFileNode target_node;
    XLogRecGetBlockTag(record, 0, &target_node, NULL, &blkno);

    /*  set tup's offset */
    ItemPointerData target_tid;
    ItemPointerSetBlockNumber(&target_tid, blkno);
    ItemPointerSetOffsetNumber(&target_tid, xlrec->offnum);

    xl_heap_insert *xlrec = (xl_heap_insert *) XLogRecGetData(record);
    if XLogRecGetInfo(record) = XLOG_HEAP_INIT_PAGE
        buffer = XLogInitBufferForRedo(record)
        page = BufferGetPage(buffer)
        PageInit(page)
    else
        action = XLogReadBufferForRedo(record, &buffer)
```

```c
// 1 插入阶段
heap_insert()
    LogBeginInsert()
    XLogRegisterData(data, datasz)
    XLogRegisterBuffer(0, buffer, bufflags)
    XLogRegisterBufData0(0, data, datasz)
    XLogRegisterBufData(o, data, datasz)
    XLogIncludeOrigin()
    XLogRecPtr = XLogInsert(RM_HEAP_ID, XLOG_HEAP_INSERT | XLOG_HEAP_INIT_PAGE)

// 2 组装阶段 - 调用assemble
XLogInsert()
    XLogRecPtr RedoRecPtr
    XLogRecPtr fpw_lsn
    GetFullPageWriteInfo(&RedoRecPtr)
    XLogRecData *tdt = XLogRecordAssemble(rmid, info, doPageWrites, &fpw_lsn)
    XLogRecPtr EndPos = XLogInsertRecord(rdt, fpw_lsn)

// assemble 返回值
typedef struct XLogRecData {
    struct XLogRecData *next;
    char *data;
    uint32 len;
} XLogRecData;  /* 物理xlog：header + main的list */

typedef uint64 XLogRecPtr;

// 物理xlog的头部
typedef struct XLogRecord {
    uint32 xl_tot_len;
    TransactionId xl_xid;
    XLogRecPtr xl_prev; /* 前一条物理xlog */
    uint8 xl_info;
    RmgrId xl_rmid;
    pg_crc32c xl_crc;
} XLogRecord;

// 2.1 assemble 组装
XLogRecData *XLogRecordAssemble(rmid, info, doPageWrites) /* RM_HEAP_ID, XLOG_HEAP_INSERT | XLOG_HEAP_INIT_PAGE */
    for (block_id = 0; block_id < max_registered_block_id; block_id++) {
        // 1 依次获取 block / buffer
        registered_buffer *regbuf = &registered_buffers[block_id]

        // 2 判断是否写 full-page
        if :
            ...
        else:
            XLogRecPtr page_lsn = PageGetLSN(regbuf->page)
                needs_backup = (page_lsn <= RedoRecPtr) // page的lsn小于xlog的lsn

        // 3 构造 BlockHeader
        XLogRecordBlockHeader bkpb
        bkpb.id = block_id
        bkpb.fork_flags = regbuf->forkno
        if regbuf->flags & REGBUF_WILL_INIT:
            bkpb.fork_flags |= BKPBLOCK_WILL_INIT

        // 4 拼接 page image
        if needs_backup: // header后紧跟page imge
            Page page = regbuf->page
            if regbuf->flags & REGBUF_STANDARD: // 计算孔洞
                bimg.hole_offset = lower
                cbimg.hole_length = upper - lower
            if wal_compression: // 压缩page
                is_compressed = XLogCompressBackupBlock(page, bimg.hole_offset, cbimg.hole_length, regbuf->compressed_page, &compressed_len)
            bkpb.fork_flags |= BKPBLOCK_HAS_IMAGE
            if is_compressed:
                // 物理数据 | XLogRecord--BlockNumber | regbuf->compressed_page
            else:
                bimg.length = BLCKSZ - cbimg.hole_length
                if cbimg.hole_length == 0
                    // 物理数据 | XLogRecord--BlockNumber | regbuf->page
                    rdt_datas_last->data = page
                    rdt_datas_last->len = BLCKSZ
                else:
                    // page分成两部分存：page起始到hole起始，hole结束到page结束
                    // 物理数据 | XLogRecord--BlockNumber | regbuf->page--hole_offset |   regbuf->page--hole_offset--hole_length |

        // 5 拼接 tuple data
        if needs_data:
            // // 物理数据 | XLogRecord--BlockNumber | regbuf->page | data1 | data2 | ... |
            bkpb.fork_flags |= BKPBLOCK_HAS_DATA
            bkpb.data_length = regbuf->rdata_len

            rdt_datas_last->next = regbuf->rdata_head
            rdt_datas_last = regbuf->rdata_tail

        // 6 继续填充 BlockHeader
        if prev_regbuf && RelFileNodeEquals(regbuf->rnode, prev_regbuf->rnode):
            samerel = true
            bkpb.fork_flags |= BKPBLOCK_SAME_REL
        prev_regbuf = regbuf
        // 物理数据：| XLogRecord  XLogRecordBlockHeader | regbuf->page | ...
        memcpy(scratch, &bkpb, sizeof(XLogRecordBlockHeader))

        // 7 继续填充
        if needs_backup:
            // 物理数据：| XLogRecord XLogRecordBlockHeader XLogRecordBlockImageHeader | regbuf->page | ...
            memcpy(scratch, &bimg, sizeof(XLogRecordBlockImageHeader))
            if cbimg.hole_length != 0 && is_compressed:
                // 物理数据：| XLogRecord XLogRecordBlockHeader XLogRecordBlockImageHeader XLogRecordBlockCompressHeader | regbuf->page | ...
                memcpy(scratch, &cbimg, sizeof(XLogRecordBlockCompressHeader))
        if samerel:
            // 物理数据：| XLogRecord XLogRecordBlockHeader XLogRecordBlockImageHeader XLogRecordBlockCompressHeader RelFileNode | regbuf->page | ...
            memcpy(scratch, &regbuf->rnode, sizeof(RelFileNode))
        /*
         * 物理数据：（list的第一个node）
         *  | XLogRecord
         *  | XLogRecordBlockHeader  -----------+ 可能重复多次
         *  | XLogRecordBlockImageHeader        |
         *  | XLogRecordBlockCompressHeader     |
         *  | RelFileNode                       |
         *  | BlockNumber ----------------------+
         *  | ... 重复
         */
        memcpy(scratch, &regbuf->block, sizeof(BlockNumber))
    } // 结束遍历 Block

    /*
    * 物理数据：（list的第一个node）
    *  | XLogRecord
    *  | XLogRecordBlockHeader  -----------+ 可能重复多次
    *  | XLogRecordBlockImageHeader        |
    *  | XLogRecordBlockCompressHeader     |
    *  | RelFileNode                       |
    *  | BlockNumber ----------------------+
    *  | ... 重复
    *  | XLR_BLOCK_ID_ORIGIN
    *  | replorigin_session_origin (uint16)
    *  | XLR_BLOCK_ID_DATA_SHORT
    *  | mainrdata_len
    */
    if include_origin && replorigin_session_origin:
        *(scratch++) = XLR_BLOCK_ID_ORIGIN
        memcpy(scratch, &replorigin_session_origin, sizeof(replorigin_session_origin))

    // 4 拼接 maindata
        /*
        * [XLogRecord-...-BlockNumber] -> [page1] -> [page2]-> [page1 data1] -> [page2 data2] ->  [maindata] -> [maindata] -> [...]
        */
        if mainrdata_len > 0 :
            *(scratch++) = XLR_BLOCK_ID_DATA_LONG / XLR_BLOCK_ID_DATA_SHORT
            memcpy(scratch, &mainrdata_len, sizeof(uint32))

            rdt_datas_last->next = mainrdata_head
            rdt_datas_last = mainrdata_last
```

xlog完整格式

```bash
# 物理xlog
|   list 节点                   | 是否必选                 描述
+-------------------------------+---+-----------------------------------------------------------------
| XLogRecord                    | Y |
|   << loop start >>            | - |
| XLogRecordBlockHeader         | N | 有page时 {id, fork_flags, data_length} : INIT_PAGE HAS_IMAGE HAS_DATA
| XLogRecordBlockImageHeader    | N | 有page时，写入full-page镜像
| XLogRecordBlockCompressHeader | N | 有page时，写入full-page镜像，开启压缩
| RelFileNode                   | N | 有page时
| BlockNumber                   | N | 有page时
|   << loop end >>              | - |
| XLR_BLOCK_ID_ORIGIN           | N |
| replorigin_session_origin     | N |
| XLR_BLOCK_ID_DATA_SHORT/LONG  | N | 有maindata时（可能有误）
| mainrdata_len                 | N | 有maindata时
+-------------------------------|---|-----------------------------------------------------------------
| page start -- hole start      | N | 有page时，写入full-page镜像
+-------------------------------|---|-----------------------------------------------------------------
| hole end -- page end          | N |
+-------------------------------|---|-----------------------------------------------------------------
| block1_data1                  | N | xl_heap_header {t_infomask2, t_infomask, t_hoff} : 记录tuple信息
+-------------------------------|---|-----------------------------------------------------------------
| block1_data2                  | N | tuple->t_data : 记录tuple数据
+-------------------------------|---|-----------------------------------------------------------------
| block2_data1                  | N |
+-------------------------------|---|-----------------------------------------------------------------
| block...                      | N |
+-------------------------------|---|-----------------------------------------------------------------
| maindata1                     | N | xl_heap_insert {OffsetNumber, flags} ： 记录tuple位置
+-------------------------------|---|-----------------------------------------------------------------
| maindata2                     | N |
+-------------------------------|---|-----------------------------------------------------------------
| maindata...                   | N |
+-------------------------------|---|-----------------------------------------------------------------
```

```c
/* symbol name, textual name, redo, desc, identify, startup, cleanup */
PG_RMGR(RM_XLOG_ID, "XLOG", xlog_redo, xlog_desc, xlog_identify, NULL, NULL)
PG_RMGR(RM_XACT_ID, "Transaction", xact_redo, xact_desc, xact_identify, NULL, NULL)
PG_RMGR(RM_SMGR_ID, "Storage", smgr_redo, smgr_desc, smgr_identify, NULL, NULL)
PG_RMGR(RM_CLOG_ID, "CLOG", clog_redo, clog_desc, clog_identify, NULL, NULL)
PG_RMGR(RM_DBASE_ID, "Database", dbase_redo, dbase_desc, dbase_identify, NULL, NULL)
PG_RMGR(RM_TBLSPC_ID, "Tablespace", tblspc_redo, tblspc_desc, tblspc_identify, NULL, NULL)
PG_RMGR(RM_MULTIXACT_ID, "MultiXact", multixact_redo, multixact_desc, multixact_identify, NULL, NULL)
PG_RMGR(RM_RELMAP_ID, "RelMap", relmap_redo, relmap_desc, relmap_identify, NULL, NULL)
PG_RMGR(RM_STANDBY_ID, "Standby", standby_redo, standby_desc, standby_identify, NULL, NULL)
PG_RMGR(RM_HEAP2_ID, "Heap2", heap2_redo, heap2_desc, heap2_identify, NULL, NULL)
PG_RMGR(RM_HEAP_ID, "Heap", heap_redo, heap_desc, heap_identify, NULL, NULL)
PG_RMGR(RM_BTREE_ID, "Btree", btree_redo, btree_desc, btree_identify, NULL, NULL)
PG_RMGR(RM_HASH_ID, "Hash", hash_redo, hash_desc, hash_identify, NULL, NULL)
PG_RMGR(RM_GIN_ID, "Gin", gin_redo, gin_desc, gin_identify, gin_xlog_startup, gin_xlog_cleanup)
PG_RMGR(RM_GIST_ID, "Gist", gist_redo, gist_desc, gist_identify, gist_xlog_startup, gist_xlog_cleanup)
PG_RMGR(RM_SEQ_ID, "Sequence", seq_redo, seq_desc, seq_identify, NULL, NULL)
PG_RMGR(RM_SPGIST_ID, "SPGist", spg_redo, spg_desc, spg_identify, spg_xlog_startup, spg_xlog_cleanup)
PG_RMGR(RM_BRIN_ID, "BRIN", brin_redo, brin_desc, brin_identify, NULL, NULL)
PG_RMGR(RM_COMMIT_TS_ID, "CommitTs", commit_ts_redo, commit_ts_desc, commit_ts_identify, NULL, NULL)
PG_RMGR(RM_REPLORIGIN_ID, "ReplicationOrigin", replorigin_redo, replorigin_desc, replorigin_identify, NULL, NULL)
```

## 2.1 HEAP

```c
#define XLOG_HEAP_INSERT		0x00
#define XLOG_HEAP_DELETE		0x10
#define XLOG_HEAP_UPDATE		0x20
/* 0x030 is free, was XLOG_HEAP_MOVE */
#define XLOG_HEAP_HOT_UPDATE	0x40
#define XLOG_HEAP_CONFIRM		0x50
#define XLOG_HEAP_LOCK			0x60
#define XLOG_HEAP_INPLACE		0x70
#define XLOG_HEAP_OPMASK		0x70
#define XLOG_HEAP_INIT_PAGE		0x80
```

## 2.2 HEAP2

```c
#define XLOG_HEAP2_REWRITE		0x00
#define XLOG_HEAP2_CLEAN		0x10
#define XLOG_HEAP2_FREEZE_PAGE	0x20
#define XLOG_HEAP2_CLEANUP_INFO 0x30
#define XLOG_HEAP2_VISIBLE		0x40
#define XLOG_HEAP2_MULTI_INSERT 0x50
#define XLOG_HEAP2_LOCK_UPDATED 0x60
#define XLOG_HEAP2_NEW_CID		0x70
```

## 2.3 XLOG

```c
#define XLOG_CHECKPOINT_SHUTDOWN		0x00
#define XLOG_CHECKPOINT_ONLINE			0x10
#define XLOG_NOOP						0x20
#define XLOG_NEXTOID					0x30
#define XLOG_SWITCH						0x40
#define XLOG_BACKUP_END					0x50
#define XLOG_PARAMETER_CHANGE			0x60
#define XLOG_RESTORE_POINT				0x70
#define XLOG_FPW_CHANGE					0x80
#define XLOG_END_OF_RECOVERY			0x90
#define XLOG_FPI_FOR_HINT				0xA0
#define XLOG_FPI						0xB0
```

## 2.4 RM_SMGR_ID

\`\`\`c  
#define XLOG_SMGR_CREATE 0x10  
#define XLOG_SMGR_TRUNCATE 0x20  
\`\`

## 2.5
