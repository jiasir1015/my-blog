+++
title = 'tool.markdown.轻量级语言语法'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['工具']
weight = 900
ShowToc = true
TocOpen = true
+++
> 说明：原始markdow语法见本文底部

目录：  

1.  [标题：1](#%E6%A0%87%E9%A2%98%EF%BC%9A1)
    1.  [标题：1.1](#%E6%A0%87%E9%A2%98%EF%BC%9A1-1)
        1.  [标题：1.1.1](#%E6%A0%87%E9%A2%98%EF%BC%9A1-1-1)
            1.  [标题：1.1.1.1](#%E6%A0%87%E9%A2%98%EF%BC%9A1-1-1-1)
                1.  [标题：1.1.1.1.1](#%E6%A0%87%E9%A2%98%EF%BC%9A1-1-1-1-1)
                    1.  [标题：1.1.1.1.1.1](#%E6%A0%87%E9%A2%98%EF%BC%9A1-1-1-1-1-1)

加粗：**test**  
横线：~test~  
斜体：*test*

# 标题：1

## 标题：1.1

### 标题：1.1.1

#### 标题：1.1.1.1

##### 标题：1.1.1.1.1

###### 标题：1.1.1.1.1.1

$~~$缩进

节点：

-   a
-   b
    -   ba

序号：

1.  a
2.  b
    1.  c
    2.  d

分割线

---

链接：[点我](http://www.baidu.com/ "点我")

链接：[[id]](http://www.baidu.com/)  
something  
something

图片：`[![desc](/path/to/img.png)](http://www.baidu.com/ "desc")`

引用：

> line 1  
> line 2

ada

代码`func(int a, int b)`

代码块：

```c
def func(int a, int b)
{
	return 0;
}
```

```python
def func(a, b):
    c = "abc"
    return a + b
```

表格：

| c1 | c2 | c3 |
| :-- | --: | :-: |
| 1 | 2 | 3 |
| 2 | 2 | 3 |

html转换：  
&hearts;

分页符：

[========]

abc

```markdown
目录：
    标题：1标题：1.1标题：1.1.1标题：1.1.1.1标题：1.1.1.1.1标题：1.1.1.1.1.1

加粗：**test**  
横线：~~test~~  
斜体：*test*  

# 标题：1  
## 标题：1.1  
### 标题：1.1.1  
#### 标题：1.1.1.1  
##### 标题：1.1.1.1.1  
###### 标题：1.1.1.1.1.1  

$~~$

节点：  
- a  
- b  
    - ba  
  
序号：  
1. a
2. b  
   1. c
   2. d  

分割线  

------------

链接：[点我](http://www.baidu.com "点我")  

链接：[[id]][linkid]  
something  
something

[linkid]: http://www.baidu.com

图片：  
[![desc](../../1.PNG)](http://www.baidu.com "desc")

引用：
> line 1
> line 2

ada

代码`func(int a, int b)`

代码块：  
```

```markdown
def func(int a, int b)
{
	return 0;
}

def func(a, b):
    c = "abc"
    return a + b
```

```markdown
表格：  
| c1     |    c2  | c3 |
| :- | -: | :-: |
|    1 |    2 | 3|
|    2 |    2 |3|

html转换：
&hearts;

分页符：

[========]

abc
```
