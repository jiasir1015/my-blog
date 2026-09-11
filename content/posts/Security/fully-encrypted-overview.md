+++
title = '数据库安全 全密态'
date = '2025-05-20T18:22:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['加密']
weight = 900
ShowToc = true
TocOpen = true
+++
```python
PQconnectStart
    makeEmptyPGconn
    connectOptions1
        parse_connection_string
        fillPGconn
            conninfo_getval("enable_ce") # 解析 'enable_ce'
    connectDBStart
        PQconnectPoll
            if CONNECTION_NEEDED: # 建立TCP连接
                connect
            elif CONNECTION_MADE: # 发送连接参数
                pqBuildStartupPacket3
                    build_startup_packet
                pqPacketSend
            elif CONNECTION_AWAITING_RESPONSE # 进行身份认证
                pg_fe_sendauth
PQexec
    PQexecStart
    PQsendQuery
        Processor::run_pre_query # 加密SQL语句中的数据
            Parser::Parse
            run_pre_statement
                run_pre_insert_statement
                    CachedColumnManager::get_cached_columns
                    RawValues::get_raw_values_from_insert_statement
                    ValuesProcessor::process_values
                        process_inside_value # 加密
            StatementData::replace_raw_values
        pqPutMsgStart
        pqPuts
        pqPutMsgEnd
        pqFlush
    PQexecFinish
        PQgetResult
            parseInput
                pqParseInput3
                    pqGetc
                    pqGetInt
                    case 'D'
                        getAnotherTuple
                            pqRowProcessor
                                ValuesProcessor::deprocess_value # 解密服务端返回的数据
                    pqGets
                    case 'Z'
                        Processor::run_post_query
            pqReadData
```
