---
name: note-to-word-digest
description: "把中文学习/培训笔记（PDF、Word、扫描讲义、多份讲义）加工成结构化、可背诵的 Word 文档——对照合并、重点标注、纠错、浓缩、加口诀与例子。当主人要求「整理笔记」「做背诵版」「合并两份讲义」「把 PDF 笔记做成 Word」「帮我标重点/浓缩」时使用。"
whenToUse: "中文笔记类资料 → 可背诵 Word。也用于合并同源多份讲义并标出差异。"
---

# 笔记 → 可背诵 Word

## 核心信条

**信息密度与组织度才是"好背"的关键，不拿纯字数当浓缩指标。**

- 浓缩版字数**不降反升**是正常的（原例：上升 104%）——因为加了口诀、例子、易错提醒
- 目标是"看一眼就想起一片"，不是"字数变少"

## 三色高亮体系（固定约定）

| 颜色 | 含义 | python-docx 值 |
|---|---|---|
| 黄 | 两份讲义**重合**的内容（核心） | `WD_COLOR_INDEX.YELLOW` |
| 绿（【补充】） | 另一份**独有**的内容 | `WD_COLOR_INDEX.BRIGHT_GREEN` |
| 青 | **例子** | `WD_COLOR_INDEX.TURQUOISE` |
| 粉 | **易错** | `WD_COLOR_INDEX.PINK` |

```python
from docx import Document
from docx.enum.text import WD_COLOR_INDEX

doc = Document()
p = doc.add_paragraph()
run = p.add_run('这一句是两份讲义都有的核心')
run.font.highlight_color = WD_COLOR_INDEX.YELLOW

run2 = p.add_run('　【补充】只有 docx 才有的内容')
run2.font.highlight_color = WD_COLOR_INDEX.BRIGHT_GREEN

doc.save('背诵版.docx')   # 中文文件名没问题，内容用 UTF-8
```

## 流程（顺序不能乱）

### 第 0 步：先探测依赖（否则后面全白跑）

```powershell
# 本机 Python（注意：目录名 3.13.12，实际版本 3.13.14；且没有 numpy）
$exe = 'C:\Users\29381\.workbuddy\binaries\python\versions\3.13.12\python.exe'
& $exe -c "import docx; print('docx OK')"
& $exe -c "import openpyxl; print('openpyxl OK')"
```

- **缺依赖时不要试图生成 Word**，直接把下面的安装命令交给主人执行（不要自行 pip install 改环境）：

```
C:\Users\29381\.workbuddy\binaries\python\versions\3.13.12\python.exe -m pip install python-docx openpyxl python-pptx
```

- 已知缺口（2026-09-16 实测）：本机 Python 原本只有 `pillow` + `pywin32`，**python-docx / openpyxl / python-pptx 当时未装**（现已补上）

### 然后是主流程

```
1. 先抽全部原料 —— 别凭印象！把源文件所有文字抽出来落盘，再开始
2. 抽内嵌插图     —— 讲义里的图常是关键，不能丢
3. 对照合并       —— 逐段比对，定黄/绿
4. 生成 Word      —— python-docx，标题层级 + 表格 + 三色
5. 浓缩背诵版     —— 加口诀（黄底）/ 例子（青底）/ 易错（粉底）
```

### 抽内嵌图（docx）

```python
import zipfile, re

with zipfile.ZipFile('src.docx') as z:
    rels = z.read('word/_rels/document.xml.rels').decode('utf-8')
    # rId → media 文件映射
    id2media = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(media/[^"]+)"', rels))
    doc_xml = z.read('word/document.xml').decode('utf-8')
    # 定位：遍历 <w:p>，找 <a:blip r:embed="rId...">
    # 经验做法：图所在的段落通常"上一段有文字"，用这个条件锚定插图位置
```

## 内容纠错（原文有错就直接改）

- TCP/UDP 的区别是**可靠 / 不可靠传输**（不是"纠错"）
- 以太网帧 Data 字段：最大 **1500**、最小 **46**
- OSPF RID：先取**最大的 Loopback IP**

> 纠错要在笔记里留痕（说明改了哪里），否则下次会再错一遍。

## 文档工程纪律（血泪教训）

| 坑 | 说明 | 规矩 |
|---|---|---|
| 同一条消息里多次 Edit 同一文件 | 基于同一快照互相覆盖，丢更新 | **必须串行**，一次一处 |
| 表格语法多打 `]` | Markdown 表格易错 | 写完先 `python -c` 编译/解析一次 |
| 凭印象写内容 | 漏掉源文件里的东西 | 先抽全部原料落盘 |
| 用 Write 整篇重写脚本 | 覆盖掉未读的内容 | 写之前必须先 Read |

## 视觉与交付

- 中文正文字体显式设置（否则可能变方块）
- 交付物落文件，并让主人能直接点开看
- 大文档配导航（目录/标题层级），便于回查

## 相关

- 技能：`homework-photo-explainer`（讲解类 HTML/PNG）
- 笔记：`Rong/notes/`（本仓库笔记规范另见工作区 AGENTS.md）
