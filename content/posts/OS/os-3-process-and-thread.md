+++
title = '操作系统 3 多进程与多线程'
date = '2025-12-17T16:08:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['操作系统']
tags = ['操作系统']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 数据传输

## 1.1 传输场景

-   父子进程
-   陌生进程

## 1.2 传输接口

## 1.3 传输示例

# 2 并发控制

## 2.1 并发场景

-   整型
    -   多写
    -   一写多读
    -   多写一读
    -   多写多读
-   数据
    -   多写
    -   多读
    -   一写多读
    -   多写一读
    -   多写多读

## 2.2 并发接口 (glibc)

### 一、自选锁

```c
#include <pthread.h>

pthread_spinlock_t spin;

pthread_spin_init(&spin, PTHREAD_PROCESS_PRIVATE);
pthread_spin_lock(&spin);
pthread_spin_unlock(&spin);
```

### 二、互斥锁

```c
#include <pthread.h>

pthread_mutex_t lock;

pthread_mutexattr_t attr;
thread_mutexattr_init(&attr);
pthread_mutexattr_settype(&attr, PTHREAD_MUTEX_NORMAL);

pthread_mutex_init(&lock, &attr);
pthread_mutex_lock(&lock);
pthread_mutex_unlock(&lock);
```

### 三、读写锁

```c
#include <pthread.h>

pthread_mutex_t rdlock;

pthread_mutexattr_t attr;
pthread_rwlockattr_init(&attr);
pthread_rwlockattr_setpshared(&attr, PTHREAD_PROCESS_SHARED);

pthread_rwlock_init(&rdlock, &attr);
pthread_rwlock_rdlock(&rdlock);
pthread_rwlock_wrlock(&rdlock);
pthread_rwlock_unlock(&rdlock);
```

### 四、信号量

```c
#include <semaphore.h>

sem_t sem;
sem_init(&sem, 0, 8);
sem_wait(&sem);
sem_post(&sem);
```

### 五、原子写

```c
#include <pthread.h>/* C 11 */

volatile unsigned num = 0;

__atomic_store_n(&num, 8, __ATOMIC_SEQ_CST);
unsigned cur = __atomic_load_n(&num, __ATOMIC_SEQ_CST);
```

## 2.3 并发代码

-   整型数据

    -   场景
        -   多写
        -   一写多读
        -   多写一读
        -   多写多读
    -   实现

        ```c
        /* 自旋锁 */
        void mul_write(int *num) {
            spin_lock()
            *num += 1;
            spin_unlock()
        }

        /* 原子变量 */
        ```

-   数据

    -   多写

        ```c
        /* 自旋锁 */
        void mul_write(CommBuf *buf, Data *data) {
            spin_lock()
            memcpy(buf->buf, data, data->len)
            spin_unlock()
        }

        /* 排他锁 */
        void mul_write(ommBuf *buf, Data *data) {
            spin_lock()
            memcpy(buf, data, ..)
            spin_unlock()
        }

        /* 信号量 */

        /* 预申请：原子变量 */
        ```

    -   多读
    -   一写多读

        ```c
        /* 自旋锁 */
        /* 排他锁 */

        /* 信号量 */
        void mul_write(CommBuf *buf, Data *data) {
            spin_lock(buf->spin)
            memcpy(buf->buf, data, ..)
            spin_unlock(buf->spin)

            sem_post(buf->sem)
        }

        void read(CommBuf *buf, Data *data) {
            sem_wait(buf->sem) // 计数器为0，阻塞

            spin_lock(buf->spin)
            memcpy(data, buf->buf, ..)
            spin_unlock(buf->spin)
        }
        ```

    -   多写一读

        ```c
        /* 自旋锁 */
        /* 排他锁 */

        /* 信号量 */

        /* 预申请：原子变量 + 信号量 */
        ```

    -   多写多读

        ```c
        /* 排他锁 */

        /* 信号量 */

        /* 预申请：原子变量 + 信号量 */
        ```
