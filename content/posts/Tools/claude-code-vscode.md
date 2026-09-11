+++
title = '国测 claude'
date = '2026-07-27T19:03:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['工具']
weight = 900
ShowToc = true
TocOpen = true
+++
# VSCode Claude Code 扩展配置

本文记录如何在 VSCode 中配置 Claude Code 扩展，接入第三方（海量/glm）模型服务，无需在本机维护环境变量，扩展启动时自动注入。

## 配置位置

VSCode 用户级配置文件：

-   **Windows**：`%APPDATA%\Code\User\settings.json`  
    （即 `C:\Users\<用户名>\AppData\Roaming\Code\User\settings.json`）
-   **macOS**：`~/Library/Application Support/Code/User/settings.json`
-   **Linux**：`~/.config/Code/User/settings.json`

打开方式：VSCode 中按 `Ctrl + ,` 打开设置 → 右上角「打开设置 (JSON)」图标，或直接 `Ctrl + Shift + P` 输入 `Preferences: Open User Settings (JSON)`。

## 完整配置

将以下内容合并进 `settings.json`（注意 JSON 语法，最后一项末尾不要多逗号）：

```json
{
    "claudeCode.environmentVariables": [
        { "name": "ANTHROPIC_BASE_URL", "value": "http://172.16.105.104:3000" },
        { "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-hR1tQQloyPW0ax9b7404D51285Ae4737A118457535Fc33Ae" },
        { "name": "ANTHROPIC_MODEL", "value": "glm-5.2" },
        { "name": "ANTHROPIC_DEFAULT_OPUS_MODEL", "value": "glm-5.2" },
        { "name": "ANTHROPIC_DEFAULT_SONNET_MODEL", "value": "glm-5.2" },
        { "name": "ANTHROPIC_DEFAULT_HAIKU_MODEL", "value": "glm-5" },
        { "name": "CLAUDE_CODE_SUBAGENT_MODEL", "value": "glm-5" },
        { "name": "CLAUDE_CODE_EFFORT_LEVEL", "value": "max" }
    ],
    "claudeCode.preferredLocation": "panel"
}
```

## 环境变量说明

| 变量名 | 作用 | 说明 |
| :-- | :-- | :-- |
| `ANTHROPIC_BASE_URL` | API 基础地址 | 指向第三方中转服务（兼容 Anthropic 协议）。海量外网网关示例：`http://172.16.105.104:3000` |
| `ANTHROPIC_AUTH_TOKEN` | 鉴权令牌 | 中转服务下发的 `sk-xxx`，等价于官方的 API Key |
| `ANTHROPIC_MODEL` | 默认模型 | 主对话使用的模型 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Opus 档模型 | 覆盖官方 Opus 映射，通常设为最强模型 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Sonnet 档模型 | 覆盖官方 Sonnet 映射，日常主力 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Haiku 档模型 | 覆盖官方 Haiku 映射，轻量快模型，用于补全/摘要 |
| `CLAUDE_CODE_SUBAGENT_MODEL` | 子 Agent 模型 | Task/Explore 等子任务使用的模型，建议用快模型省钱 |
| `CLAUDE_CODE_EFFORT_LEVEL` | 推理强度 | `max` 表示最高推理强度（思考最深），可选 `low/medium/high/max` |

> 扩展项 `claudeCode.preferredLocation`：控制 Claude Code 面板的默认停靠位置，可选 `panel`（底部面板）或 `editor`（作为编辑器标签页）。

## 配置步骤

1.  **安装扩展**：在 VSCode 扩展市场搜索 `Claude Code`（Anthropic 官方）并安装。
2.  **打开 settings.json**：按上面「配置位置」的方式打开用户设置 JSON。
3.  **粘贴配置**：把上方「完整配置」中的两个键合并进 JSON。
4.  **重启扩展**：保存后重新打开 VSCode，或 `Ctrl + Shift + P` → `Developer: Reload Window`，让环境变量生效。
5.  **验证**：打开 Claude Code 面板，输入 `/doctor` 或 `/model` 确认当前指向的是 `glm-5.2`。

## 多环境切换

只需改 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 和一组模型名即可切换。常用组合：

### 外网 · 海量网关 + GLM（当前默认）

```json
{ "name": "ANTHROPIC_BASE_URL", "value": "http://172.16.105.104:3000" },
{ "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-hR1tQQloyPW0ax9b7404D51285Ae4737A118457535Fc33Ae" },
{ "name": "ANTHROPIC_MODEL", "value": "glm-5.2" },
{ "name": "ANTHROPIC_DEFAULT_OPUS_MODEL", "value": "glm-5.2" },
{ "name": "ANTHROPIC_DEFAULT_SONNET_MODEL", "value": "glm-5.2" },
{ "name": "ANTHROPIC_DEFAULT_HAIKU_MODEL", "value": "glm-5" },
{ "name": "CLAUDE_CODE_SUBAGENT_MODEL", "value": "glm-5" }
```

### 内网 · GLM

```json
{ "name": "ANTHROPIC_BASE_URL", "value": "http://172.16.99.137:8081" },
{ "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-hR1tQQloyPW0ax9b7404D51285Ae4737A118457535Fc33Ae" },
{ "name": "ANTHROPIC_MODEL", "value": "glm-5.2" },
{ "name": "ANTHROPIC_DEFAULT_OPUS_MODEL", "value": "glm-5.2" },
{ "name": "ANTHROPIC_DEFAULT_SONNET_MODEL", "value": "glm-5.2" },
{ "name": "ANTHROPIC_DEFAULT_HAIKU_MODEL", "value": "glm-5" },
{ "name": "CLAUDE_CODE_SUBAGENT_MODEL", "value": "glm-5" }
```

### DeepSeek 官方（直连）

```json
{ "name": "ANTHROPIC_BASE_URL", "value": "https://api.deepseek.com/anthropic" },
{ "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-e435fe4629934fc892c226fc26d7ac92" },
{ "name": "ANTHROPIC_MODEL", "value": "deepseek-v4-pro[1m]" },
{ "name": "ANTHROPIC_DEFAULT_OPUS_MODEL", "value": "deepseek-v4-pro[1m]" },
{ "name": "ANTHROPIC_DEFAULT_SONNET_MODEL", "value": "deepseek-v4-pro[1m]" },
{ "name": "ANTHROPIC_DEFAULT_HAIKU_MODEL", "value": "deepseek-v4-flash" },
{ "name": "CLAUDE_CODE_SUBAGENT_MODEL", "value": "deepseek-v4-flash" }
```

> 命令行环境（非 VSCode）下，等价配置请见 [9-工具/claude.md](../9-%E5%B7%A5%E5%85%B7/claude.md)，用 `export` 或 PowerShell `$env:` 的方式设置同名变量。
