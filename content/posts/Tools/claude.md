+++
title = 'claude'
date = '2026-03-06T17:18:00+08:00'
lastmod = '2026-09-02T16:23:38+08:00'
draft = false
categories = ['工具']
tags = ['工具']
weight = 900
ShowToc = true
TocOpen = true
+++
# 安装

```bash
wget https://unofficial-builds.nodejs.org/download/release/v20.18.1/node-v20.18.1-linux-x64-glibc-217.tar.xz

tar -Jxvf node-v20.18.1-linux-x64-glibc-217.tar.xz
mv node-v20.18.1-linux-x64-glibc-217 node-20

touch envn
echo '
export NODEHOME=`pwd`/node-20
export PATH=$NODEHOME/bin:$PATH
export LD_LIBRARY_PATH=$NODEHOME/lib:$LD_LIBRARY_PATH
' > envn
source envn

mkdir npm-global
npm config set prefix `pwd`/npm-global

npm config set prefix $NODEHOME/npm-global

echo 'export PATH=$NODEHOME/../npm-global/bin:$PATH' >> envn
source envn

npm pack @anthropic-ai/claude-code
npm install -g ./anthropic-ai-claude-code-2.1.162.tgz

claude --version

https://www.tapd.cn/43100420/markdown_wikis/show/#1143100420001007544

export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
export ANTHROPIC_AUTH_TOKEN="sk-e435fe4629934fc892c226fc26d7ac92"
export ANTHROPIC_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
export CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
export CLAUDE_CODE_EFFORT_LEVEL=max

# 内网
export ANTHROPIC_BASE_URL=http://172.16.99.137:8081
export ANTHROPIC_AUTH_TOKEN=sk-q49Joop5Yz2BuS1ZPBPWJuCvwnS5elwKy9nP7PaLSi6fWrdy
export ANTHROPIC_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
export CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
export CLAUDE_CODE_EFFORT_LEVEL=max

# 内网 glm
export ANTHROPIC_BASE_URL=http://172.16.99.137:8081
export ANTHROPIC_AUTH_TOKEN=sk-q49Joop5Yz2BuS1ZPBPWJuCvwnS5elwKy9nP7PaLSi6fWrdy
export ANTHROPIC_MODEL=glm-5.2
export ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.2
export ANTHROPIC_DEFAULT_SONNET_MODEL=glm-5.2
export ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-5
export CLAUDE_CODE_SUBAGENT_MODEL=glm-5
export CLAUDE_CODE_EFFORT_LEVEL=max

# 外网： http://172.16.105.104:3000

$env:ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN = "sk-e435fe4629934fc892c226fc26d7ac92"
$env:ANTHROPIC_MODEL = "deepseek-v4-flash"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL = "deepseek-v4-flash"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = "deepseek-v4-flash"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "deepseek-v4-flash"
$env:CLAUDE_CODE_SUBAGENT_MODEL = "deepseek-v4-flash"
$env:CLAUDE_CODE_EFFORT_LEVEL = "max"

# 外网 海量
$env:ANTHROPIC_BASE_URL = "http://172.16.105.104:3000"
$env:ANTHROPIC_AUTH_TOKEN = "sk-q49Joop5Yz2BuS1ZPBPWJuCvwnS5elwKy9nP7PaLSi6fWrdy"
$env:ANTHROPIC_MODEL = "glm-5.2"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL = "glm-5.2"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = "glm-5.2"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "glm-5"
$env:CLAUDE_CODE_SUBAGENT_MODEL = "glm-5"
$env:CLAUDE_CODE_EFFORT_LEVEL = "max"

export ANTHROPIC_BASE_URL=http://172.16.105.104:3000
export ANTHROPIC_AUTH_TOKEN=sk-q49Joop5Yz2BuS1ZPBPWJuCvwnS5elwKy9nP7PaLSi6fWrdy
export ANTHROPIC_MODEL=glm-5.2
export ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.2
export ANTHROPIC_DEFAULT_SONNET_MODEL=glm-5.2
export ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-5
export CLAUDE_CODE_SUBAGENT_MODEL=glm-5
export CLAUDE_CODE_EFFORT_LEVEL=max

# 外网 海量
$env:ANTHROPIC_BASE_URL = "http://172.16.105.104:3000"
$env:ANTHROPIC_AUTH_TOKEN = "sk-q49Joop5Yz2BuS1ZPBPWJuCvwnS5elwKy9nP7PaLSi6fWrdy"
$env:ANTHROPIC_MODEL = "deepseek-v4-flash"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL = "deepseek-v4-flash"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = "deepseek-v4-flash"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "deepseek-v4-flash"
$env:CLAUDE_CODE_SUBAGENT_MODEL = "deepseek-v4-flash"
$env:CLAUDE_CODE_EFFORT_LEVEL = "max"

export ANTHROPIC_BASE_URL=http://172.16.105.104:3000
export ANTHROPIC_AUTH_TOKEN=sk-q49Joop5Yz2BuS1ZPBPWJuCvwnS5elwKy9nP7PaLSi6fWrdy
export ANTHROPIC_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
export CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
export CLAUDE_CODE_EFFORT_LEVEL=max

[System.Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://api.deepseek.com/anthropic", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "sk-e435fe4629934fc892c226fc26d7ac92", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_MODEL", "deepseek-v4-pro[1m]", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_DEFAULT_OPUS_MODEL", "deepseek-v4-pro[1m]", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_DEFAULT_SONNET_MODEL", "deepseek-v4-pro[1m]", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_DEFAULT_HAIKU_MODEL", "deepseek-v4-flash", "User")
[System.Environment]::SetEnvironmentVariable("CLAUDE_CODE_SUBAGENT_MODEL", "deepseek-v4-flash", "User")
[System.Environment]::SetEnvironmentVariable("CLAUDE_CODE_EFFORT_LEVEL", "max", "User")

```

