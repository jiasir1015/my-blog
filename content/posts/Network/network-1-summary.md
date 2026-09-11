+++
title = '计算机网络 1 总结'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['计算机网络']
tags = ['计算机网络']
weight = 900
ShowToc = true
TocOpen = true
+++
# 目录

0.  整体架构
1.  物理层
2.  链路层
3.  传输层
4.  应用层
5.  socket编程

1.  [目录](#%E7%9B%AE%E5%BD%95)
2.  [0 概述](#0-%E6%A6%82%E8%BF%B0)
    1.  [0.1 七层体系结构](#0-1-%E4%B8%83%E5%B1%82%E4%BD%93%E7%B3%BB%E7%BB%93%E6%9E%84)
    2.  [0.2 报文基本原理](#0-2-%E6%8A%A5%E6%96%87%E5%9F%BA%E6%9C%AC%E5%8E%9F%E7%90%86)
3.  [1 应用层](#1-%E5%BA%94%E7%94%A8%E5%B1%82)
    1.  [1.1 HTTP协议](#1-1-HTTP%E5%8D%8F%E8%AE%AE)
        1.  [1.1.1 HTTP 结构](#1-1-1-HTTP-%E7%BB%93%E6%9E%84)
        2.  [1.1.2 HTTP 应用](#1-1-2-HTTP-%E5%BA%94%E7%94%A8)
    2.  [1.2 DNS 协议](#1-2-DNS-%E5%8D%8F%E8%AE%AE)
4.  [2 传输层](#2-%E4%BC%A0%E8%BE%93%E5%B1%82)
    1.  [2.1 TCP](#2-1-TCP)
        1.  [2.1.1 TCP 的结构](#2-1-1-TCP-%E7%9A%84%E7%BB%93%E6%9E%84)
        2.  [2.1.2 TCP 的应用](#2-1-2-TCP-%E7%9A%84%E5%BA%94%E7%94%A8)
5.  [3 网络层](#3-%E7%BD%91%E7%BB%9C%E5%B1%82)
    1.  [3.1 IP](#3-1-IP)
        1.  [3.1 IP 协议](#3-1-IP-%E5%8D%8F%E8%AE%AE)
        2.  [3.1.2 IP 路由](#3-1-2-IP-%E8%B7%AF%E7%94%B1)
    2.  [3.2 ICMP](#3-2-ICMP)
6.  [4 链路层](#4-%E9%93%BE%E8%B7%AF%E5%B1%82)
    1.  [4.1 链路层背景](#4-1-%E9%93%BE%E8%B7%AF%E5%B1%82%E8%83%8C%E6%99%AF)
    2.  [4.2 链路层结构](#4-2-%E9%93%BE%E8%B7%AF%E5%B1%82%E7%BB%93%E6%9E%84)
    3.  [4.3 链路层功能](#4-3-%E9%93%BE%E8%B7%AF%E5%B1%82%E5%8A%9F%E8%83%BD)
    4.  [4.4 链路层设备](#4-4-%E9%93%BE%E8%B7%AF%E5%B1%82%E8%AE%BE%E5%A4%87)
7.  [5 物理层](#5-%E7%89%A9%E7%90%86%E5%B1%82)
8.  [6 socket编程](#6-socket%E7%BC%96%E7%A8%8B)
    1.  [6.1 基本接口](#6-1-%E5%9F%BA%E6%9C%AC%E6%8E%A5%E5%8F%A3)
    2.  [5.2 阻塞模型](#5-2-%E9%98%BB%E5%A1%9E%E6%A8%A1%E5%9E%8B)
    3.  [场景](#%E5%9C%BA%E6%99%AF)
        1.  [一 阻塞IO](#%E4%B8%80-%E9%98%BB%E5%A1%9EIO)
        2.  [二 非阻塞IO](#%E4%BA%8C-%E9%9D%9E%E9%98%BB%E5%A1%9EIO)
        3.  [三 IO多路复用 - select() 主动检查](#%E4%B8%89-IO%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8-select-%E4%B8%BB%E5%8A%A8%E6%A3%80%E6%9F%A5)
        4.  [四 信号驱动IO](#%E5%9B%9B-%E4%BF%A1%E5%8F%B7%E9%A9%B1%E5%8A%A8IO)
        5.  [五 异步IO](#%E4%BA%94-%E5%BC%82%E6%AD%A5IO)
    4.  [5.3 IO多路复用](#5-3-IO%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8)
        1.  [5.3.1 select()](#5-3-1-select)
        2.  [5.3.2 poll()](#5-3-2-poll)
        3.  [5.3.3 epoll()](#5-3-3-epoll)

# 0 概述

## 0.1 七层体系结构

计算机网络使用自顶向下的多层网络结构：

```bash
ISO-OSI体系结构    五层体系结构         TCP/IP协议簇

7 应用层
6 表示层
5 会话层            5 应用层            4 应用层
4 传输层            4 传输层            3 传输层
3 网络层            3 网络层            2 网络层
2 链路层            2 链路层            1 网络接口层
1 物理层            1 物理层
```

各层的作用如下：

| 分层 | 作用 | 传输单位 | 功能 | 协议 | 设备 |
| --- | --- | --- | --- | --- | --- |
| 应用层 | 不同应用根据业务设计 | 数据单元 APDU | - | TCP：HTTP、Telnet、FTP、SMTP、POP、SSH；UDP：DNS、SNMP、TFTP | - |
| 表示层 | 编码解码，加密和压缩 | PPDU | 抽象标准描述方法、标准的编码方式 | JPEG、MPEG、ASII | - |
| 会话层 | 进程会话 | SPDU | 建立、管理、终止会话 | NFS、SQL、NETBIOS、RPC | - |
| 传输层 | 不同主机进程通信 | TCP报文段、UDP数据段 | 端到端连接，可靠报文传输：流量控制、差错控制、传输管理 | TCP：面向连接、可靠传输；UDP：无连接、不可靠报文传输 | 网关 |
| 网络层 | 网际互连 | 数据段 PACKET | 网络互联、路由选择、数据分组/分包、流量控制、拥塞控制、差错控制 | ARP、RARP、IGMP、IP、ICMP | 路由器 |
| 链路层 | 数据段封装为帧，检测与校验物理传输差错 | 帧 Frame | 组帧、差错控制、流量控制 、传输管理 | PPP、FR、HDLC、VLAN、MAC | 网桥、交换机 |
| 物理层 | 透明比特传输 | 比特 Bit | 物理端设备 | IEEE802.3、EIA-232C、X.21 | 转发器 |

在网络层，网络有以下几种：

-   按范围划分：
    -   局域网 LAN Local
    -   域域网 MAN：如有线电视网
    -   广域网 WAN Wide：如通信子网
    -   因特网

## 0.2 报文基本原理

-   IP与TCP![ip-tcp](/images/Network/network-1-summary/ip-tcp.png)
-   其他协议![arp-icmp](/images/Network/network-1-summary/arp-icmp.png)

# 1 应用层

## 1.1 HTTP协议

### 1.1.1 HTTP 结构

```bash
# 请求
+---------+------------+--------------+
| Method  | URI        | HTTP Version |     请求行
+---------+------------+--------------+
| Header : Value                      |
| Header : Value                      |     请求头
| ...                                 |
| (no line)                           |
+-------------------------------------+
| Body                                |     请求体
+-------------------------------------+

# 响应
+--------------+--------+-------------+
| HTTP Version | Status | Status Desc |     状态行
+--------------+--------+-------------+
| Header : Value                      |
| Header : Value                      |     响应头
| ...                                 |
| (no line)                           |
+-------------------------------------+
| Body                                |     响应体
+-------------------------------------+
```

1.  **请求方法**

    | 请求方法 Method | 功能 |
    | --- | --- |
    | GET | 请求指定页面，返回指定页面 |
    | PUT | 向服务端发送指定数据 |
    | POST | 提交请求，可能修改资源 |
    | HEADER | 类似GET，只获取HTTP 相应头 |
    | DELETE | 请求删除指定页面 |
    | OPTIONS | 查看服务器性能 |
    | TRACE | 回显服务器收到的请求，用于测试和诊断 |

2.  **HTTP 请求头**

    | 请求头 Header | 功能 | 示例 |
    | --- | --- | --- |
    | Accept | 客户端可接受的类型 | \- |
    | Host | 指定服务端的域名和端口 | Host: [www.baidu.com](http://www.baidu.com/) |
    | Cookie | 发送请求者身份、会话等信息 |  |
    | Range | 多线程下载使用，指定请求的内容的某部分 |  |
    | Referer | 当前访问的URL的上一个URL |  |

3.  **HTTP 响应状态码**

    | 分类 | 描述 | 具体值 |
    | --- | --- | --- |
    | 1xx | 请求已接收，正在处理 | \- |
    | 2xx | 请求成功，返回正常 | 200 OK |
    | 3xx | 请求成功，重定向 | 301 永久转移，302 暂时转移，304 已缓存 |
    | 4xx | 请求成功 | 400 请求语法有问题，403 拒绝请求，404 请求的内容不存在 |
    | 5xx | 服务器错误 | 500 服务器内部错误，503 服务不可用，稍等 |

### 1.1.2 HTTP 应用

-   **一、GET和POST区别**

| 区别 | GET | POST |
| --- | --- | --- |
| 请求参数 | 参数少，放在URL中，格式为：URL?参数&参数 | 参数多，放在Body中 |
| 安全性 | 安全性低 | 安全性高 |

-   **二、Cookie**

    -   问题：HTTP无状态，客户端需保存身份认证参数、业务状态等信息
    -   使用场景：服务端向客户端发送 HTTP 响应头，可设置客户端的 Cookie。示例：’Set-Cookie: [; expires=date][; domain=domain][; path=path][; secure]’
    -   格式：cookie文本（非持久化cookie和持久化cookie），大小为4KB左右，存在于每个HTTP请求中

    | 设置的Cookie选项 | 功能 |
    | --- | --- |
    | Expires | 设置Cookie生存周期 |
    | Domain | cookie的作用域（域名） |
    | Path | cookie的访问目录 |
    | Security | HTTPS |
    | TTPOnly | 不允许其他客户端读 |

-   **三、浏览器工作原理**

    1.  浏览器：DNS查找：从浏览器缓存、路由器缓存、DNS缓存中查找
    2.  浏览器：HTTP请求：向服务器发送请求
    3.  服务器：处理请求、返回HTML
    4.  浏览器：显示HTML

    ```bash
    1，应用（人接交互模块、解析器、HTTP(S)协议模块、存储模块 + DNS模块）：提取URL、HTTP协议【请求报文】、DNS、标准库中的套接字Socket（）
    2，系统调用（Socket系统调用）：Socket系统调用
    3，操作系统（忽略进程调度、内存管理等 - Linux网络协议栈 ：一，通用网络接口层（sk_buff）：不区分协议，统一封装；二，网络协议实现层：TCP【TCP三次握手】、IP、ARP等的具体实现， - （netfilter）三，虚拟设备接口层（file_struct）：通过net_device抽象网络硬件设备
    4，计算机硬件（CPU执行、内存、设备（网络通信设备））：DMA到网络设备

    中间链路（网络边缘、网络核心）：我的设备子网（交换机、路由器）、服务器（集分布式架构的集群）

    服务器（（DNS服务器、KPI）内容分发器、连接处理器、数据库或文件服务器） ：身份认证和解密等、解析、获取文件、HTTP协议返回
    ```

## 1.2 DNS 协议

-   **一、DNS 应用场景**

    ```bash
    +---------+----------+---------+---------+
    | 四级域名 | 三级域名 | 二级域名 | 顶级域名 |
    +---------+----------+---------+---------+
       www                           com/net/org/edu/gov/cn/net/..
    ```

1.  域名管理

    ```bash
    1. 顶级域TLD有两种，通用域、国家或地区域。常用的通用域：.com(商业)、.edu(教育性机构)、.gov(政府)、.net(网络服务供应商)、.org(非营利性机构)、.int(国际性组织)、.mil(军事组织)。
    2. 每个域自己控制如何分配它下面的域
    3. 为了创建一个新的域，创建者必须得到该新域的上级域管理员的许可
    ```

2.  域名服务器

    ```bash
    1. 每层都有自己的域名服务器，最顶层为根域名服务器
    2. 每层域名服务器都知道下一层域名服务器的IP
    3. 为了容灾，每层至少两个及以上域名服务器
    ```

3.  域名解析：通常情况下，主机向本地域名服务器的查询一般都是采用递归查询，本地域名服务器向根域名服务器的查询通常采用迭代查询。

    ```bash
    1. 主机运行DNS客户进程
    2. DNS进程向DNS服务器发送DNS查询报文
    3. DNS服务器迭代查询或递归查询，域名服务器自身会进行一些缓存
    4. 如果差不多，则向上一级查询，最多回溯到根域名服务器
    ```

4.  域名解析示例

    ```bash
    1. 主机10.74.36.90先向本地域名服务器10.74.1.11进行递归查询
    2. 本地域名服务器采用迭代查询，向一个根域名服务器进行查询
    3. 根域名服务器告诉本地域名服务器，下一次应该查询的顶级域名服务器 dns.me的IP地址
    4. 本地域名服务器向顶级域名服务器 dns.me进行查询
    5. 顶级域名服务器me告诉本地域名服务器，下一步查询权限服务器dns.jocent.me 的IP地址
    6. 本地域名服务器向权限服务器 dns.jocent.me进行查询
    7. 权限服务器 dns.jocent.me告诉本地域名服务器所查询的主机的IP地址
    8. 本地域名服务器最后把查询结果告诉 10.74.36.90
    ```

-   **二、DNS 协议**

    ```bash
    +-------------------+-------------------+
    | Transcation ID    |  Flags            |  请求和响应的Trans ID相同
    | Question Count    | Answers Count     |
    | Authority         | Additional        |
    +-------------------+-------------------+
    | Queries                               |
    +---------------------------------------+
    | Answers                               |
    | Authoritative nameservers             |
    | Additional records                    |
    +---------------------------------------+
    ```

-   **三、DNS 协议内容**

1.  Transcation ID：会话标识，请求和响应Transcation ID相同

2.  Flags

    | 名称 | 比特 | 含义 |
    | --- | --- | --- |
    | AR | 1 | 查询还是响应，0:查询，1:响应 |
    | OP | 4 | 0:标准查询 1:反向查询 2:服务器状态请求 |
    | AA | 1 | 授权回答 |
    | TC | 1 | 可截断 |
    | RD | 1 | 期望递归 |
    | RA | 1 | 可用递归 |
    | RET | 4 | 返回码 |

3.  Queery:

    -   格式

        ```bash
        +-----------------------+
        |          Name         |  域名
        +-----------+-----------+
        |  Type     |   Class   |
        +-----------------------+
        ```

    -   Type

    | 类型 | 助记 | 说明 |
    | --- | --- | --- |
    | 1 | A | 由域名获取IPV4地址 |
    | 2 | NS | 查询域名服务器 |
    | 5 | CNAME | 查询规范名称 |
    | 6 | SOA | 开始授权 |
    | 12 | PTR | 把IP转换为域名 |
    | 13 | HINFO | 主机信息 |
    | 28 | AAAA | 由域名获取IPV6地址 |
    | 252 | AXFR | 传送整个区的请求 |
    | 255 | ANY | 对所有记录的请求 |

# 2 传输层

## 2.1 TCP

### 2.1.1 TCP 的结构

```bash
+----------------------+-----------------------+
| Src Port             | Dest Port             |
+----------------------------------------------+
|                   Sequence Number            |
+----------------------------------------------+
|                   Ack Number                 |
+----------------------+-----------------------+
| HeaderLen |  | Flags |     Window Size       |
+----------------------+-----------------------+
| Checksum             |    Pointer            |
+----------------------------------------------+
| Options and Pending                          |
+----------------------------------------------+
```

-   **1\. TCP 标记位**

| 标记名 | 含义 |
| --- | --- |
| URG |  |
| ACK |  |
| PSH |  |
| RST |  |
| SYN |  |
| FIN |  |

-   **2\. TCP 连接**

-   TCP 三次握手

    ```bash
    客户端                                    服务端
    --+-----------------------------------------+--------------
                                                | set [LISTEN]
      | 1. SYN=1, seq=x ----------------------->|
      |  set [SYN-SENT]

      | <------ 2. ACK=1, ack=x+1, SYN=1, seq=y |
                                                | set [SYN-RECV]

      | 3. ACK=1, ack=y+1, seq=x+1 -----------> |
      | set [ESTABLISHED]
                                                | set [ESTABLISHED]
    ```

-   TCP 传输

    ```bash
    客户端                                                 服务端
    --+-----------------------------------------------------+--------------
      | [seq=100, ask=500]                                  | [seq=500, ask=100] # 记录已发送的序号，记录需要接收的序号
      | 1. seq=100, datalen=15, ask=500, windows=20 -->     |
      | [seq=115]
      |                                                     | [ask=115]
      |      <-- 2. seq=500, datalen=13,ask=115, windows=10 |
      | [ask=513, seq=115]
    ```

-   TCP 四次挥手

    ```bash
    客户端                                    服务端
    --+-----------------------------------------+--------------
                                                | set [ESTABLISHED]
      | 1. FYN=1, seq=x ----------------------> |
      | set [FIN-WAIT-1]

      | <------------- 2. ACK=1, ack=x+1, seq=y |
      | set [FIN-WAIT-2]                        | set [CLOSE-WAIT]
      | <-------------------------- remain data |

      | <------ 3. ACK=1, ask=x+1, FIN=1, seq=y |
                                                | set [LAST-ACK]

      | 4. ACK=1, ack=y+1, seq=x+1 -----------> |
      | set [TIME-WAIT]                         | set [CLOSED]
      | 2 MSL
      | set [CLOSED]
    ```

### 2.1.2 TCP 的应用

-   **1\. TCP 计时器**

1.  重传计时器：发送报文 -MSL- 接收到ACK
2.  时间等待计时器：发送FIN - 2MSL- 无
3.  持续计时器：接收0窗口 - 60s- 发送探测报文
4.  保活计时器：保活 -2小时- 发送探测报文 -75-秒

-   **2\. TCP 可靠性**

-   1.  超时重传机制（数据不丢）

    -   问题：网络不可靠，数据可能丢
    -   解决：
        1.  客户端（主动识别）：每发送1条数据，就设置1个`重传计时器`，如果指定时间没收到该条数据的回复，则重传。重传计时器的阈值可自适应
        2.  服务端：每接受到1条数据，回复1条确认信息
    -   流程图：

        ```bash
        客户端                                                 服务端
        --+-----------------------------------------------------+--------------
        | [seq=100, ask=500]                                  | [seq=500, ask=100]
        | 1. seq=100, datalen=15, ask=500, windows=20 -->     |
        | 2. seq=115, datalen=15, ask=500, windows=20 -->     |
        | 3. seq=130, datalen=15, ask=500, windows=20 -->     |
        | [seq=145]
        |                                                     | 假如，只收到前两条，则回复 ask=130
        |                                                     | 假如，收到1，回复ask=115; 假如丢失2，收到3，仍然回复ask=115
        |      <-- 2. seq=500, datalen=13,ask=130, windows=10 |
        |
        ```

-   2.  校验和 （数据不错）
-   **2\. TCP 流量控制**

-   1.  拥塞控制（风险规避）

    -   问题：网络负载低时，发送数据多；网络负载高时，发送数据少
    -   解决机制：客户端维护拥塞窗口，网络无拥塞，拥塞窗口变大，网络有拥塞，拥塞窗口变小。根据拥塞窗口，调整发送数据。
    -   解决算法：
        1.  慢开始：拥塞窗口从1开始，每次发送后，快速增大
        2.  拥塞控制：拥塞窗口到达阈值，每次发送后，慢速增大。如果发生超时，拥塞窗口设置为1，重新慢开始
        3.  快重传：如果收到3条重传某1报文的请求，说明是个别丢包。客户端不等重传计时器，尽快重传；服务端不等捎带确认，尽快回复
        4.  快恢复：如果收到3条重传某1报文的请求，说明是个别丢包。拥塞窗口不设置为1，而只缩小一半

2.  滑动窗口

-   **3\. TCP 差错控制**

# 3 网络层

## 3.1 IP

### 3.1 IP 协议

-   IP 报文结构

```bash
+-----------------------------------------------------------------------------+
| Version | HdrLen | Service           |         TotalLen                     |  长度信息
+-----------------------------------------------------------------------------+
|       Fragment Identify              | Fragment Flag |    Fragment Offset   |  分片信息
+-----------------------------------------------------------------------------+
| TTL              | Protol            |            Checksum                  |  合法校验
+-----------------------------------------------------------------------------+
|                                    Src Ip                                   |
|                                    Dst Ip                                   |
+-----------------------------------------------------------------------------+
|                                    Options                                  |
+-----------------------------------------------------------------------------+
```

-   IP 报文成员
    -   版本号：4或6
    -   服务 Service：未使用
    -   分片标识 Fragment Identify：用于IP分片场景，相同标识的IP分片，可以组装在一起
    -   分片标志 Fragment Flag：
        -   MF=1,后面还有分片；MF=0，后面无分片
        -   DF=1，不能分片；DF=0，可以分片
    -   分片偏移 Fragment Offset：每个分片的位置
    -   存活周期 TTL：每经过1个路由器，TTL减1
    -   协议 Protol：

        | 取值 | 协议 |
        | --- | --- |
        | 1 | ICMP |
        | 2 | IGMP |
        | 4 | IP |
        | 6 | TCP |
        | 8 | EGP |
        | 9 | IGP |
        | 17 | UDP |
        | 41 | IPV6 |
        | 89 | 89 |

    -   可选参数 Options：差错、测量、安全

### 3.1.2 IP 路由

-   问题场景：不同网络间，主机通信

-   路由模型：

    ```bash
                        [路由器]
                          |
                          |
                          |
    [机器]--------------[路由器]---------------[路由器]------------------[机器]

                    路由表：
                    +---------------+----------+-----+
                    | 目标网络-掩码   | 下一跳    | 接口 |
                    +---------------+----------+-----+
                    | 11.0.0.0 - 8  | 2.2.2.2  |  0  |
                    | 1.1.1.0  - 30 | 1.1.1.1  |  1  |
                    | ...           | ...      | ..  |
                    +--------------------------------+
    ```

-   路由表：每个路由器，维护1份路由表

    -   直连路由：直接连接的设备
    -   静态路由：网络管理员手工配置
    -   动态路由：路由协议自动获取

-   路由：[https://blog.csdn.net/xiaobai729/article/details/122920727](https://blog.csdn.net/xiaobai729/article/details/122920727)

## 3.2 ICMP

-   ICMP 功能：差错报告机制
-   ICMP 报文

    ```bash
    +-----------+--------------+------------+
    | IP Header | ICMP Header  | ICMP Data  |
    +-----------+--------------+------------+
                |
                |
                | ICMP Header
                +------+-------+----------+-----------+
                | Type | Code  | Checksum | Options   |
                +------+-------+----------+-----------+
    ```

-   ICMP 类型
    -   0 Echo响应 查询类
    -   3 目的不可达 差错类
        -   [3, 0] 目标网络不可达
        -   [3, 1] 目标主机不可达
        -   [3, 3] 目标端口不可达
        -   [3, 4] 要求分段并设置DF
    -   5 重定向 差错类
    -   8 Echo请求 查询类
    -   9 路由器通告 查询类
    -   10 路由器请求 查询类
    -   11 ICMP超时 差错类
        -   [11, 0] TTL超时
        -   [11, 1] 分片重组超时
    -   12 ICMP参数异常 差错类
    -   13 时间戳请求 查询类
    -   14 时间戳应答 查询类
    -   15 信息请求 查询类
    -   16 信息应答 查询类

# 4 链路层

## 4.1 链路层背景

物理层传输有以下问题：

-   物理传输有差错，需采取纠错机制
-   网络容量不同，需采取流量控制
-   物理层传输介质不同，屏蔽物理层差异
-   物理层bit传输，传输效率低

## 4.2 链路层结构

-   LLC子层：逻辑链路控制
    -   功能
        -   逻辑链路建立与释放
        -   控制信号交换
        -   流量控制
        -   解释上层协议命令
        -   处理传输错误
    -   阶段
        -   链路建立
        -   链路保持
        -   链路释放
-   MAC子层：介质访问控制
    -   数据帧封装与拆卸
    -   帧的寻址和识别
    -   帧的发送和接受
    -   帧的差错控制
    -   介质访问冲突

## 4.3 链路层功能

链路层有以下4个关键功能：

1.  数据帧封装
    -   帧大小：由最大传输单元 MTU 控制（IP包MTU为1500字节）
    -   帧组装
        -   字节计数法：1特殊字符代表帧开始，1字段表示帧内字节数
        -   比特填充首尾定界法：帧头帧尾插入特定比特串
        -   字符填充法首尾定界法：如SYN字符开头、EXT字符结尾
        -   违法编码法
2.  差错控制
    -   方法分类
        -   奇偶校验码 PPC：判断1的个数是偶数还是奇数（奇偶校验位）
            -   缺点：检查单个码元错误，用于误码率低环境
        -   循环冗余校验码 CRC（整除取余思想）

            ```bash
            1. 选择多项式 x^4 + x^3 ++ 1  -> 11001
            2. 帧尾预留4个bit (少一位)
            3. 帧内数据除 11001
            ```

3.  差错纠正
    -   方法分类
        -   反馈检测法
        -   自动重发请求法
            -   空闲重发
            -   连续重发
        -   纠错码：编码自带纠错能力
            -   海明码：多个校验位
                -   实现：计算校验位数 -> 明确校验码位置 -> 确定校验码 -> 实现校验纠错
4.  流量控制
    -   场景：两端发送速度与接受速度不一致
    -   方法分类
        -   基于反馈的流量控制方案
            -   停-等方案：XON/XOFF协议：发送端发送数据帧->发送端等待->接收端接受数据帧->接收端向发送端发送确认帧->发送端继续发送数据
        -   基于速率的流量控制
            -   滑动窗口机制

## 4.4 链路层设备

按发展规律与功能划分，链路层的常见设备有：

1.  集线器
    -   特点
        -   多次复制的广播传输
    -   缺点
        -   共享传输介质
        -   端口带宽过窄
        -   容易产生广播风暴
2.  网桥
3.  二层交换机
    -   具有多个交换端口：数据只对目标节点发送
    -   数据转发效率更高
    -   更强的MAC地址自动学习能力

# 5 物理层

-   多路复用
    -   频分多路复用
    -   时分多路复用

# 6 socket编程

## 6.1 基本接口

[https://blog.csdn.net/hguisu/article/details/7445768/](https://blog.csdn.net/hguisu/article/details/7445768/)

```c
// server
int socket(int protofamily, int type, int protocol);
int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
int listen(int sockfd, int backlog);
int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
int close(int fd);

// 阻塞
ssize_t read(int fd, void *buf, size_t count);
ssize_t write(int fd, const void *buf, size_t count);

ssize_t send(int sockfd, const void *buf, size_t len, int flags);
ssize_t recv(int sockfd, void *buf, size_t len, int flags);

ssize_t sendto(int sockfd, const void *buf, size_t len, int flags, const struct sockaddr *dest_addr, socklen_t addrlen);
ssize_t recvfrom(int sockfd, void *buf, size_t len, int flags, struct sockaddr *src_addr, socklen_t *addrlen);

ssize_t sendmsg(int sockfd, const struct msghdr *msg, int flags);
ssize_t recvmsg(int sockfd, struct msghdr *msg, int flags);

// client
int socket(int protofamily, int type, int protocol);
int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen);

// 结构体
struct sockaddr_in {
    sa_family_t sin_family; // AF_INET
    in_port_t sin_port;
    struct in_addr sin_addr;
};
struct in_addr {
    uint32_t s_addr;
};
```

## 5.2 阻塞模型

## 场景

[https://www.jianshu.com/p/ed1f9e9a1982](https://www.jianshu.com/p/ed1f9e9a1982)

### 一 阻塞IO

-   原理：服务器发出请求，并阻塞自己，等待系统调用返回

    ```python
    server                os-kernel
    +-----------------------+---------------------------
    | 0. read(fd, buf) -->  |
                            | 1. 向设备发送请求(fd)
                            | 2. 等待设备的信号(fd)    # 阻塞
                            | 3. 复制设备的数据(fd, buf)
    |           4. buf  <-- |
    ```

### 二 非阻塞IO

-   原理：服务器发出请求，不阻塞自己，定期检查系统调用结果

    ```python
    server                os-kernel
    +-----------------------+---------------------------
    | 0. read(fd, buf) -->  |
                            | 1. 向设备发送请求(fd)
    | # 不阻塞
                            | 2. 等待设备的信号(fd)    # 阻塞
    | 0. read(fd, buf) -->  |
                            | 3. 复制设备的数据(fd, buf)
    |           4. buf  <-- |
    ```

### 三 IO多路复用 - select() 主动检查

-   原理：一个进程，监听多个描述符，描述符就绪时通知进程
-   实现：`select(), poll(), epoll()`

    ```c
    server                    os-kernel
    +---------------------------+---------------------------
    | 1. fd1 = accept()     --> |
    | 2. fd2 = accept()     --> |
                                | 3. [..., fd1, ..., fd2, ...]
    | 4. select([fd1, fd2]) --> |
                                | 5. if one fd receive data: return
    | <--   6. [..., 1, ..., 0] |
    | 7. read(fd1)          --> |
    | <--               8. data |
    ```

### 四 信号驱动IO

### 五 异步IO

```c
app                     kernel
+-----------------------+---------------------------
| 1. fd = accept()  --> |
                        | 2. [fd, ]
| 3. aio_read(fd)   --> |
                        | 4. if not fd.data: return
| <--        5. no data |
                        | 6. signal(app)
| 7. signal_handle()    |
```

## 5.3 IO多路复用

函数：

-   select()：一次调用，检查所有文件句柄，返回活跃的文件句柄
-   poll()：一次调用，检查所有文件句柄，返回活跃的文件句柄
-   epoll：文件句柄绑定回调函数，活跃的文件句柄自动调用回调函数

### 5.3.1 select()

```c
// 内核
FDS[] = [fd_1, fd_2, fd_3, fd_4, fd_5, ...]
FDSET = [false, false, false, false, false, ...]

// 内核接口：遍历FDS，返回哪些FDS接收到了数据
int select(int nfds, fd_set *readfds, fd_set *writefds, fd_set *exceptfds, struct timeval *timeout);

// 内核实现, fd_num最大为100
int select(maxfd, readfd, NULL, NULL, NULL)
{
    int num = 0;

    for (int i = 0; i < maxfd; i++) { /* 阻塞与非阻塞 */
        if (readfds[i] == 1) {
            readfds[i] = len(FDS[i].data) > 0 ? 1 : 0;
            num += len(FDS[i].data) > 0 ? 1 : 0;
        }
    }

    return num;
}

// 用户调用
void fetch_data()
{
    fd_set rfds;

    int fd1 = accept();
    int fd2 = accept();
    int fd3 = accept();

    for (;;) {
        FD_ZERO(&rfds);
        FD_SET(fd1, &rfds);
        FD_SET(fd2, &rfds);
        FD_SET(fd3, &rfds);

        select(fd3 + 1, &rfds, NULL, NULL, NULL); /* block here */

        if (FD_ISSET(fd1, &rfds)) {
            read(fd1, ...);
        }
        if (FD_ISSET(fd2, &rfds)) {
            read(fd2, ...);
        }
    }
}
```

### 5.3.2 poll()

### 5.3.3 epoll()

```
// 用户调用
```

**epoll工作模式**  
场景：  
t1:  
buff = [xxxxxxx\_\_\_\_\_\_\_]  
t2:  
read(buff)  
t3:  
buff = [xxxx\_\_\_\_\_\_\_\_\_\_]

分类：

-   level-trigger: t3 可读
-   edge-trigger: t3 不可读  
    while(buff.len > 0) {  
    read(buff)  
    }
