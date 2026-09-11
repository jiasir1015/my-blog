+++
title = 'fepaser'
date = '2025-05-21T16:27:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['查询优化']
weight = 900
ShowToc = true
TocOpen = true
+++
```bash
# 安装nodejs
yum install -y nodejs

# 安装claude
npm install -g @anthropic-ai/claude-code

# 验证
claude --version
```

```bash
cd /data/postgresql17

# 5. 启动 Claude Code 并进行首次认证
# 运行后，终端会提供一个链接，在浏览器中完成账号授权即可
claude

# 6. (可选但推荐) 生成项目记忆文件
# 在 Claude 交互界面中，输入以下命令，它会分析项目并生成 CLAUDE.md 文件
/init
```
