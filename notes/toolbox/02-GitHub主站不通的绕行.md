# GitHub 主站不通时的两条绕行路：git 走镜像、MCP 换本地

> **日期**: 2026-09-14
> **标签**: #GitHub #网络 #git #MCP #代理 #排错
> **状态**: 🟢 已整理

## 我要解决什么问题

目标是让 AI 助手能直接读写我的 GitHub 仓库。但实测发现：

**`github.com` 主站直接连不上（TCP 连接 21 秒超时）。**

然而奇怪的是——**同一台机器上，GitHub 的 API 却是通的**。这就给绕行留了空间。

## 核心概念

### 1. 先分清"GitHub 的哪一部分"

GitHub 不是一个地址，至少有三个不同的入口：

| 入口 | 域名 | 干什么 | 本例连通性 |
|---|---|---|---|
| 网站主站 | `github.com` | 网页、**git clone/push** | ❌ 21 秒超时 |
| REST API | `api.github.com` | 读写仓库内容、提交 | ✅ 0.5 秒 |
| npm 仓库 | `registry.npmjs.org` | 装包 | ✅ 1.1 秒 |

**这个组合意味着**：走 API 的自动化（脚本读写文件）能用，走 git 协议的直接卡死。

### 2. 测量之前要先排除干扰项

**这是今天最容易踩的坑**：一开始我测出的延迟全是错的。

原因：这台机器的 shell 环境里有**沙箱注入的代理**：

```
http_proxy = https_proxy = http://127.0.0.1:52524
```

这是工具环境临时注入的（**不是**用户级环境变量，用注册表核实过），
但**所有 curl 默认会走它**，于是测出来的延迟全是"经过代理的路"。

**正确做法：测试真实网络时必须显式绕过。**

```bash
curl -s -o /dev/null --noproxy '*' \
  -w "HTTP %{http_code}  DNS %{time_namelookup}s  连接 %{time_connect}s  总计 %{time_total}s\n" \
  --max-time 30 https://api.github.com/
```

> 结论先行：**"测量"本身也要先排除干扰项，否则后面所有推理都建在错的数据上。**

## 绕行路 A：让 git 走镜像

### 问题

装 GitHub 上的插件时，`dsh plugin add github:owner/repo` 内部执行的是 `git clone`，
而 git 走的就是 `github.com` —— 必然失败：

```
git ls-remote failed: Could not connect to server
```

### 解法

用一个公共镜像把 `github.com` 的 git 请求转发出去：

```bash
git config --global url."https://gh-proxy.com/https://github.com/".insteadOf "https://github.com/"
```

### 为什么用"全局配置"而不是环境变量

git 也支持用环境变量临时注入（不动配置文件）：

```bash
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0="url.https://gh-proxy.com/https://github.com/.insteadOf"
export GIT_CONFIG_VALUE_0="https://github.com/"
```

这种写法的好处是**只影响当前这次命令**。但本例不行 —— 因为
**桌面版应用会清洗子进程的环境变量**，env 注入在它自带的插件市场里**不生效**。

所以最终改成了全局配置。

### 影响面必须自查

改全局 git 行为之前，先确认"会不会碰到我已有的东西"：

```bash
# 扫一遍这台机器上有没有 git 仓库
find /c/Users/29381/Desktop /c/Users/29381/Documents /d /e/workbuddy文件夹 \
     -maxdepth 4 -type d -name .git 2>/dev/null
```

本例扫下来**一个 git 仓库都没有** → 影响面为零。

而且这条规则**只改传输路径，不动数据** —— 仓库里记录的 remote 仍然是原始 github.com 地址。

### 撤销

```bash
git config --global --unset url."https://gh-proxy.com/https://github.com/.insteadOf"
```

## 绕行路 B：把 MCP 从远端 HTTP 换成本地 stdio

### 问题

给 AI 助手接 GitHub 用的是 **MCP**（Model Context Protocol），最开始连的是官方远端端点
`https://api.githubcopilot.com/mcp/`。功能是好的，但**每次启动要多等 20 秒**：

```
mcp-client(github): connection attempt failed: TypeError: fetch failed
mcp-client(github): connection failed; retrying in 500ms (attempt 1/10)
mcp-client(github): reconnected and re-synced tools (attempt 1/10)   ← 18 秒后
```

### 根因

两个数字凑不到一起：

- 远端端点单次 `initialize` 握手要 **2.7~6.8 秒**
- MCP 客户端的连接超时是**硬编码的、不可配置**的（把源码翻了一遍：
  `toolCallTimeoutMs` 只管工具调用，那个 `5e3` 是"关闭代际"用的，都不是握手超时）

结果首次握手经常赶不上 → 退避重连 → 启动阶段白等 20 秒。

> 顺带排除：**不是 IPv6 问题** —— 该域名没有 AAAA 记录，强制 v4/v6 都很快。

### 解法：改用本地 stdio 服务器

| | 远端 HTTP | 本地 stdio |
|---|---|---|
| 握手在哪 | 网络上 | **本机（毫秒级）** |
| 启动时 | 要等网络握手 | 不等网络 |
| 调用工具时 | 直连 | 直连（api.github.com，0.5 秒） |

装上本地服务器后配到插件里，握手全在本机完成，**启动那 20 秒消失**。

实际验证（让助手真去读仓库）：

```
$ dsh --profile headless "使用 github 工具读取仓库 <owner>/<repo> 的根目录"
→ .gitignore / LICENSE / README.md / notes/ / projects/
```

## 踩坑记录

| 问题 | 原因 | 解决 |
|---|---|---|
| 测出来的延迟全是错的 | shell 里有沙箱注入的代理 | 测试真实网络加 `--noproxy '*'` |
| `dsh plugin add github:...` 必失败 | git 走 github.com，而它被墙 | 让 git 走镜像（全局 `insteadOf`） |
| env 注入镜像在应用里不生效 | 应用会清洗子进程的环境变量 | 改用全局 git 配置 |
| 装插件偶尔报"镜像太慢" | 设了 `GIT_HTTP_LOW_SPEED_TIME`，把慢但正常的连接误杀 | **别设这个**，交给 git 默认行为 |
| 镜像偶发 `invalid index-pack output` | 镜像抖动，不是配置错 | 重试即可 |
| 官方发布二进制下载 403 | 某些镜像对 Release 资产有策略拦截 | 换 npm 上的等价实现 |
| 同名包装错 | npm 上的同名包可能是**第三方**的同名项目 | 装之前核对作者和仓库地址 |

## 参考

- git 配置文档：`url.<base>.insteadOf`
- MCP（Model Context Protocol）的 transport 类型：`stdio` / `streamable-http`
- GitHub REST API 与 git 协议是两个独立入口，连通性可以不同

## 回顾记录

- **2026-09-14**: 首次整理。实测主站被墙而 API 通；用全局 `insteadOf` 让 git 走镜像
  （装插件必需，且全盘扫描确认零影响）；把 GitHub MCP 从远端 HTTP 换成本地 stdio，
  启动少等 20 秒；端到端验证可正常读取仓库文件。
