---
name: windows-disk-cleanup
description: "Windows 磁盘扫描与安全清理工作流。当主人要求扫描电脑、清理磁盘、整理文件、找重复文件、释放空间、判断某批文件是不是卸载残留时使用。核心理念：判断准确比删得狠重要，可逆优先、扫描与执行分离。"
whenToUse: "任何涉及删除/移动大量文件、找重复、判断残留归属的请求，先按本技能走，不要直接删。"
---

# 磁盘扫描与安全清理

## 铁律（违反任何一条都可能造成不可逆损失）

1. **扫描与执行分离**：扫描阶段只读，产出清单；确认后才执行。
2. **可逆优先**：所有"删除"先移到归档区（如 `E:\清理归档_YYYYMMDD\`），**永不直接删**。
3. **C 盘只读**：本机硬约束。C 盘待清理项**只出清单不动手**。
4. **小步分批**：一次一批，每批做完复查，别一把梭。
5. **删前必比对实际字节数**：带 `(1)(2)` 后缀的**未必**是重复，可能反而是唯一完整那份。

## 四步流程

### 第一步：只读扫描

```powershell
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
  Select-Object DeviceID,
    @{n='总GB';e={[math]::Round($_.Size/1GB,1)}},
    @{n='剩余GB';e={[math]::Round($_.FreeSpace/1GB,1)}}
```

### 第二步：判定归属（关键，别跳过）

**疑似残留先反查注册表 Uninstall 键**——若有对应安装项，那是**程序本体，绝不能动**：

```powershell
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
  Where-Object DisplayName | Select-Object DisplayName, InstallLocation, DisplayIcon, UninstallString |
  Where-Object { $_.InstallLocation -like '*<可疑目录>*' -or $_.DisplayIcon -like '*<可疑目录>*' }
```

> **真实教训**：曾把 `D:\` 根目录下的 QQ 安装文件（51 个 `api-ms-win-*.dll`）误判为残留删掉，实际用户把 QQ 装在 D 盘根目录。靠回收站才还原回来。

**残留归属三法**（互相印证）：
1. **时间戳聚类** —— 同批操作同分钟/同日
2. **关联目录是否存在** —— 引用的目录不存在 = 卸载残留
3. **文件内容辨认** —— 乱码文本里能认出课程笔记等

### 第三步：重复文件三重校验

判定"可安全删除"必须**三条全中**（逐层加强）：

```python
import hashlib, os

def head_md5(path, n=512 * 1024):
    size = os.path.getsize(path)
    with open(path, 'rb') as f:
        buf = f.read(min(n, size))
    return hashlib.md5(buf).hexdigest()

def same_file(a, b):
    return os.path.getsize(a) == os.path.getsize(b) and head_md5(a) == head_md5(b)
```

- 名字相同 + `Length` 相同 + 前 512KB MD5 相同 ← **决定性证据**
- ⚠️ **大压缩包"看起来像重复"≠ 重复**：曾有 89MB 的 zip 被判重复，逐项哈希后只有 2.16MB 与他人重复，其余 87MB 独有 → 保留。

### 第四步：安全执行

```powershell
# 执行前：占用检测
try { [System.IO.File]::Open($p,'Open','ReadWrite','None') | ForEach-Object { $_.Close() }; "可操作" }
catch { "被占用 → 先关占用它的程序（如抖音缓存 ~$cache1 退出抖音自动消失），不必强删" }

# 可逆删除（进回收站）
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p,'OnlyErrorDialogs','SendToRecycleBin')
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p,'OnlyErrorDialogs','SendToRecycleBin')
```

⚠️ **执行后必须复查实际状态**：PowerShell 工具报的"取消"未必等于操作未执行（曾以为被拒，实则已删 7 个子目录）。报 exit code 1 也可能是"文件已删但脚本末尾报错"，先复查再决定要不要重跑。

## 高危陷阱

| 陷阱 | 后果 | 正确做法 |
|---|---|---|
| `Remove-Item -Recurse` 作用于 Junction | **递归删掉目标目录内容** | `[System.IO.Directory]::Delete($p,$false)` |
| Python `os.walk` 跟随重解析点 | 重复统计，把 30GB 误报成冗余 | 扫描脚本必须跳过 reparse point |
| 只看文件名判重复 | 删掉唯一完整副本 | 三重校验，比字节数 |
| 把程序本体当残留 | 软件被破坏 | 先反查注册表 Uninstall 键 |
| 按已知名猜服务 | 漏掉大部分恶意服务 | `Get-CimInstance Win32_Service` 全量枚举 |

## 长会话分段：扫描交接清单

新会话没有历史，规则全靠文件传递。写清单时用这个结构（绝对路径与判定依据必填）：

```
0 执行约定（只读/可执行、红线）
1 概况（容量、扫描范围）
2 待执行项（A 可直接删 / B 需确认 / C 需主人决定，三态标注）
3 已排除项 + 排除理由
4 高危陷阱（本批特有）
5 需更新的文件
```

## 相关

- 技能：`windows-shell-workarounds`（shell 层自救）
- 笔记：`Rong/notes/windows/01-磁盘扫描与安全清理.md`
