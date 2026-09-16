---
name: github-repo-push
description: "本机推送文件到 GitHub 仓库（含主人的笔记仓库 hwr2938189618-blip/Rong）的标准做法。当需要新建/修改/删除仓库文件、提交笔记、批量推多个文件、读仓库现状、开 PR 或查提交历史时使用。本机 gh CLI 从未登录且 github.com 主站不通，一律走 MCP/REST。"
whenToUse: "任何 GitHub 读写操作。开始前先读这份，别去试 gh auth login。"
---

# GitHub 仓库读写（本机唯一可行路径）

## 为什么不用 gh CLI

- `gh` 装了 v2.100.0 但**从未登录**，且所有 gh 命令都强制要求登录 → 登录要走 `github.com`，而**主站不通**（21 秒超时）。
- 结论：**一律用 `mcp__github__*` 工具**（走 `api.github.com`，实测可用）。

## 工具对应表

| 要做的事 | 用什么 |
|---|---|
| 看仓库某目录 | `get_file_contents(owner, repo, path)` |
| 读某个文件 | `get_file_contents(owner, repo, path)`，返回 base64 的 `content` |
| 建/改**单个**文件 | `create_or_update_file` —— **改已有文件必须传 `sha`**（先读一次拿 sha） |
| 一次推**多个**文件 | `push_files` —— 一次调用 = 一个 commit，别拆成多次提交 |
| 看提交历史 | `list_commits(owner, repo, sha='main')` |
| 开 PR | `create_pull_request`，或先 `create_branch` |
| 查 issue / 搜索 | `list_issues` / `search_code` / `search_repositories` |

## 推笔记的标准流程

```
1. 读导航与模板        get_file_contents('notes/README.md')、('notes/_templates/note-template.md')
2. 读现有同目录文件    确认命名序号（如 toolbox 已有 01/02 → 新的是 03）
3. 本地写文件          写到 E:\DSH\workspace\Rong\<同样路径>（保留镜像）
4. 更新导航            notes/README.md 分类计数 +1、索引加一行
5. 一次性提交          push_files（新文件 + 改动文件放同一个 commit）
6. 回读验证            get_file_contents 看目录、list_commits 看 commit、
                       比对本地与远端字节数是否一致
```

**提交信息用中文**：

```
笔记: 新增《标题》
笔记: 更新《标题》- 补充 XX
```

## 安全红线

- PAT 通过环境变量 **`GITHUB_PAT_TOKEN`** 提供，已配在 MCP 服务器里。
- ⛔ **绝不打印令牌、绝不写进任何文件、绝不提交进仓库**。
- 动别人的仓库前先确认分支与内容，别覆盖。

## 踩坑记录

| 问题 | 原因 | 解决 |
|---|---|---|
| 直接调 GitHub Git Data API 时旧文件被清空 | 建 tree 必须带 `base_tree` | 用 `push_files` / `create_or_update_file`，它们内部已带 base_tree |
| 更新文件报错 | `create_or_update_file` 改已有文件必须带该文件当前 `sha` | 先 `get_file_contents` 拿 `sha` |
| 一次推多文件变成多个 commit | 逐个调用 | 用 `push_files` 一次传全部 |
| 给主人贴 GitHub 网页链接打不开 | 主站被墙，只有 API 通 | 提醒**开 VPN**；推送/读取本身不需要 |
| 判断"推成功了没"只看返回 | 没验证 | 必做回读：commit 存在 + 原文件未丢 + 字节数一致 |

## 相关

- 笔记：`Rong/notes/toolbox/02-GitHub主站不通的绕行.md`
- 技能：`windows-shell-workarounds`（git 镜像与网络坑）
