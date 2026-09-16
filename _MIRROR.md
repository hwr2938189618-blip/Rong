# 这个目录是什么（本地镜像说明）

`E:\DSH\workspace\Rong` 是 `hwr2938189618-blip/Rong` 的**部分本地镜像**，不是完整克隆：

- ❌ **没有 `.git`** —— 不能 `git pull/push/status`
- ⚠️ **内容不保证齐全**：只包含 DSH 侧实际写过或显式拉取过的文件
- ✅ **权威来源永远是远端仓库**（`api.github.com` / GitHub 网页），不是这里

## 为什么不做成完整克隆

本机 `github.com` 主站不通（21 秒超时），只读可以走 gh-proxy 镜像，但"AI 直接改远端"的流程本来就走 MCP/REST。
做完整克隆要额外维护一套 git 工作流，收益为零。方案对比见 `notes/toolbox/07-多AI共写仓库防冲突方案.md`。

## 怎么正确验证"推送是否成功"

**不要用本目录的文件数/字节数去判断远端状态**（会被"镜像不全"误导）。正确顺序：

1. 用 `get_file_contents` 读远端目录，确认文件清单
2. 对关键文件比对 `size` 字段与本地字节数
3. 用 `list_commits` 确认 commit 存在、父提交是你预期的那个
4. 导航类文件（`notes/README.md`）额外核对：分类计数 == 该目录实际文件数

## 已知的镜像缺口（截至 2026-09-16）

| 路径 | 本地状态 | 远端 |
|---|---|---|
| `notes/toolbox/01-PATH环境变量.md` | ❌ 缺 | 5269 B |
| `notes/toolbox/02-GitHub主站不通的绕行.md` | ❌ 缺 | 6379 B |
| `notes/toolbox/03-WorkBuddy能力参照.md` | ⚠️ 旧版 8155 B | 8215 B |
| `notes/toolbox/04`、`05`、`06`、`07` | ✅ 一致 | — |
| `notes/windows/01-磁盘扫描与安全清理.md` | ✅ 一致 | — |
| `notes/README.md`、`README.md` | ✅ 一致 | — |

> 缺的文件是历史原因（早期直接推远端、没落本地），**不是内容丢失**；远端齐全。
> 需要某个文件时按需 `get_file_contents` 拉取即可。
