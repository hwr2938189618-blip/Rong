# [toolbox] ZCode 接入个人知识库：把四个 AI 的笔记收成一条流水线

> **日期**: 2026-11-06
> **标签**: #zcode #知识库 #自动化 #github #技能
> **状态**: 🟢 已整理

## 我要解决什么问题

本机已经有 DSH、WorkBuddy 两个 AI 在往这个仓库写笔记，新装的 **ZCode**（智谱的编码智能体桌面端）
是个白板：插件没开、没有我的偏好、不知道笔记规矩、也读不到既往笔记。

三个具体诉求：

1. **按日常需求配好插件与技能** —— 不是把市场里的全开，只开真用得上的
2. **把使用习惯和既往知识喂给它** —— 让它一次会话就懂我是谁、机器什么状况、笔记怎么记
3. **接上仓库并能自学习** —— 能读旧笔记（召回），能写新笔记（沉淀），形成闭环

## 核心概念

### ZCode 的扩展资源有五个入口，位置各不相同

| 资源 | 用户级位置 | 作用 |
|---|---|---|
| 指令 | `~/.zcode/AGENTS.md` | 每次会话都加载的行为准则 |
| 技能 | `~/.zcode/skills/<name>/SKILL.md` | 描述命中后加载的流程包 |
| 命令 | `~/.zcode/commands/<name>.md` | `/note`、`/recall` 这类斜杠命令 |
| 插件开关 | `~/.zcode/cli/config.json` → `plugins.enabledPlugins` | 开/关市场插件 |
| MCP / hooks | 同一个 `config.json` → `mcp.servers` / `hooks` | 外部工具与事件钩子 |

优先级：用户级 > 工作区级 > 插件自带。同名技能「先扫到的赢」，不是合并。

### 闭环靠三件事拼起来，缺一不可

```
回答前  → rong-recall  （先查笔记，别重新踩坑）
学到后  → rong-notes   （写笔记 + 更新导航 + REST 提交 + 回读验证）
收尾时  → zcode-selflearn（判断载体：记忆 / 技能 / 笔记 / 指令）
```

第三条是「自学习」的关键：它不是「模型自己变聪明」，而是**把这次的经验塞进一个下次会被读到的位置**。
载体选错的沉淀等于没沉淀——单条事实写进笔记是浪费，成套流程写进记忆是浪费。

### 为什么知识库要落到本地 git 镜像

只靠 REST 读远端，每次回答都要等网络、还受匿名限流；而 `github.com` 主站直连不通，
`gh` CLI 又从未登录。落到 `E:\ZCODE\workspace\Rong` 后，检索是本地 grep（毫秒级），
刷新只需 `git pull --ff-only`（gh-proxy 重写已配好，实测可用）。

## 示例代码

三个技能的核心是一条命令：

```bash
# 召回：先刷新镜像，再本地检索
git -C "E:/ZCODE/workspace/Rong" pull --ff-only
rg -n -i "关键词1|关键词2" "E:/ZCODE/workspace/Rong/notes" -g "*.md"

# 沉淀：一次 commit 带多文件，走 Git Data API 六步
python "C:/Users/29381/.zcode/skills/rong-notes/scripts/push.py" \
  --base "E:/ZCODE/workspace/Rong" \
  --message "笔记: 新增《标题》" \
  --file notes/README.md \
  --file "notes/toolbox/11-标题.md"
```

`push.py` 自动完成「取 head → 取 base_tree → 建 blob → 建 tree → 建 commit → 移 ref」，
然后回读验证三件事：commit 在、字节数一致、根目录原有文件没丢。

## 踩坑记录

| 问题 | 原因 | 解决 |
|---|---|---|
| 不知道 ZCode 的技能该放哪 | 桌面端是 Electron 套壳，文档里没有路径说明 | 从 `resources/glm/zcode.cjs` 里捞字符串，找到 `.zcode/AGENTS.md`、`skills`、`plugins` 等路径常量；插件市场地址是 `cdn-zcode.z.ai` |
| 以为插件装了就生效 | 市场缓存里有 16 个插件目录，但 `config.json` 只开了 1 个 | 缓存 ≠ 启用。启用状态只认 `plugins.enabledPlugins`，**改完要重启客户端**（会话启动时才读） |
| 技能 frontmatter 写成 `whenToUse` 不生效 | ZCode 只认下划线 `when_to_use`（DSH 用驼峰，WorkBuddy 用 `agent_created`） | 各家字段不通用，照各家机制重写，别照抄 |
| 技能描述写长了被丢弃 | `description` 超 1024 字符整条技能不加载，展示时只取前 ~250 字 | 触发词写在最前面，细节挪到正文 |
| 想用 `git push` 推笔记 | gh-proxy 下 push 不可靠（历史实测） | 读用 `git pull`，写一律走 REST API 六步 |
| `E:\DSH\workspace\Rong` 看着像仓库 | 那是文件副本，没有 `.git` | 真镜像另建在 `E:\ZCODE\workspace\Rong`，克隆时走代理一次成功 |
| token 读取失败 | 文件存成 UTF-8 with BOM | 一律 `encoding='utf-8-sig'` |
| `image-search` 插件连接失败 | MCP 返回 `coding plan is required`；当前是 `zai-start-plan`（会员套餐），不是 coding plan | 该插件对当前套餐无效，关掉或忽略；找图改用 `visualize` / 普通搜索 |
| `/recall` 只报了知识库现状 | 命令里的关键词为空（只打了 `/recall` 没带参数） | 正常行为。要召回具体内容得带词，如 `/recall powercfg`、`/recall 代理` |
| 以为仓库的 `AGENTS.md` 会自动生效 | ZCode 默认工作区是 `~/.zcode/workspace/default`（非 git 仓库） | 工作区级指令只在工作区根命中；换工作区到 `E:\ZCODE\workspace\Rong`，或靠用户级 AGENTS.md + 技能里的绝对路径兜底 |

## 参考链接

- 官方市场清单：`https://cdn-zcode.z.ai/zcode/official-plugin/marketplace.json`
- 配置指南（自带插件 `zcode-guide` 的 `zcode-configuration-guide` 技能）
- 本仓库：[本机环境硬事实](04-本机环境硬事实.md)、[新知识自动入库与跨环境通道](06-新知识自动入库与跨环境通道.md)

## 回顾记录

- **2026-11-06**: 首次接入。启用 13 个插件、写 3 个技能 + 2 个命令 + 用户级 `AGENTS.md`、建本地镜像。
- **2026-11-06 12:39**: 重启后实测通过。启动日志：`enabledPluginCount=13`、`skillRootCount=11`、
  `commandRootCount=1`、`diagnosticCount=0`；`/recall` 正确读到本地镜像（`git pull` → Already up to date，
  汇总 16 篇笔记 + 3 篇每日总结 + 9 个技能镜像）。唯一失败项是 `image-search` 的 MCP（套餐不含 coding plan）。
