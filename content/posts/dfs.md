+++
date = '2026-02-24T12:02:52+08:00'
draft = false
title = '深度优先遍历'
categories = ["Algorithm"]

tags = ["DFS", "LeetCode"]
ShowToc = true
TocOpen = true
+++

今天的每日一题：1202. 从根到叶的二进制数之和。

简单来说，就是给定一颗层序遍历的数组，表示一颗树，例如：

```bash
输入：root = [1,0,1,0,1,0,1]
输出：22
解释：(100) + (101) + (110) + (111) = 4 + 5 + 6 + 7 = 22
```

可以表示为：

```bash
    1
   / \
  0   1
 / \  / \
0  1  0  1
```

思路就是使用dfs来遍历这个树，代码为：

```C++
/**
 * Definition for a binary tree node.
 * struct TreeNode {
 *     int val;
 *     TreeNode *left;
 *     TreeNode *right;
 *     TreeNode() : val(0), left(nullptr), right(nullptr) {}
 *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
 *     TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
 * };
 */
class Solution {
public:
    int dfs(TreeNode *root, int val) {
        if (root == nullptr)
            return 0;

        val = val << 1 | root->val;
        if (root->left == nullptr && root->right == nullptr)
            return val;
        
        return dfs(root->left, val) + dfs(root->right, val);
    }

    int sumRootToLeaf(TreeNode* root) {
        return dfs(root, 0);    
    }
};
```
拿到这个题就知道用dfs，但是这个计算的方式确实没想到，二进制移位操作，并且使用局部变量保存临时结果，就不需要复杂的字符串拼接然后转换10进制了，例如上例：

```bash
1. root->val : 1
    curr val : 1
    goto dfs(root->left, 1)
2. root->left->val : 10
    curr val : 10
    goto dfs(root->left->left, 10)
3. root->left->left->val : 100
    curr val : 100
    return 100
4. goto 2
    goto dfs(root->left->right, 10)
    curr val : 10
5. root->left->right->val : 101
    curr val : 101
    return 101
6. goto 2
    return 100 + 101
    curr val : 10
7. goto 1
    curr val : 1
    goto dfs(root->right, 1)
8. root->right->val : 11
    curr val : 11
    goto dfs(root->right->left, 11)
9. root->right->left->val : 110
    curr val : 110
    return 110
10. goto 8
    curr val : 11
    goto dfs(root->right->right, 11)
11. root->right->right->val : 111
    curr val : 111
    return 111
12. goto 7
    curr val : 1
    return 110 + 111
13 return 100 + 101 + 110 + 111

```

如此一来就可以得到最后的结果，虽然是一道easy，但还是想了很久，下次碰到类似题目，希望可以记住这样好的思路。
