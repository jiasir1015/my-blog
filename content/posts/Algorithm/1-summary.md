+++
title = '数据结构与算法 1 总结'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-18T17:57:16+08:00'
draft = false
categories = ['数据结构与算法']
tags = ['数据结构与算法']
weight = 100
ShowToc = true
TocOpen = true
+++
1.  [1 概述](#1-%E6%A6%82%E8%BF%B0)
    1.  [1.1 数据结构](#1-1-%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84)
        1.  [数组](#%E6%95%B0%E7%BB%84)
        2.  [链表](#%E9%93%BE%E8%A1%A8)
        3.  [二叉树](#%E4%BA%8C%E5%8F%89%E6%A0%91)
        4.  [树](#%E6%A0%91)
        5.  [栈](#%E6%A0%88)
        6.  [队列](#%E9%98%9F%E5%88%97)
        7.  [图](#%E5%9B%BE)
    2.  [1.2 算法](#1-2-%E7%AE%97%E6%B3%95)
    3.  [问题](#%E9%97%AE%E9%A2%98)
    4.  [1.2 解法](#1-2-%E8%A7%A3%E6%B3%95)
2.  [2 数组](#2-%E6%95%B0%E7%BB%84)
    1.  [2.1 所有0移动到数组的末尾](#2-1-%E6%89%80%E6%9C%890%E7%A7%BB%E5%8A%A8%E5%88%B0%E6%95%B0%E7%BB%84%E7%9A%84%E6%9C%AB%E5%B0%BE)
    2.  [2.2 移除数组指定元素](#2-2-%E7%A7%BB%E9%99%A4%E6%95%B0%E7%BB%84%E6%8C%87%E5%AE%9A%E5%85%83%E7%B4%A0)
    3.  [2.3 移除数组重复元素](#2-3-%E7%A7%BB%E9%99%A4%E6%95%B0%E7%BB%84%E9%87%8D%E5%A4%8D%E5%85%83%E7%B4%A0)
    4.  [2.4 移除数组数量大于2的元素](#2-4-%E7%A7%BB%E9%99%A4%E6%95%B0%E7%BB%84%E6%95%B0%E9%87%8F%E5%A4%A7%E4%BA%8E2%E7%9A%84%E5%85%83%E7%B4%A0)
    5.  [2.5 数组重复元素排序](#2-5-%E6%95%B0%E7%BB%84%E9%87%8D%E5%A4%8D%E5%85%83%E7%B4%A0%E6%8E%92%E5%BA%8F)
    6.  [2.6 第K个最大数](#2-6-%E7%AC%ACK%E4%B8%AA%E6%9C%80%E5%A4%A7%E6%95%B0)
    7.  [2.7 最大的K个数](#2-7-%E6%9C%80%E5%A4%A7%E7%9A%84K%E4%B8%AA%E6%95%B0)
    8.  [2.8 两数之和](#2-8-%E4%B8%A4%E6%95%B0%E4%B9%8B%E5%92%8C)
3.  [参考](#%E5%8F%82%E8%80%83)

# 1 概述

## 1.1 数据结构

### 数组

-   排序
-   滑动窗口
-   去重
-   碰撞指针：回文串

### 链表

-   反转链表

### 二叉树

-   递归

### 树

-   b树：一个节点存多个值
    -   降低树高度，结和IO机制，降低IO次数
-   b+树：只有叶子节点存数据
    -   高效：中间节点不存数据，可存更多节点
    -   稳定：查找次数一致
    -   有序：叶子节点组成链表，方便批量查询
-   b-link树：节点指向右兄弟；每个节点存储High-key
    -   并发：根据High-key，并发场景下，可判断节点是否发生分裂，无需加锁

### 栈

### 队列

### 图

## 1.2 算法

-   动态规划
    -   功能：用表记录所有结果，避免重复计算（斐波那契、最长公共子序列）
    -   ## 问题

-   回溯：枚举 + 剪枝
-   分治
-   贪心

## 1.2 解法

**数组**

1.  移动0：数组中，将0移到数组末尾
    -   冒泡排序：把0冒泡到末尾（不改变元素顺序）

        ```c
        for (i = 0; i < arrsz; i++) {
            if (arr[i] == 0) {
                ...
            }
        }
        ```

2.  移除元素：数组中，将指定val移除，返回移除后的数组
    -   冒泡排序：把val冒泡到末尾
    -   首尾双指针：把val与末尾交换（可改变元素顺序）

        ```c
        for (i = 0; i < arrsz; i++) {
            if (arr[i] == val) {
                ...
            }
        }
        ```

3.  删除重复元素：有序数组中，删除重复项
    -   双指针：start和end分别指向重复元素首末，然后start = end + 1

        ```c
        while (start < arrsz && end < arrsz) {
            while (end < arrsz && arr[end] == arr[start]) {
                end++;
            }
            arr[newsz++] = arr[start];
            start = end;
        }
        ```

4.  颜色分类：数组中，仅包含0,1,2，排序
    -   冒泡排序：把大数冒泡到后面

        ```c
        for (i = 0; i < arrsz - 1; i++) {
            if (arr[i] > arr[i + 1]) {
                SWAP(arr, i, i + 1);
            }
        }
        bubble_sort(arr, arrsz - 1);
        ```

    -   双指针p0,p1,pcur：覆盖 + 补偿 （仅扫描一次）：首先，p0与p1扩展空间，然后交换

        ```c
        0 1 2 0 0
        0
          1
             cur : p0++, p1++, swap(p0, p1), swap(pcur, p0)
          0 (先扩展p0)
            1 (再扩展p1，最后交换)
        ```

5.  第K个最大数：数组中，第K个最大数
    -   快速排序
    -   堆排序：建堆，删除k-1次堆顶
6.  两数之和：有序数组中，查找和为target的2个数
    -   二分查找
    -   首尾双指针
    -   哈希表
7.  回文字符串：字符串中，排除空格特殊字符和大小写，正读和反读一样
    -   首尾双指针

# 2 数组

## 2.1 所有0移动到数组的末尾

> [https://leetcode.cn/problems/move-zeroes/](https://leetcode.cn/problems/move-zeroes/)

```c
void move_zero(int *arr, int arrsz) // 冒泡排序
{
    int tmp;
    int i;

    if (arrsz <= 1) {
        return;
    }

    for (i = 0; i < arrsz - 1; i++) {
        if (arr[i] == 0) {
            tmp = arr[i];
            arr[i] = arr[i + 1];
            arr[i + 1] = tmp;
        }
    }
    arrsz--;
    move_zero(arr, arrsz);
}
```

## 2.2 移除数组指定元素

```c
int remove_num(int *arr, int arrsz, int num) // 双指针，冒泡排序
{
    int left;
    int right;
    int cnt = 0;

    if (arrsz < 1) {
        return 0;
    }

    for (left = 0, right = arrsz - 1; left <= right; left++) {
        if (arr[left] == num) {
            cnt++;
            for (; arr[right] == num && right > left; cnt++, right--){}
            if (left < right) {
                SWAP(arr, left, right);
                right--;
            }
        }
    }
    return arrsz - cnt;
}
```

## 2.3 移除数组重复元素

```c
int remove_dumpicate(int *arr, int arrsz) // 双指针
{
    int start;
    int end;
    int newsz = 0;

    if (arrsz <= 1) {
        return arrsz;
    }

    start = 0;
    end = start;
    while (start < arrsz && end < arrsz) {
        while (end < arrsz && arr[end] == arr[start]) {
            end++;
        }
        arr[newsz++] = arr[start];
        start = end;
    }

    return newsz;
}
```

## 2.4 移除数组数量大于2的元素

```c
int remove_dumpicate2(int *arr, int arrsz) // 双指针
{
    int start;
    int end;
    int newsz = 0;

    if (arrsz <= 1) {
        return arrsz;
    }

    start = 0;
    end = start;
    while (start < arrsz && end < arrsz) {
        while (end < arrsz && arr[end] == arr[start]) {
            end++;
        }
        arr[newsz++] = arr[start];
        if (end - start >= 2) {
            arr[newsz++] = arr[start];
        }
        start = end;
    }

    return newsz;
}
```

## 2.5 数组重复元素排序

```c
void bubble_sort(int *arr, int arrsz) // 冒泡排序
{
    if (arrsz <= 1) {
        return;
    }

    int i;
    for (i = 0; i < arrsz - 1; i++) {
        if (arr[i] > arr[i + 1]) {
            SWAP(arr, i, i + 1);
        }
    }
    bubble_sort(arr, arrsz - 1);
}

void bubble_sort1(int *arr, int arrsz) // 双指针，覆盖 + 补偿
{
    if (arrsz <= 1) {
        return;
    }

    int p0 = 0;
    int p1 = 0;
    int i;
    /*
     * 0 0 1 1 2 2 1 0 0 1
     *   -
     *       +
     *             ^
     */
    for (i = 0; i < arrsz - 1; i++) {
        if (arr[i] == 0) {

        }
        if (arr[i] > arr[i + 1]) {
            SWAP(arr, i, i + 1);
        }
    }
    bubble_sort(arr, arrsz - 1);
}
```

## 2.6 第K个最大数

```c
int max_k(int *arr, int arrsz, int k) // 第k个最大数：构造大顶堆，删除k-1次栈顶
{
#define ROOT_NODE(child) (int)(((child) - 1) / 2)

    int *heap = arr;
    int heapsz;
    int father;
    int child;

    if (k > arrsz) {
        return -1;
    }

    for (heapsz = 1; heapsz <= arrsz; heapsz++) {  // 自底向上，构造大顶堆
        for (child = heapsz - 1, father = ROOT_NODE(child); child != 0; child = father, father = ROOT_NODE(child)) {
            if (heap[father] < heap[child]) {
                SWAP(heap, child, father);
            }
        }
    }
    heapsz--;

#define LEFT_NODE(father) (2 * (father) + 1)
#define RIGHT_NODE(father) (2 * (father) + 2)

    int left;
    int right;
    int max;
    int tarheapsz = arrsz - k + 1;
    while (heapsz > tarheapsz) { // 交换首尾，自顶向下，重构大顶堆
        prt(heap, heapsz);
        SWAP(heap, 0, heapsz - 1);
        heapsz--;

        for (father = 0, left = LEFT_NODE(father), right = RIGHT_NODE(father); father < heapsz; left = LEFT_NODE(father), right = RIGHT_NODE(father)) {
            if (left >= heapsz) {
                break;
            }
            max = left < heapsz && right < heapsz ? (heap[right] > heap[left] ? right : left) : left;
            if (heap[father] < heap[max]) {
                SWAP(heap, father, max);
                father = max;
                continue;
            }
            break;
        }
    }

    return heap[0];
}
```

## 2.7 最大的K个数

-   维护小顶堆
-   if num > heap[0] : heap[0] = num, shift(heap)

## 2.8 两数之和

# 参考

-   [https://leetcode.cn/circle/article/QxxqIF/](https://leetcode.cn/circle/article/QxxqIF/)
