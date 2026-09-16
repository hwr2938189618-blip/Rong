# Rong

个人项目与学习笔记知识库。

> 记录学习轨迹，沉淀项目成果。

| 分区 | 内容 | 入口 |
|---|---|---|
| 📁 projects | 我的项目 | [projects/](projects/) |
| 📝 notes | 学习笔记与知识库 | [notes/](notes/) |
| 🛠️ skills | DSH 原生技能（AI 助手的能力沉淀） | [skills/](skills/) |

## 关于本仓库

这里存放三类东西：

1. **项目** —— 我做的代码项目，每个项目一个独立子目录，放在 `projects/` 下
2. **笔记** —— 学习过程中的记录、总结、踩坑心得，按主题分类放在 `notes/` 下
3. **技能** —— 交给 DSH 这个 AI 助手长期复用的工作流程（`SKILL.md`），按主题放在 `skills/` 下

目录结构：

```
Rong/
├─ README.md
├─ notes/                    学习笔记
│  ├─ README.md              分类导航 + 笔记索引，【新增笔记后必须更新】
│  ├─ _templates/
│  │  └─ note-template.md    笔记模板
│  ├─ toolbox/               通用工具与环境排错
│  ├─ windows/               Windows 系统操作
│  └─ dsh/                   DSH 机制与排错
├─ skills/                   DSH 原生技能镜像（索引 skills/README.md）
└─ projects/                 代码项目
```

> 技能的真源在本机 `$DSH_HOME/skills`，仓库这里是镜像与备份。

## 笔记规范

- 新笔记从 [notes/_templates/note-template.md](notes/_templates/note-template.md) 复制开始
- 命名：`<序号>-<主题>.md`，例如 `toolbox/06-xxx.md`
- 每篇笔记开头写清楚：日期、标签、状态(草稿/已整理)
- 新增笔记后**必须更新** [notes/README.md](notes/README.md) 的分类导航与索引
- 定期回顾：把"草稿"状态的笔记整理成"已整理"

## 技能规范

- 一个技能一个目录：`skills/<name>/SKILL.md`，frontmatter 必填 `name`（kebab-case）与 `description`
- `description` 写清**触发条件**，这是技能能被自动发现的关键
- 索引登记在 [skills/README.md](skills/README.md)
- 运行时真源在 DSH 的 `$DSH_HOME/skills`，仓库这里是镜像与备份

## 项目规范

- 每个项目独立目录，自带 `README.md` 说明用途和运行方式
- 项目索引登记在 [projects/README.md](projects/README.md)

## License

[MIT](LICENSE)
