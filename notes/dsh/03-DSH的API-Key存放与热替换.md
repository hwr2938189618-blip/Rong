# DSH API Key 存在哪、怎么换

> **日期**: 2026-11-25
> **标签**: #dsh #凭据 #apikey #热加载
> **状态**: 🟢 已整理

## 我要解决什么问题

桌面来了一个新的 DeepSeek key（旧的那个只剩 5 块多），要把它换进正在跑的 DSH 里。由此搞清楚三件事：

1. DSH 到底从哪儿读 API key？（环境变量？配置文件？加密库？）
2. 怎么换才不破坏正在运行的会话（能不能不重启）？
3. 换完怎么确认生效？

## 核心概念

### 一、`settings.yaml` 里只有"名字"，没有 key

`E:\DSH\home\settings.yaml`：

```yaml
llm-deepseek:
  apiKeyEnv: DEEPSEEK_API_KEY      # 只是凭据的「引用名」
  baseURL: https://api.deepseek.com
```

真正的值在凭据存储里。这套解耦设计的好处：配置文件可以随便备份、贴给别人看，不会漏 key。

### 二、凭据存储是 `.credentials.yaml`，而且是**明文**

`E:\DSH\home\.credentials.yaml`：

```yaml
version: 1
refs:
  DEEPSEEK_API_KEY: sk-xxxxxxxx        # ← 就是明文值，不是引用指针
records:
  client-connection/browser-session:
    kind: grant
    payload:
      version: 1
      secret: ...
```

两个容易看错的点：

- `refs` 下的值**不是** record 的 id，就是密钥本身（长度和 key 一样，35 字符）
- `records` 是另一类东西（这里存的是浏览器会话的 grant），和 API key 无关，别乱改

### 三、取值优先级（读源码确认，插件在 `@deepseek-ai/dsh-credentials-local`）

```text
1. 继承的进程环境变量        （source: env，此时 UI 里显示不可写）
2. 凭据存储 refs            （source: file）
3. .env 兜底（项目级 > 用户级）
```

关键：**环境变量优先级高于文件**。如果系统里设过 `DEEPSEEK_API_KEY`，改文件是无效的——本次实测 `$env:DEEPSEEK_API_KEY` 为空，所以文件说了算。

### 四、改文件可以热生效，不用重启

插件启动时对凭据文件挂了 chokidar 监听（`watch: true`，默认开），带 `awaitWriteFinish` 防抖；chokidar 默认 `atomic: true` 会同时盯父目录，所以"临时文件 + `os.replace`"这种原子替换也能被识别成一次变更。reload 成功后整体替换内存里的快照，下一次模型调用就用新值。

## 示例代码

换 key（只在运行时读桌面文件，全程不打印密钥）：

```python
import os, pathlib, re, tempfile

KEY_FILE = pathlib.Path(r"C:\Users\29381\Desktop\key.txt")
CRED = pathlib.Path(r"E:\DSH\home\.credentials.yaml")

raw = KEY_FILE.read_text(encoding="utf-8").strip()   # 形如 "deepseek apikey:sk-xxxx"
new_key = raw.split(":", 1)[1].strip()

text = CRED.read_text(encoding="utf-8")
pattern = re.compile(r"(?m)^(\s*)DEEPSEEK_API_KEY:\s*(\S+)\s*$")
text_new = pattern.sub(lambda m: f"{m.group(1)}DEEPSEEK_API_KEY: {new_key}", text, count=1)

fd, tmp = tempfile.mkstemp(dir=str(CRED.parent), prefix=".credentials.", suffix=".tmp")
with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
    f.write(text_new)
os.replace(tmp, CRED)          # 原子替换 → 触发 watcher

assert pattern.search(CRED.read_text(encoding="utf-8")).group(2) == new_key   # 回读校验
```

先验证 key 再动配置（两个接口就够）：

```python
h = {"Authorization": f"Bearer {key}"}
requests.get("https://api.deepseek.com/user/balance", headers=h)     # 200 + is_available + 余额
requests.post("https://api.deepseek.com/chat/completions", headers=h,
              json={"model": "deepseek-chat", "max_tokens": 16,
                    "messages": [{"role": "user", "content": "只回复两个字：可用"}]})
```

本次结果：新 key `available=True`、CNY 425.51、chat 200；旧 key 余额只剩 5.16 —— 新旧对比确认换对了。

## 踩坑记录

| 问题 | 原因 | 解决 |
|---|---|---|
| `python 脚本.py` 跑了两分钟没输出、超时被杀 | 不是脚本 hang，是写 `E:\DSH\home`（工作区外）被文件沙箱拒绝，进程卡在写入上 | 用 `Set-Content` 单测确认「访问被拒绝」，再对同一个写操作提权重试一次即可；别以为是脚本 bug |
| 差点把 `refs.DEEPSEEK_API_KEY` 的值当成记录 id | 凭据文件里 refs 和 records 两套结构长得像 | 看长度：值长度 == key 长度就是明文；records 的键才是 `<scope>/<id>` 形式 |
| PowerShell 里想 "打印结构但掩码值"，正则写错直接 ParserError | 单引号+双引号混合、括号没配对 | 改成逐行处理 + 用 `[regex]::Matches` 单独取长串，别在一行里堆嵌套管道 |
| 想确认"热加载真的生效"却找不到日志 | reload 成功不写日志，只有失败才 `logger.warn/error` | 看源码确认 watcher 机制 + 文件回读校验 + 跑一次真实模型调用验证 provider 健康；要 100% 确定可重启 DSH 重读文件 |

## 安全纪律

- 凭据文件是**明文**：不进仓库、不进笔记、不打印、不贴聊天
- 换 key 前先拍 DSH 快照（`undo_snapshot`），快照里含 `.credentials.yaml`，改坏能整份回滚
- 桌面上的明文 `key.txt` 用完建议挪进用户环境变量或删掉

## 参考链接

- 插件源码：`D:\DSH-Desktop\resources\app\node_modules\@deepseek-ai\dsh-credentials-local\lib\index.js`（`resolve` / `describe` / `Service.init` 里的 watcher）
- DeepSeek 余额接口：`GET https://api.deepseek.com/user/balance`

## 回顾记录

- **2026-11-25**: 首次整理。桌面新 key 验证可用（425.51 CNY）→ 原子替换 `.credentials.yaml` 的 `refs.DEEPSEEK_API_KEY` → 回读校验通过 → 子代理真实调用验证 provider 正常。