```bash
# 安装nodejs
yum install -y nodejs

mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

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

```bash
# linux 使用代理
curl -L https://github.com/MetaCubeX/mihomo/releases/latest/download/mihomo-linux-amd64-compatible.gz | gunzip > /usr/local/bin/mihomo
chmod +x /usr/local/bin/mihomo

mkdir -p /etc/clash
curl -o /etc/clash/config.yaml http://43.135.139.219:9999/clash.yaml

# 3. 启动 Clash
nohup mihomo -f /etc/clash/config.yaml > /var/log/clash.log 2>&1 &

# 4. 设置代理环境变量（Clash 默认 mixed-port 7890）
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890

# 5. 测试
curl -I https://www.google.com

git config --global user.name "shenkun"
git config --global user.email "shenkun@bupt.cn"

ssh-keygen -t rsa -C "shenkun@bupt.cn"
cat ~/.ssh/id_rsa

yum install proxychains-ng -y
echo "socks5  10.255.255.254  1080" >> /etc/proxychains.conf

# windows11 安装clash
https://github.com/clash-verge-rev/clash-verge-rev/releases

yum install -y shadowsocks-libev

cat > /etc/shadowsocks-libev/client.json << 'EOF'
{
"server": "43.135.139.219",
"server_port": 443,
"local_address": "127.0.0.1",
"local_port": 1080,
"password": "gauss@123",
"method": "aes-256-gcm"
}
EOF

ss-local -c /etc/shadowsocks-libev/client.json -f /var/run/ss-local.pid
export https_proxy=socks5://127.0.0.1:1080

# githup
```

# 使用

```bash
# 启动
claude
claude --resume # 恢复最近一次对话
claude --continue # 继续上一次对话
claude --model <name> # 指定模型
claude --dangerously-skip-permissions # 跳过所有权限确认
claude update

# 命令
/clear # 清楚所有对话
/compact # 压缩上下文，保留摘要
/rewind # 回滚上一次对话
/memory # 编辑记忆文件，记住偏好
/resume # 恢复历史会话
/context # 显示上下文窗口使用量

# 项目
/init 初始化项目，生成CLAUDE.md
/review # 代码审查
/commit # 提交

# 环境
/config # 调整主题、模型等
/model [name] # 切换模型
/permissions # 工具权限白名单
/doctor # 检查环境
/mcp
/cost # token用量和费用
/usage

# 扩展
/skill
/自定义skill

# 快捷键
| 快捷键 | 功能 |
| :--- | :--- |
| `Shift + Tab` | 循环切换三种模式：计划模式 → 默认模式 → 自动编辑模式 |
| `!command` | 直接在终端执行 bash 命令（不发给 AI） |
| `Ctrl + B` | 将阻塞的进程放到后台，继续对话 |
| `Esc Esc` | 双击 Esc 等同于 `/rewind` 回滚 |
| `Ctrl + V` | 粘贴图片到对话框 |
| `Option/Ctrl + Enter` | 输入框换行（Enter 是直接发送） |
```

| 模型名称 | 厂商 | 发布时间 | 核心亮点（精简） | 定位/优势场景 |
| :-- | :-- | :-- | :-- | :-- |
| GPT-5.6 (Sol/Terra/Luna) | OpenAI | 2026.07.09 | 7月9日刚全球开放；三档分层+速度拨盘；Codex与ChatGPT合一 | 全能旗舰、超级智能体 |
| GPT-5.5 | OpenAI | 2026.04.24 | 首个从零重训基础模型；100万tokens；MoE+Verifier架构 | 真实工作流、编程调试 |
| DeepSeek-V4 (Pro/Flash) | 深度求索 | 2026.04.24 | 万亿参数MoE开源；百万token原生上下文；成本仅OpenAI 1/100 | 开源性价比之王、Agent |
| Qwen3.7-Max | 阿里巴巴 | 2026.05.20 | 国产Arena盲测第一；全域思考模式；Agentic Coding全球前三 | 国产旗舰、智能体编程 |
| Claude Opus 4.7/4.8 | Anthropic | 2026 Q2 | 代码质量最优；长文本推理首选；WebDev Arena排名第一 | 编程审校、深度推理 |
| Gemini 3.5 Pro | Google | 2026.06 | Artificial Analysis智能指数登顶；集成计算机使用(CU)能力 | 复杂推理、多模态科研 |
| Grok 4 / 4.5 | xAI | 2026.05-07 | 实时接入X平台；编码与Agent能力持续强化；百亿~千亿参数 | 实时信息、社交分析 |
| Kimi-K2.6 | 月之暗面 | 2026 H1 | 长文本办公统治级；JSON输出稳定；指令遵循能力强 | 办公自动化、Agent |
| GLM-5.1 | 智谱AI | 2026 Q2 | 国产第一梯队；编程能力进入Top7；综合能力稳居前列 | 通用对话、编程辅助 |
| 豆包 2.1 Pro | 字节跳动 | 2026.06 | 中文口语最自然；移动端交互最佳；多模态细节强 | C端用户、内容创作 |
| Meta Muse Spark 1.1 | Meta | 2026.07 | 首次开放Model API；正面争夺企业开发者市场 | 企业开发、开源生态 |
| Llama 4 | Meta | 2026(预计) | 开源生态标杆；多模态原生；社区微调最丰富 | 开源基座、定制微调 |
