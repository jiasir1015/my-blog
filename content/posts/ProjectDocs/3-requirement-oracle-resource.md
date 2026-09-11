+++
title = '海量 3 需求 oracle resource'
date = '2025-03-24T10:42:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['项目文档']
tags = ['Oracle', '需求文档']
weight = 300
ShowToc = true
TocOpen = true
+++
| -| -| -| -| -| -| -|  
| 1 | FAILED_LOGIN_ATTEMPTS | [1, max] unlimited | failed_login_attempts | [1,1000] | 认证类 | 登录数据库时，如果密码错误次数超过<本参数>，则账号会被锁定，短期内无法再登录 |  
| 2 | PASSWORD_LOCK_TIME | [1, max] unlimited | password_lock_time | [1,525600]min | 认证类 | 如果因密码错误次数过多，导致账号被锁，将锁定<本参数>的时间 |  
| 3 | PASSWORD_LIFE_TIME | [1, max] unlimited | password_effect_time | [30,36500]day | 认证类 | 设置或更新用户密码时，超过<本参数>的时间，密码会过期（oracle与vastase表现不同） |  
| 4 | PASSWORD_GRACE_TIME | - | - | - | 认证类 | 如果密码过期，在<本参数>的时间内，密码仍可使用 |  
| 5 | PASSWORD_REUSE_TIME | [1, max] unlimited | password_reuse_time | [30, 90]day | 认证类 | 用户设置密码时，如果密码在过去的<本参数>的时间内别用过，则密码不能复用，opengauss [0,3650] |  
| 6 | PASSWORD_REUSE_MAX | - | password_reuse_max | [1,100] | 认证类 | 用户设置密码时，如果密码已被重复使用过<本参数>的次数，则密码不能复用 |  
| 7 | INACTIVE_ACCONT_TIME | - | - | - | 认证类 | 如果一个账号在<本参数>的时间内，未登录过，则锁定账号 |  
| 8 | PASSWORD_VERIFY_FUNCTION | - | - | - | 认证类 | 用户设置密码时，调用<本参数>指定的函数，检查密码是否符合要求 |  
| 9 | PASSWORD_ROLLOVER_TIME | - | - | - | 认证类 | 新旧密码滚动更新天数 |  
| 10 | SESSIONS_PER_USER | - | - | - | 资源类 | 1个用户可建立的最大连接数 |  
| 11 | CPU_PER_SESSION | - | - | - | 资源类 | 1个连接可使用CPU时间数 |  
| 12 | CPU_PER_CALL | - | - | - | 资源类 | 1个调用（比如1个SQL）可使用CPU时间数 |  
| 13 | CONNECT_TIME | - | - | - | 资源类 | 1个连接可持续的时间 |  
| 14 | IDLE_TIME | [1, max] unlimited | session_timeout | [0,86400] | 资源类 | 1个连接空闲时间限制 |  
| 15 | LOGICAL_READS_PER_CALL | - | - | - | 资源类 | 1次调用（比如1个SQL）允许读写的page数量 |  
| 16 | LOGICAL_READS_PER_SESSION | - | - | - | 资源类 | 1个连接允许读取的page数量 |  
| 17 | PRIVATE_SGA | - | - | - | 资源类 | 1个连接可使用的共享内存空间大小 |  
| 18 | CONPOSITE_LIMIT | - | - | - | 资源类 | 1个连接可可使用的总资源：按cpu时间、连接时间、page读写数等加权求和 |

一、友商分析：  
oracle资源管理功能profile中，有9个用户级参数，需时间8个参数，我按自己理解，简单划分：

1.  CPU：1个连接可使用CPU时间，1个SQL可使用CPU时间
2.  内存：1个连接使用内存大小
3.  网络：1个用户最大连接数，1个连接可持续时间，1个连接空闲时间限制
4.  磁盘：1个连接可读写page数，1个SQL可读写page数
5.  综合：按cpu时间、连接时间、page读写数等加权求和  
    mysql资源管理功能中，我按自己理解，简单划分：

-   resource group：可使用CPU核白名单，线程优先级
-   create user .. resource：1小时可执行SQL数，1小时连接数，用户最大连接数

二、实现方案（仅对标oracle）：

1.  CPU：有方案
    -   方案一（不可用）：基于系统调用。setrlimit函数，可以设置CPU最长运行时间，但是对整个进程生效。Oracle是多进程，Vb是多线程。
    -   方案二：基于定时器+信号，理论上可行。设置定时器，定时触发信号
2.  内存：有方案。这个简单
3.  网络：有方案。定时器+信号，和控制CPU原理一样
4.  磁盘：有方案。在ShareBuffer层限制

三、工作量：

1.  学习（1周）：对内核thread, resource这些模块，不太熟
2.  开发（2周）：线程池、非线程池等都需要适配
3.  自测（1周）：不能单纯使用SQL，测试麻烦一点点

[https://mysql.net.cn/doc/refman/8.0/en/resource-groups.html#google_vignette](https://mysql.net.cn/doc/refman/8.0/en/resource-groups.html#google_vignette)
