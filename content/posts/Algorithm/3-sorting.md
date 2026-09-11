+++
title = '数据结构与算法 3 排序'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据结构与算法']
tags = ['数据结构与算法']
weight = 300
ShowToc = true
TocOpen = true
+++
# 1 概述

## 1.1 衡量标准

## 1.2 分类

| 算法 | 思想 | 最好时间复杂度 | 最坏时间复杂度 | 时间复杂度 | 空间复杂度 | 稳定性 |
| --- | --- | --- | --- | --- | --- | --- |
| 冒泡排序 | 比较、交换 | O(n) | O(n^2) | O(n^2) | O(1) | 稳定，值相等不交换 |
| 插入排序 | 比较、移动 | O(n) | O(n^2) | O(n^2) |  |  |
| 选择排序 | 比较、交换 |  |  |  |  |  |
| 归并排序 |  |  |  |  |  |  |
| 快速排序 |  |  |  |  |  |  |
| 堆排序 |  |  |  |  |  |  |
| 桶排序 |  |  |  |  |  |  |
| 计数排序 |  |  |  |  |  |  |
| 基数排序 |  |  |  |  |  |  |

```c
/* 冒泡排序 */
void sort_bubble(int *arr, int arrlen)
{
    int end;
    int tmp;
    int i;

    end = arrlen - 1;
    for (end = arrlen - 1; end > 1; end--) {
        for (i = 0; i < end - 1; i++) {
            if (arr[i] < arr[i + 1]) {
                tmp = arr[i];
                arr[i] = arr[i + 1];
                arr[i + 1] = tmp;
            }
        }
    }
}
```
