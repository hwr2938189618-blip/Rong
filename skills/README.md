# DSH 技能（skills）

我在 DSH 上给自己写的原生技能。**运行时真源在 `E:\DSH\home\skills\`**（DSH 的 user-dsh 扫描根，rank 400），本目录是仓库镜像，便于备份与在多机之间搬。

## 机制（和别的 AI 不一样）

| | WorkBuddy | DSH（本目录） |
|---|---|---|
| 载体 | `SKILL.md` 目录 | **也是 `SKILL.md` 目录**，但扫描根不同 |
| 扫描根 | `~/.workbuddy/skills` 等 | `$DSH_HOME/skills`（用户级）、`<项目>/.dsh/skills`、`customSkillDirs` |
| 发现 | 描述命中 → 加载 | 同左，**只扫一层**，`<name>/SKILL.md` 或 `<name>.md` |
| 热加载 | — | ✅ chokidar 监视，新增/改名/删除**无需重启** |
| 插件 | 插件市场 | `dsh plugin add` + `cordis.patch.yml`（另一套机制） |

> ✅ **技能层两套机制其实很像**（都是 SKILL.md）；⚠️ **插件层完全不同**，别照搬。

## 清单（9 个）

| 技能 | 干什么 | 何时触发 |
|---|---|---|
| [windows-shell-workarounds](windows-shell-workarounds/SKILL.md) | 本机 shell/文件操作的环境坑与自救 | 命令 not found、路径错位、权限被拒、不确定某条环境结论是否适用 |
| [windows-disk-cleanup](windows-disk-cleanup/SKILL.md) | 磁盘扫描与安全清理（可逆优先） | 扫描/清理/找重复/判断残留 |
| [github-repo-push](github-repo-push/SKILL.md) | GitHub 读写（本机唯一可行路径） | 任何 GitHub 操作 |
| [homework-photo-explainer](homework-photo-explainer/SKILL.md) | 作业照片 → 孩子看得懂的讲解 | 收到作业/试卷照片要讲解 |
| [note-to-word-digest](note-to-word-digest/SKILL.md) | 中文笔记 → 可背诵 Word | 整理笔记/做背诵版/合并讲义 |
| [math-modeling](math-modeling/SKILL.md) | 数模竞赛全流程 | 建模、参赛、写数模论文 |
| [humanizer](humanizer/SKILL.md) | 去 AI 味 | 降 AI 味、润色、口语化 |
| [self-improving](self-improving/SKILL.md) | 自我改进协议（经验沉淀） | 出错/被纠正/完成可复用任务后 |
| [find-skills](find-skills/SKILL.md) | 技能发现与复用决策 | 先查有没有现成的 |

## 怎么写一个新技能

```yaml
---
name: kebab-case-名字        # 必填，必须 kebab-case
description: "写清触发条件"   # 必填，这是被发现的关键
whenToUse: "补充说明"        # 可选
---
```

正文写流程与判断标准；长资料放 `references/`，脚本放 `scripts/`（这两类不算 skill，是附件）。

⚠️ 写 `E:\DSH\home\skills` 在工作区之外，沙箱会拦 → 需要一次性提权。

## 来源

方法论借自同机另一个 AI 助手 **WorkBuddy** 的 9 个自建技能（完整移交包见 `../WorkBuddy-能力与知识移交包.md`），但**全部按 DSH 机制重写**，并核实了本机可用性：

- 修正了「本环境 deepseek 不支持读图」的过时结论（`deepseek-flash` 支持读图）
- 修正了 Python 路径版本号（3.13.12 → 实测 3.13.14）
- 修正了 skill 机制描述（技能层同样是 SKILL.md，不是「只能用插件」）
- 剔除了只属于 WorkBuddy shell 的坑（proxy / NODE_OPTIONS / stdout 不回传）
