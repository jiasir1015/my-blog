+++
title = '数据结构与算法 4 图'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据结构与算法']
tags = ['数据结构与算法']
weight = 400
ShowToc = true
TocOpen = true
+++
# 1 图的介绍

## 1.1 定义

G = (V, E)

-   一组节点V
-   一组边E
-   节点的度：相邻节点的数量
-   完备图：所有节点都有n-1个相邻节点，即任意2节点间可达

## 1.2 分类

### 根据边分类

-   无向图

    ```
    n1 ---- n2
    |       |
    |       |
    n3 ---- n4
    ```

-   有向图

    ```
       --> n2
    n1       --> n4
       --> n3
    ```

-   带权有向图

    ```
        3
       ---> n2  6
    n1         ---> n4
       ---> n3
        5
    ```

### 图的性质分类

-   同构图：G和H，通过重新标记G的节点产生H。阶相等，顶点度数相等
-   异构图

## 1.3 表示

1.  邻接矩阵  
    如果节点间ni,nj之间有弧，则[ni, nj] = 1

    ```
         n1 n2 n3 n4
       +------------+
    n1 | 0  1  1  0 |
    n2 | 0  0  0  1 |
    n3 | 0  0  0  1 |
    n4 | 0  0  0  0 |
       +------------+
    ```

    无向图的斜下半部分是多余的

    ```c
    #define MAX_NODE_NUM

    typedef struct {
       int node_cnt;
       int edge_matrix[MAX_NODE_NUM][MAX_NODE_NUM];
       int node_visit[MAX_NODE_NUM][MAX_NODE_NUM];
    } Graph;
    ```

2.  邻接表

    ```
    [1] -> [2, 3]
    [2] -> [4]
    [3] -> [4]
    [4] -> []
    ```

    ```c
    typedef struct Node {
       int val;
       int weight;
       struct Node *next;
    } Node;

    typedef struct {
       int val;
       Node *next;
    } GraphNode;

    GraphNode graph[] = {0};
    ```

3.  弧表示法

    ```
    -----+---------------+
    起点 | 1 | 1 | 2 | 3 |
    终点 | 2 | 3 | 4 | 4 |
    权重 |   |   |   |   |
    -----+---------------+
    ```

# 2 图的遍历

```c
#define MAX_NODE_NUM

typedef struct {
   int node_num;
   int edge_matrix[MAX_NODE_NUM][MAX_NODE_NUM];
   int node_visit[MAX_NODE_NUM][MAX_NODE_NUM];
} Graph;

typedef struct {
   int x;
   int y;
} NodePlace;

void graph_dfs(Graph *graph, NodePlace node)
{
   int i;
   int j;
   for (i = 0; i < graph->node_cnt; i++) {
      .
   }
}
```
