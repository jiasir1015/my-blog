+++
title = 'tool.flex.词法解析工具'
date = '2025-01-21T13:55:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['工具']
weight = 900
ShowToc = true
TocOpen = true
+++
目录：  

1.  [1 概述](#1-%E6%A6%82%E8%BF%B0)
2.  [2 flex](#2-flex)
3.  [参考：](#%E5%8F%82%E8%80%83%EF%BC%9A)

# 1 概述

**需求**  
判断字符串，是否满足规定的规则。

**示例**  
字符串：

> ‘abc’, ‘a1’, ‘a+’, …

规则：

> 字符串中只包含字母

编码：

```c
/* 省略 */
```

问题：

> **复杂性**：在字符串较长，规则繁多时，判断逻辑将会很复杂，编码工作量大

方案：

> -   通过通用的**正则表达式**制定规则
> -   通过很多开源或非开源的词法解析工具，实现判断逻辑。

正则表达式：

> [a-zA-Z]+ ： 字符串中只包含字母

如此，我们仅需简单制定正则表达式，通过第三方词法解析工具实现判断逻辑。

# 2 flex

**1 词法解析**  
词法解析工具有很多，本文仅介绍flex。  
flex编写的规则文件，后缀为.l

**2 编译流程**

> 1.  编写 [规则.l] 文件
> 2.  通过flex，将 [规则.l] 文件，转换为 [规则.c] 文件
> 3.  将 [规则.c] 文件，以其他文件一起，正常编译即可

**3 文件格式**

```c
%{
/* include */
%}

/* define */

%%
rule {code();}
%%

void usercode()
{  
  yylex();
}
```

**4 正则表达式**  
**单字符**

| 模式 | 示例 | 解释 | 公式 | 示例 rule {printf(“-“);} |
| --- | --- | --- | --- | --- |
| a | a | 相等字符 | $ = a | abac : -b-c |
| . | 任意字符 | 任意字符，除换行符 | $ != \\n | abc : — |
| [a b c] | a, b, c | 任一字符 | $ = a or a or a | a+b+c : -+-+- |
| [a b-d] | a, b, c, d | 范围字符 | $ = a or b to d | a+c : -+- |
| [^ a] | b, c, … | 其他字符，除a外 | $ = !a | bab : -a- |
| [^ a-z] | A, B, … | 其他字符，除a到z外 | $ = !(a to z) | Abc : A– |
| [^ a-z A-Z] | 1, 2, … | 其他字符，除a到z外，除A-Z外 |  | Aa1 : Aa- |
| a? | a | 是否存在，存在于不存在 |  | a,aa,baac : -,–,b–c |

**重复多字符**

| 模式 | 示例 | 解释 | 公式 | 示例 rule {printf(“-“);} |
| --- | --- | --- | --- | --- |
| a\* | a, aa, aaa, … | 任意重复字符,零个或多个 |  | a,aa,baab : -,-,b-b |
| a+ | a, aa, aaa, … | 任意重复字符，一个或多个 |  | a,aa,baab : -,-,b-b |
| r{3, 4} | aaa,aaaa | 指定重复字符 |  | aa,aaa,aaaaa : aa,-,-a |
| r{3, } | aaa, … | 指定重复字符，大于3个 |  | aa,aaa,aaaaa : aa,-,- |

**字符连接**

| 模式 | 解释 | 示例 rule {printf(“-“);} |
| --- | --- | --- |
| abc | 字符串联 | ab,abc,abcd : ab,-,-d |
| a|bc | 并联 | a,abc,bc,bcd : -,–,-,-d |
| a/b | 以b结尾，保留b | a,b,ab,acb : a,b,-b,acb |
| ab(cd)\* | 优先级 | ab,abcd,abcdcd,abccd : -,-,-,-ccd |
| [a-d]{-}[cd] | 集合相减 | a,b,c,d : -,-,c,d |

**其他实例**

| 模式 | 示例 | 示例 rule {printf(“-“);} |
| --- | --- | --- |
| ab\* | a,ab,abb | 任意重复字符 |
| ab+ | ab,abb | 任意重复字符 |

**5 规则执行流程**

-   顺序执行，满足即停

    > [ab] {printf(“-“)}  
    > . []  
    > 结果：  
    > a,b,c,d : –

-   顺序执行，满足不停 REJECT

    > [ab] {printf(“-“); REJECT}  
    > . {printf(“+”);}  
    > 结果：  
    > a,b,c : -++-+++

-   条件执行 BEGIN(usestate) BEGIN(INITIAL)

    > %s state1  
    > /\* 也可以是： %x state1，如此，state1将变成一个整数 \*/
    >
    > %%  
    > s1 BEGIN(state1);  
    > [ab] printf(“+”);  
    > [ab] printf(“-“);  
    > e1 BEGIN(INITIAL);  
    > %%
    >
    > 结果：  
    > a s1 a e1 a : - + -

# 参考：

flex使用：  
[https://zhuanlan.zhihu.com/p/108167693](https://zhuanlan.zhihu.com/p/108167693)
