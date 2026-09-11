+++
title = '工具 多线程 thread'
date = '2025-05-22T19:29:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['工具']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 多线程框架

```bash
gcc thd.c -lpthread -o thd
```

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <pthread.h>
#include <unistd.h>
#include <semaphore.h>

bool prtlog = true;

#define ASSERT(cond) \
    if (!(cond)) {printf("ASSERT | file: %s  line: %d  func: %s\n", __FILE__, __LINE__, __FUNCTION__); exit(-1);}

#define LOG(thdctl, fmt, ...)                                              \
    do {                                                                   \
        if (prtlog) {                                                      \
            char data_[2048];                                              \
            snprintf(data_, 2048, (fmt), ##__VA_ARGS__);                   \
            thdctl != NULL ?                                               \
                printf("  >%-3d %s\n",  ((ThdCtl *)(thdctl))->id, data_) : \
                printf("%s\n", data_);                                     \
        }                                                                  \
    } while (0)

/*  ---------------------------------------------------------------------- */
typedef struct ThdCtl ThdCtl;
typedef struct ThdData ThdData;
typedef void (*ThdHookFunc)(ThdCtl *thdctl, ThdData *data);
struct ThdCtl {
    /* thread info */
    int stat;
    pthread_t thd;
    int id;

    /* thread function */
    ThdHookFunc init_func;
    ThdHookFunc exec_func;
    ThdHookFunc exit_func;
    ThdData *data;

    /* thread control */
    bool iswait;
    sem_t wait;
};
typedef struct {
    int thdnum;
    ThdCtl *thdarr[10000];
} ProCtl;
/*  ---------------------------------------------------------------------- */
void multi_execute(ThdHookFunc initfunc, ThdHookFunc execfunc, ThdHookFunc exitfunc, int thdnum, ThdData *dataarr);

typedef struct ThdData {
    int id;

} ThdData;

void init(ThdCtl *thdctl, ThdData *data)
{
    LOG(thdctl, "init");

    data->id = thdctl->id;
}

void execute(ThdCtl *thdctl, ThdData *data)
{
    LOG(thdctl, "execute, id: %d", data->id);
}

void finish(ThdCtl *thdctl, ThdData *data)
{
    LOG(thdctl, "finish, id: %d", data->id);
}

int main()
{
    ThdData datas[10] = {0};

    multi_execute(init, execute, finish, 10, datas);

    return 0;
}

/*  ---------------------------------------------------------------------- */

void *thread_main(void *arg)
{
    ThdCtl *tctl = (ThdCtl *)arg;

    if (tctl->init_func != NULL) {
        tctl->init_func(tctl, tctl->data);
    }

    /* wait to be wake up */
    // LOG(tctl, "sleep");
    sem_wait(&tctl->wait);

    /* wake up now */
    // LOG(tctl, "wakeup");
    tctl->iswait = false;

    /* ====== user funtion begin  ========== */
    if (tctl->exec_func != NULL) {
        tctl->exec_func(tctl, tctl->data);
    }
    /* ====== user funtion finish ========== */

    if (tctl->exit_func != NULL) {
        tctl->exit_func(tctl, tctl->data);
    }

    return NULL;
}

ThdCtl *create_thread(ProCtl *process, ThdHookFunc initfunc, ThdHookFunc execfunc, ThdHookFunc exitfunc, void *thddata)
{
    static int thdid = 0;

    ThdCtl *t = (ThdCtl *)malloc(sizeof(ThdCtl));
    if (t == NULL) {
        ASSERT(false);
        return NULL;
    }
    /* thread info */
    t->stat = -1;
    t->id = thdid++;

    /* thread function */
    t->init_func = initfunc;
    t->exec_func = execfunc;
    t->exit_func = exitfunc;
    t->data = thddata;
    t->stat = pthread_create(&t->thd, NULL, thread_main, t);

    /* thread control */
    t->iswait = true;
    sem_init(&t->wait, 0, 0);

    process->thdarr[process->thdnum] = t;
    process->thdnum++;

    return t;
}

ProCtl *create_process()
{
    ProCtl *pro = (ProCtl *)malloc(sizeof(ProCtl));
    ASSERT(pro != NULL);

    pro->thdnum = 0;
    memset(pro->thdarr, 0, sizeof(pro->thdarr));

    return pro;
}

void multi_execute(ThdHookFunc initfunc, ThdHookFunc execfunc, ThdHookFunc exitfunc, int thdnum, ThdData *dataarr)
{
    ProCtl *pro = create_process();

    LOG(NULL, "init ------------------------");
    int i;
    for (i = 0; i < thdnum; i++) {
        create_thread(pro, initfunc, execfunc, exitfunc, &dataarr[i]);
    }

    LOG(NULL, "execute ------------------------");
    for (i = 0; i < pro->thdnum; i++) {
        ThdCtl *tctl = pro->thdarr[i];
        sem_post(&tctl->wait);
    }

    for (i = 0; i < pro->thdnum; i++) {
        pthread_join(pro->thdarr[i]->thd, NULL);
    }
    LOG(NULL, "finish ------------------------");
}
```

# 2 多线程示例
