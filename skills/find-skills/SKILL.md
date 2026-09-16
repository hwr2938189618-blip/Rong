---
name: find-skills
description: "技能发现与复用决策：想知道「这件事有没有现成技能」、要查本机已装的技能、要借鉴另一台 AI（WorkBuddy）的 85 个技能、或者判断该自己写新技能还是复用已有的。当主人说「有没有技能能做这个」「装个技能」「先查查」「别重复造轮子」时使用。"
whenToUse: "动手前先查有没有现成方案；或决定要不要新建 skill 时。"
---

# 技能发现与复用决策

## 决策顺序（从便宜到贵）

```
1. 先看本会话已有技能目录  ← 免费，已注入上下文
2. 查 DSH 磁盘上的技能根    ← 看有没有没被加载的
3. 查本机其他 AI 的技能     ← WorkBuddy 的 85 个（方法论可借）
4. 都没有 → 才自己写新技能
```

> 大部分情况第 1 步就够了：**技能目录每次会话都会注入**，别重复造。

## 1. 本会话技能

已经在系统提示/会话上下文里的 `available_skills` 列表。要读全文就调 `skill` 工具。

## 2. DSH 磁盘上的技能根目录

| Rank | 来源 | 路径 |
|---|---|---|
| 100 | project-dsh | `<项目根>/.dsh/skills` |
| 200 | project-agents | `<项目根>/.agents/skills` |
| 300 | custom | 配置项 `customSkillDirs` |
| 400 | **user-dsh** | `E:\DSH\home\skills` ← 主人自己的技能放这儿 |
| 500 | user-agents | `<agentsHome>/skills` |
| 600 | bundled | 插件自带（如 modsearch 的技能） |

```powershell
# 列已装的用户级技能
Get-ChildItem 'E:\DSH\home\skills' -Directory -ErrorAction SilentlyContinue | Select-Object -Expand Name

# 全局找 SKILL.md（插件自带的也在里面）
Get-ChildItem 'E:\DSH\home' -Recurse -Filter 'SKILL.md' -ErrorAction SilentlyContinue |
  Select-Object -Expand FullName
```

**格式要求（写错了会被静默跳过）**：
- 可以是目录 bundle `<name>/SKILL.md`，或平铺文件 `<name>.md`
- **只扫一层，不递归** → 不支持嵌套的 `**/SKILL.md`
- frontmatter 必填 `name`（**kebab-case**）与 `description`
- 可选 `whenToUse`、`metadata`、`user-invocable`、`disable-model-invocation`
- 新增/改名/删除**无需重启**（chokidar 热加载，下一个模型步骤就可见）
- `references/` `scripts/` `assets/` 等资源**不算 skill**，放 bundle 里当附件用

## 3. 本机其他 AI 的技能（可借方法论）

**WorkBuddy：85 个技能**，位置：

```
C:\Users\29381\.workbuddy\skills\                     用户级 30 个（含自建 9 个）
C:\Users\29381\.workbuddy\plugins\cache\workbuddy-builtin\     内置 35
C:\Users\29381\.workbuddy\plugins\cache\cb_teams_marketplace\  市场 10
C:\Users\29381\.workbuddy\plugins\cache\codebuddy-plugins-official\ 官方 3
C:\Users\29381\.workbuddy\plugins\cache\experts\      专家包 7
```

- 完整清单与能力映射：`E:\DSH\workspace\WorkBuddy-能力与知识移交包.md`（935 行）
- 速查摘要：笔记 `Rong/notes/toolbox/03-WorkBuddy能力参照.md`
- 用法：直接读它的 `SKILL.md` 借流程，**不要照搬安装方式**（它用 SKILL.md 目录，DSH 用插件 + cordis.patch.yml）

⚠️ 它的技能路径里带 `__skillhub` 后缀的常是过时元数据，**先 `Test-Path` 再引用**。

## 4. 自己写新技能

判断标准：**这件流程会重复出现吗？**

- 会 → 写 `E:\DSH\home\skills\<kebab-name>\SKILL.md`
- 不会 → 记进记忆库就够，别堆技能

写新技能时：
1. `name` kebab-case，与目录名一致
2. `description` 写清**触发条件**（什么时候该用它），这是被发现的关键
3. 正文只写流程与判断标准，长资料放 `references/`
4. 写完验证：目录列表里出现它了吗（会话会推送技能目录变更）

> ⚠️ 写入 `E:\DSH\home\skills` 在工作区之外，沙箱会拦 → 需要一次性提权。

## 踩坑记录

| 问题 | 原因 | 解决 |
|---|---|---|
| 新技能没出现 | frontmatter 缺 `name`/`description`，或 name 不是 kebab-case | 修正后保存，热加载会重新发现 |
| 技能里放个 `foo/bar/SKILL.md` 找不到 | 只扫一层 | 放到 `<root>/bar/SKILL.md` |
| 照抄别的 AI 的安装命令失败 | 两套机制不同 | 只借方法论，用 `dsh plugin add` 装插件 |
| 重复造轮子 | 没先看会话技能目录 | 先看 `available_skills` |

## 相关

- 技能：`self-improving`（沉淀经验）、`github-repo-push`（把技能同步到仓库）
