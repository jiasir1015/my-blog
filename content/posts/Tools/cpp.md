+++
title = 'c++'
date = '2026-08-13T10:54:00+08:00'
lastmod = '2026-08-18T17:57:51+08:00'
draft = false
categories = ['工具']
tags = ['工具']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 容器

## 1.1 基本概念

c++ stl

-   对象
-   指针
-   引用
-   迭代器
-   容器接口

## 1.1 接口

```cpp
// 1.1 vector —— 动态数组
vector<int> v = {1, 2, 3};
v.push_back(4);          // 末尾添加
v.pop_back();            // 删除末尾
v.size();                // 元素个数
v.empty();               // 是否为空
v[0];                    // 随机访问（无边界检查）
v.at(0);                 // 随机访问（边界检查）
v.front(); v.back();     // 首/尾元素
v.clear();               // 清空

// 1.2 deque —— 双端队列
deque<int> d = {1, 2};
d.push_front(0);         // 头插
d.push_back(3);          // 尾插
d.pop_front();            // 头删
d.pop_back();             // 尾删
d.front(); d.back();     // 首/尾访问
d.size(); d.empty();

// 1.3 list —— 双向链表
list<int> l = {1, 2, 3};
l.push_front(0);
l.push_back(4);
l.pop_front(); l.pop_back();
l.remove(2);             // 删除所有值为2的元素
l.size(); l.empty();
l.front(); l.back();

// 1.4 set —— 有序唯一集合
set<int> s = {3, 1, 4, 1}; // 实际存储 {1,3,4}
s.insert(2);               // 插入
s.erase(3);                // 删除指定值
s.find(4);                 // 查找，返回迭代器，未找到返回 end()
s.count(1);                // 计数（0或1）
s.size(); s.empty();
// 允许重复元素用 multiset，接口基本相同

// 1.5 map —— 有序键值对
map<string, int> ages;
ages["Alice"] = 25;        // 插入/修改；注意：若 key 不存在，[] 会自动插入一个默认值(0)
ages["Bob"] = 30;
ages.erase("Alice");       // 删除
ages.find("Bob");          // 查找，不想触发自动插入就用 find 而不是 []
ages.count("Tom");         // 计数
ages.size(); ages.empty();
// 允许重复key用 multimap，接口基本相同

// 1.6 unordered_set —— 哈希无序集合
unordered_set<int> us = {3, 1, 4, 1};
us.insert(2);
us.erase(4);
us.find(3);                // O(1) 查找
us.count(1);
us.size(); us.empty();

// 1.7 unordered_map —— 哈希无序键值对
unordered_map<string, int> scores;
scores["Tom"] = 95;
scores["Jerry"] = 88;
scores.erase("Tom");
scores.find("Jerry");
scores.count("Bob");
scores.size(); scores.empty();

// 1.8 stack —— 栈（LIFO）
stack<int> st;
st.push(1);                // 入栈
st.push(2);
st.top();                  // 查看栈顶
st.pop();                  // 出栈（无返回值）
st.empty(); st.size();

// 1.9 priority_queue —— 优先队列（默认最大堆）
priority_queue<int> pq;
pq.push(5);
pq.push(1);
pq.push(10);
pq.top();                  // 最大元素（10）
pq.pop();                  // 移除堆顶
pq.empty(); pq.size();
// 想要最小堆：priority_queue<int, vector<int>, greater<int>> minPq;

// 1.10 pair —— 两个值的组合，不用专门定义 struct
pair<string, int> p1 = {"Alice", 25};
p1.first;                  // "Alice"
p1.second;                 // 25
pair<int, int> p2 = make_pair(1, 2); // 另一种构造写法

// 1.11 string —— 字符串（可以当成 char 的容器，替代 char* + strcpy/strcat 那一套）
string s2 = "hello";
s2 += " world";            // 拼接
s2.size(); s2.length();    // 长度（两个等价）
s2.empty();
s2[0];                     // 下标访问
s2.substr(1, 3);           // 从下标1开始取3个字符，"ell"
s2.find("wor");            // 查找子串，返回起始下标，找不到返回 string::npos
s2.replace(0, 5, "Hi");    // 替换
s2.append("!");            // 追加
to_string(42);              // int -> string
stoi("123");                 // string -> int
s2.c_str();                 // 要传给 C 函数（如 fopen）时转成 const char*

// 1.12 array —— 固定大小数组（比原生C数组多了 .size() 等接口，但不能动态扩容）
array<int, 3> a = {1, 2, 3};
a.size();
a[0];
a.fill(0);                  // 全部填充为0
```

