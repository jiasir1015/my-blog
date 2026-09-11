+++
title = '传统安全 4 防火墙'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['安全']
weight = 104
ShowToc = true
TocOpen = true
+++
# 1 netfilter

## 1.1 netfilter 架构

## 1.2 netfilter 编程

```cpp
struct nf_hook_state {
        unsigned int hook;
        int thresh;
        u_int8_t pf;
        struct net_device *in;
        struct net_device *out;
        struct sock *sk;
        struct net *net;
        struct list_head *hook_list;
        int (*okfn)(struct net *, struct sock *, struct sk_buff *);
};

/* 回调函数 */
typedef unsigned int nf_hookfn(
    void *priv,
    struct sk_buff *skb,
    const struct nf_hook_state *state);

/* 回调函数返回值 */
#define NF_DROP 0
#define NF_ACCEPT 1
#define NF_STOLEN 2
#define NF_QUEUE 3
#define NF_REPEAT 4
#define NF_STOP 5

/* 向内核注册回调函数 */
struct nf_hook_ops {
    struct list_head    list;   /* 链表成员 */
    nf_hookfn           *hook;  /* 回调函数 */
    struct module      *owner;
    int                 pf;     /* 协议簇 */
    int                 hooknum; /* NF_ARP_IN, NF_ARP_OUT */
    int                 priority; /* 优先级 */
} ;

/* 协议簇 */
#define AF_UNSPEC       0
#define AF_UNIX         1
#define AF_LOCAL        1
#define AF_INET         2   /* IP */
#define AF_INET6        10  /* IPV6 */
#define AF_LLC          26

/* 注册 */
void nf_register_hooks(struct nf_hook_ops *ops_arr, int arr_len);

module_init(arp_hook_init)
```

-   参考：netfilter结构体：[https://www.cnblogs.com/ink-white/p/16818769.html](https://www.cnblogs.com/ink-white/p/16818769.html)
-   参考：netfilter构造报文：[https://www.cnblogs.com/ink-white/p/16816464.html](https://www.cnblogs.com/ink-white/p/16816464.html)
-   参考：netfilter捕获arp：[https://blog.csdn.net/fuyuande/article/details/79772134](https://blog.csdn.net/fuyuande/article/details/79772134)

# 2 iptables

## 2.1 iptables 命令

```bash
# 1 查看所有规则
iptables --list -n
iptables --list -t [filter/mangle/nat/raw]

# 2 规则管理
iptables [操作] [链名] [动作] [过滤条件]
    # 操作
        -A : 新增规则，添加至末尾
        -I : 新增规则，添加到指定位置
        -D : 删除规则
        -R : 替换规则
    # 链名
        PREROUTING
        INPUT
        OUTPT
        FORWARD
    # 动作
        -j ACCEPT
        -j DROP
        -j REJECT
        -j SNAT
    # 过滤条件
        -s 0.0.0.0 : 源IP
        -sport 100 : 源端口
        -d 1.1.1.1 : 目标IP
        -dport 100 : 目标端口
        -p icmp/tcp/udp : 协议类型
            -p icmp --icmp-type 8 : ping
        -i etho    : 数据接收网口
        -o eth1    : 数据发送网口
        -m 其他参数
            -m mac --mac-source 00:00:00:00:01
            -m owner --uid-owner 100
            -m owner --pid-owner 100
            -m state --state [NEW, RELATED, ESTABLISHED, INVALID]

# 3 启动与停止 [ location: /etc/init.d/iptables ]
iptables start
iptables stop
iptables restart

# 4 批量操作
iptables -F     # 清空规则
iptables -X     # 清空用户规则
iptables -Z     # 清空计数

# 5 保存规则  [ storage: /etc/sysconfig/iptables ]
iptables save
```

# 3 kkwall

## 3.1 命令

```bash
# 1 过滤
# 1.1 过滤ip
kkwall filter -sip 10.10.10.10
kkwall accept -dip 10.10.10.10

# 1.2 过滤端口
kkwall filter -sport 100
kkwall accept -dport 100
kkwall filter -dport all

# 1.2 过滤协议
kkwal filter -protol tcp/icmp/udp/igmp

# 3 入侵检测
# 3.1 防 arp 欺骗
    # 网关固定mac
kkwal set mac 0.0.0.0/00:00:00:00:01
    # 短时间内，大量arp报文

# 3.2 端口扫描
    # 设置端口白名单，如果报文目标端口在白名单外的端口，为异常报文
kkwal set ports 22,80
    # 检测所有tcp状态，识别所有syn和fin扫描

# 3.3 拒绝服务
    # 系统漏洞：
    # ping of death: 超长icmp包 63336， 分片发送 -> 丢弃
    # tear drop: 重复的IP分片  -> 丢弃
    # 有限资源
    # smurf: 短时间接收到大量icmp echo包 -> 全丢弃
    # tcp syn flood: 短时间，大量半开请求
    # tcp syn land: tcp src_addr和dst_addr都是自己
    # http flood: http请求
```

```c
typedef struct {
    ;
} ArpHdr;

typedef struct {
    ;
} IpHdr;

typedef struct {
    ;
} TcpHdr;

typedef struct {
    int type;
    IpHdr *iphdr;
    TcpHdr *tcphdr;
} Fragment;

/*  */
void detecte_trick(ArpHdr *arp)
{
    ArpItem staticarp = arp_list_find(arp->mac);
    if (arp->dst_ip != staticarp) {
        printf("arp trick");
    }
}
```

-   参考：iptables常用命令 [https://blog.csdn.net/shiner_chen/article/details/132104300](https://blog.csdn.net/shiner_chen/article/details/132104300)
