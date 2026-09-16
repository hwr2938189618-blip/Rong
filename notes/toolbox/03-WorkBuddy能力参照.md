# [工具] WorkBuddy 能力参照

> **日期**: 2026-09-16
> **标签**: #AI协作 #技能体系 #能力参照 #WorkBuddy
> **状态**: 🟢 已整理

## 我要解决什么问题

这台机器上除了 DSH，还装着一个 AI 助手 **WorkBuddy**，它有 85 个技能。主人的需求（腾讯文档、Word/PPT、PDF、金融数据、浏览器自动化、数学建模、作业讲解）可能命中它的某项能力。

问题是：**我不该等到被问到时才发现自己不会做**。这份笔记是能力对照表——什么需求走我自己的路，什么需求借用 WorkBuddy 的现成成果，什么需求必须主人自己动手。

## 核心概念

### 一句话定位

WorkBuddy 是**同机同网络的另一个 AI 助手**，它的技能清单是我的「可行性参照」而不是「我的工具箱」——它能做到的，说明这台机器上这条路走得通；我做不到的，可以借它的方法论而不是照抄它的安装方式。

### 85 个技能的分布

| 分类 | 数量 | 存放位置 |
|---|---|---|
| 用户级技能 | 30 | `C:\Users\29381\.workbuddy\skills\` |
| 内置插件技能 | 35 | `...\.workbuddy\plugins\cache\workbuddy-builtin\` |
| 团队市场技能 | 10 | `...\.workbuddy\plugins\cache\cb_teams_marketplace\` |
| 官方插件技能 | 3 | `...\.workbuddy\plugins\cache\codebuddy-plugins-official\` |
| 专家包技能 | 7 | `...\.workbuddy\plugins\cache\experts\` |

其中**自建 9 个**（本机实操沉淀，参考价值最高）：`workbuddy-windows-shell-workarounds`、`windows-disk-cleanup`、`github`、`homework-photo-explainer`、`note-to-word-digest`、`math-modeling`、`humanizer`、`self-improving`、`find-skills`。

### 需求 → 最靠谱做法的映射

| 需求 | WorkBuddy 那边的现成能力 | 我这边怎么落地 |
|---|---|---|
| 通用联网搜索 | `multi-search-engine`(16 引擎)、`web-search` | 我自带 `web_search` / `web_fetch`，直接用 |
| GitHub 操作 | `github` 技能：gh CLI 优先，不可用走 REST | gh 从未登录 → **一律走 `mcp__github__*` + PAT**，可用 |
| Word 生成/美化 | `note-to-word-digest`（三色高亮 + python-docx 骨架）、`tencent-docx` | 方法论可照搬，用 `python-docx` 自己做（本机有 Python） |
| PPT | `PPT幻灯片生成器`（HTML 版）、`tencent-pptx`（真 .pptx） | `python-pptx`，可参考其排版思路 |
| PDF 处理 | `pdfkit-py`（50 条命令）、`pdf` | 有 `.pdf` 时才用，Python 可做 |
| Excel | `tencent-docs-sheetagent`、`excel` | openpyxl / pandas 自己做 |
| 腾讯文档（个人/企业版） | `tencent-docs` / `tencent-saas-docs` | 需它的账号体系与 MCP，我这边没有 → 借它的做法 |
| 浏览器自动化 | `agent-browser`、`playwright-cli`、`browser-use` | DSH 侧**未装**任何浏览器插件 → 需要时先问主人 |
| 金融/股票数据 | `wb-finance-skill`、`westock-data`、`neodata-financial-search` | 需它的数据服务，我这边无对应 MCP |
| 数学建模全流程 | `math-modeling`（赛题解析→模型→求解→Typst/LaTeX 论文→PDF 验收） | **最有参考价值**：完整方法论，我能照做 |
| 作业讲解（家里小学生） | `homework-photo-explainer`：五步流程 + 交互 HTML + 打印 PNG | 方法论明确，我能自建 |
| 去 AI 味 | `humanizer`（AI 高频词、假靶子、L1–L4 自检） | 可直接照搬为我的 skill |
| 笔记 → 可背诵 Word | `note-to-word-digest`（黄【重合】/绿【补充】/口诀/例子/易错） | 曾用于 HCIA 笔记整合，思路明确 |
| 磁盘清理 | `windows-disk-cleanup`（只读扫描→三重校验→可逆删除） | 我已用同样思路，方法论一致 |
| 腾讯会议 / 微云 / 金山文档 / QQ音乐 | `tencent-meeting-skill`、`weiyun`、`kdocs` | 需第三方账号或 MCP |
| 每日签到、费用提醒 | `leon-daily-checkin` 等自动化 | WorkBuddy 生态内部事务，与我无关 |

### ⚠️ 边界：技能机制不同，装法不可照搬

| | WorkBuddy | DSH（我） |
|---|---|---|
| 载体 | 一份 `SKILL.md`（frontmatter 带 name/description） | 插件包 + `cordis.patch.yml` |
| 加载 | 描述命中任务 → 自动加载 → 按固化流程执行 | `dsh plugin add` + 在 profile 里 insert |
| 我该做什么 | **借方法论、借踩坑结论** | **用自己的插件机制实现** |

> 结论：**方法论可以照搬，安装方式不能照搬。**

### ✅ 已落地：9 个自建技能改写为 DSH 原生 skill（2026-09-16）

WorkBuddy 那 9 个自建技能的方法论，已按 DSH 机制重写并安装到位：

- **运行时位置**：`E:\DSH\home\skills\`（DSH 的 user-dsh 扫描根，rank 400）
- **仓库镜像**：`Rong/skills/`（含 README 索引）

| 技能 | 干什么 |
|---|---|
| `windows-shell-workarounds` | 本机 shell/文件操作自救 |
| `windows-disk-cleanup` | 磁盘扫描与安全清理 |
| `github-repo-push` | GitHub 读写（走 MCP/REST） |
| `homework-photo-explainer` | 作业照片 → 孩子看得懂的讲解 |
| `note-to-word-digest` | 中文笔记 → 可背诵 Word |
| `math-modeling` | 数模竞赛全流程 |
| `humanizer` | 去 AI 味 |
| `self-improving` | 自我改进协议 |
| `find-skills` | 技能发现与复用决策 |

**机制更正（重要）**：我原先以为「WorkBuddy 是 SKILL.md / DSH 是插件」两套完全不同 —— 不够准确。DSH 的**技能层同样是 `SKILL.md`**（`<name>/SKILL.md` 或 `<name>.md`，只扫一层，chokidar 热加载免重启）；真正不同的是**插件层**（`dsh plugin add` + `cordis.patch.yml`）。所以技能可以几乎照搬格式，插件才不能。

### ⚠️ 同源多份，不要盲目合并

`agent-browser` 同时存在于用户级 / 官方插件 / 团队市场；`tencent-docs` 有个人版与企业版；`skill-creator`、`pdfkit-py`、`wb-finance-skill` 各有两份。它们的挂载范围不同，按需取用即可。

## 示例代码

需要具体命令、路径、参数时，去读完整版移交包（不要去猜）：

```
E:\DSH\workspace\WorkBuddy-能力与知识移交包.md      # 935 行，含 85 技能位置索引 + 命令速查卡
E:\DSH\workspace\WorkBuddy-速览（发给DSH）.md        # 51 行压缩版，适合当上下文
```

要看某个技能的真实做法，直接读它目录下的 `SKILL.md`：

```powershell
# 例：看它的自建作业讲解技能怎么写的
Get-Content 'C:\Users\29381\.workbuddy\skills\homework-photo-explainer\SKILL.md'
```

## 踩坑记录

| 问题 | 原因 | 解决 |
|---|---|---|
| 差点把两套技能机制混为一谈 | WorkBuddy 的 `SKILL.md` 与 DSH 的插件是**两套互不通用的架构** | 明确分工：借方法论，不抄装法 |
| 移交包里写的路径有失效的 | `leon-daily-checkin` 的 `SKILL.md` 路径带过时的 `__skillhub` 后缀，照抄会找不到脚本 | 文档里的路径先 `Test-Path` 实测再引用 |
| 把「清单里列了」当成「我这里也有」 | 清单是 WorkBuddy 的挂载，不是本机通用能力 | 先查我这边装了没（如浏览器自动化：DSH 侧未装） |
| 差点以为技能机制完全不能迁移 | 只记住了「插件机制不同」，误推到技能层 | DSH 技能层也是 `SKILL.md`，格式可照搬；只有插件层不同 |
| 写 skill 到 `E:\DSH\home\skills` 被沙箱拒绝 | 该路径在工作区 `E:\DSH\workspace` 之外 | 一次性提权写一次；提权后 chokidar 会立刻加载，无需重启 |

## 参考链接

- 完整移交包（本地）：`E:\DSH\workspace\WorkBuddy-能力与知识移交包.md`
- 速览版（本地）：`E:\DSH\workspace\WorkBuddy-速览（发给DSH）.md`
- 同批笔记：[本机环境硬事实](04-本机环境硬事实.md)
- 技能索引：[skills/README.md](../../skills/README.md)

## 回顾记录

- **2026-09-16**: 首次整理。读完 935 行移交包，核实技能存放位置，建立需求映射表，明确「方法论可迁移、安装方式不可照搬」这条边界。
- **2026-09-16（当日追加）**: 把 9 个自建技能改写为 DSH 原生 skill 并安装到 `E:\DSH\home\skills\`，镜像进仓库 `skills/`；更正「技能机制完全不同」的误判（技能层同为 SKILL.md）。