## 1.2 其他

对所有容器通用

```cpp
vector<int> v = {10, 20, 30, 40};

// 1 正向遍历
for (auto it = v.begin(); it != v.end(); ++it) {
    cout << *it << " ";
}

// 2 反向遍历
for (auto it = v.rbegin(); it != v.rend(); ++it) {
    cout << *it << " ";
}

// 交换
vector<int> v2 = {100, 200};
v.swap(v2);  // 现在 v={100,200}, v2={10,20,30,40}

// 遍历
for (int x : v) {
    cout << x << " ";
}

// 遍历修改
for (int& x : v) {
    x = x * 2;  // 每个元素翻倍（用 & 拿到的是引用，不加 & 修改的是拷贝，不会生效）
}

// 指定位置插入/删除
v.insert(v.begin() + 1, 99);   // 在下标1处插入99
v.erase(v.begin());            // 删除第一个元素
v.emplace_back(10);            // 等价于 push_back，但直接在容器内原地构造，少一次拷贝

// ⚠️ 迭代器失效：vector 在 push_back 触发扩容时，
// 之前保存的迭代器/指针/引用会全部失效，不能再用
// （和 C 里 realloc 之后旧指针失效是一个道理）
vector<int> vv = {1, 2, 3};
int* p = &vv[0];
vv.push_back(4);   // 如果触发了扩容，p 就已经失效，不能再解引用
```

# 2 函数

```cpp
vector<int> v = {5, 2, 8, 1, 9};

// ---------- 排序 ----------
sort(v.begin(), v.end());              // 升序：{1,2,5,8,9}
sort(v.begin(), v.end(), greater<int>()); // 降序：{9,8,5,2,1}

// ---------- 查找 ----------
auto it = find(v.begin(), v.end(), 5); // 线性查找
if (it != v.end()) cout << "找到了 " << *it;

// ---------- 二分查找（必须有序） ----------
bool found = binary_search(v.begin(), v.end(), 8); // true

// ---------- 区间查找（必须有序） ----------
auto lb = lower_bound(v.begin(), v.end(), 5); // 第一个 >=5 的位置
auto ub = upper_bound(v.begin(), v.end(), 5); // 第一个 >5 的位置

// ---------- 最值 ----------
auto maxIt = max_element(v.begin(), v.end()); // 迭代器，指向最大值
auto minIt = min_element(v.begin(), v.end()); // 迭代器，指向最小值
cout << *maxIt << " " << *minIt;
int m1 = max(3, 5);   // 5，直接比较两个值（不是容器）
int m2 = min(3, 5);   // 3

// ---------- 计数 ----------
int c1 = count(v.begin(), v.end(), 2);           // 值等于2的个数
int c2 = count_if(v.begin(), v.end(), [](int x){ // 满足条件的个数
    return x % 2 == 0;
});

// ---------- 遍历（替代循环） ----------
for_each(v.begin(), v.end(), [](int x) { cout << x << " "; });

// ---------- 变换 ----------
vector<int> squared(v.size());
transform(v.begin(), v.end(), squared.begin(), [](int x){
    return x * x;
});

// ---------- 反转 / 填充 ----------
reverse(v.begin(), v.end());          // 原地反转
fill(v.begin(), v.end(), 0);          // 全部填充为0

// ---------- 累加 ----------
int sum = accumulate(v.begin(), v.end(), 0); // 0+所有元素

// ---------- 复制 ----------
vector<int> dest(v.size());
copy(v.begin(), v.end(), dest.begin());

// ---------- 迭代器距离 ----------
int idx = distance(v.begin(), it);   // it 到 begin 的距离，常用来把迭代器转成下标

// ---------- 删除（配合 erase） ----------
v = {1, 2, 3, 2, 4};
auto new_end = remove(v.begin(), v.end(), 2); // 把2移到末尾，返回新逻辑末尾
v.erase(new_end, v.end()); // 实际删除，v 变成 {1,3,4}

// ---------- 去重（必须有序） ----------
v = {1, 1, 2, 3, 3, 4};
sort(v.begin(), v.end());         // 先排序
auto last = unique(v.begin(), v.end());
v.erase(last, v.end());
```

# 3 示例

## lru缓存

[https://leetcode.cn/problems/OrIXps/description/](https://leetcode.cn/problems/OrIXps/description/)
