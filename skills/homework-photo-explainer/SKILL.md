---
name: homework-photo-explainer
description: "把家长拍来的小学作业题照片，变成孩子能看懂的讲解。当主人发来作业/试卷照片并说「帮我看看这道题」「让孩子看懂规则」「算出每个数值」时使用。覆盖数学（算盘、数轴、竖式、图形计数等）、语文等需要「读懂题图 + 核对答案 + 生成讲解」的场景。"
whenToUse: "收到作业/试卷/练习册照片并要讲解时。需要读图能力。"
---

# 作业照片 → 孩子能看懂的讲解

## 最高原则

**家长要的不是答案，是“孩子能看懂的讲解”。**

讲解必须按这个顺序走，缺一不可：

```
规则 → 逐项数值 → 分步推理 → 答案 → 为什么其它选项错
```

- 只丢一个答案 = 没完成
- 要让孩子能顺着读下来，自己走一遍

## 第 0 步：读图能力

拍来的知识全在图里，**必须真的看图**，不能靠主人转述题目。

- 可用读图的模型：`deepseek-flash`（默认，支持图片输入）、`deepseek-v4-flash-vision-exp`
- ⚠️ **纯文本模型（`deepseek-v4-pro`、`deepseek-v4-flash`）看不到图** → 如果当前模型不支持图片，**直接告诉主人切换模型**，不要瞎猜题面
- 主人说的"v4flashvisionexp"= 官方 ID **`deepseek-v4-flash-vision-exp`**（设置里 `agent-default-model.model` 改这个）
- 图像预处理：照片先放大看清题图，必要时裁剪局部再读

## 五步流程

### 1. 看清题图

- 放大照片，把题干、题号、图示、选项全部读准
- **题面数字不可信来源**：主人转述的题面、生成脚本的注释、记忆里的印象——**都必须回到图本身核对**。实测踩过：脚本注释写「16 格」，像素投影实测是 **6 列 × 3 行 = 18 格**
- 不确定的字（形近字、手写）要存疑并说明，别硬猜

### 2. 读懂题型（这一步最容易出错）

- 数**档位**、数**格子**、数**图形**时，用**像素投影**辅助计数（把图按行列投影，数峰值），比肉眼可靠
  - ⚠️ **本机没有 numpy** → 必须用纯 PIL + Python 内建实现，下面的代码可直接跑
- 竖式看进位/退位标记；数轴看单位长度与方向

```python
# 纯 PIL 像素投影计数（本机无 numpy，用内建 list 即可）
# 思路：对暗像素做「整行/整列」统计，过半数偏暗处就是一条线
from PIL import Image

img = Image.open(photo_path).convert('L')
w, h = img.size
px = img.load()

def merge_adjacent(xs, gap=2):
    """把相邻像素合并成一条线，返回线中心坐标"""
    out, run = [], [xs[0]] if xs else []
    for v in xs[1:]:
        if v - run[-1] <= gap:
            run.append(v)
        else:
            out.append(sum(run) // len(run)); run = [v]
    if run:
        out.append(sum(run) // len(run))
    return out

def dark_cols(threshold=128, ratio=0.5):
    hits = []
    for x in range(w):
        dark = sum(1 for y in range(h) if px[x, y] < threshold)
        if dark > h * ratio:          # 整列过半数偏暗 → 竖线
            hits.append(x)
    return merge_adjacent(hits)

def dark_rows(threshold=128, ratio=0.5):
    hits = []
    for y in range(h):
        dark = sum(1 for x in range(w) if px[x, y] < threshold)
        if dark > w * ratio:
            hits.append(y)
    return merge_adjacent(hits)

cols, rows = dark_cols(), dark_rows()
print('竖线', len(cols), cols)
print('横线', len(rows), rows)
if len(cols) > 1 and len(rows) > 1:
    print('格子 =', len(cols) - 1, '列 ×', len(rows) - 1, '行 =', (len(cols)-1)*(len(rows)-1))
```

- 阈值按图调：线条细/照片发灰时 ratio 降到 0.3、threshold 提到 160
- **先看图再信数**：投影结果与肉眼或题面冲突时，**投影优先**

### 3. 联网核对原题

- 拿题干关键词去搜，核对标准答案与官方解析
- 联网结论与自己的推导冲突时，**以推导为准并说明分歧**，不要盲信搜索结果
- ⚠️ **联网不可用时的降级路径**：本机 `web_search` / `web_fetch` 依赖的 `modsearch` 插件缺 `dist/main.js`，调用会直接失败。此时**在交付物里明确标注「未联网核对，结论为自行推导」**，不要假装核对过

### 4. 写讲解（按固定顺序）

```
① 规则：这类题的通则是什么（一句话说清）
② 逐项数值：把题里每个数一一列出来，标清它代表什么
③ 分步推理：一步一步算，每步说"为什么可以这么算"
④ 答案
⑤ 干扰项：其它选项/常见错法为什么错
```

### 5. 产出两个交付物

| 交付物 | 用途 |
|---|---|
| **交互 HTML** | 在电脑上看，能点、能展开 |
| **可打印 PNG** | 打印出来给孩子 / 微信转发 |

> 两者内容一致，视觉一致。
> **HTML 必须自包含**：图片一律 base64 内嵌，**0 处外部链接**（否则转发/换机器就白屏）。

## 视觉规范（主人的固定偏好）

- **暗色主题**、**字号偏大**
- 重点用**橙 / 青双色**区分
- 图形题要保留原图结构，别过度美化导致题意变了

## 生成技巧（本机无 Chromium 时的做法）

```python
# 1) 用 PIL 先做布局预演：按目标像素坐标画一遍，确认位置再定稿
from PIL import Image, ImageDraw, ImageFont
W, H = 1200, 1600
img = Image.new('RGB', (W, H), '#111418')        # 暗底
d = ImageDraw.Draw(img)
# ... 按同一套坐标画框、写文字，先看布局对不对
img.save('preview.png')
```

- **PIL 布局预演**：先按最终坐标复刻一遍几何，避免 HTML/PNG 两版对不上
- HTML 里的 JS 用 `node` + 假 `document` 桩做语法/逻辑校验，别直接交付未验证的脚本
- 中文字体要显式指定，否则 PIL 出方块

## 踩坑记录

| 问题 | 原因 | 解决 |
|---|---|---|
| 讲解被家长说"孩子看不懂" | 跳过了"规则"和"逐项数值"，直接给算式 | 严格按五步顺序写 |
| 数错格子/档位 | 肉眼看密集图不可靠 | 像素投影计数 |
| 答案与网上不一致 | 搜索结果未必对 | 以自己推导为准，标注分歧 |
| 交付的 HTML 在浏览器里不生效 | JS 没校验 | node + 假 document 桩先跑一遍 |
| 中文显示成方块 | PIL 没指定字体 | 显式加载中文字体文件 |
| 纯文本模型答得一本正经却是编的 | 它根本看不到图 | 先确认模型支持读图 |
| 数错格子，还照着错误题面讲 | 信了转述/注释里的数字，没回图核对 | 投影计数为准；题面数字一律回图验证 |
| 像素投影代码直接报 ModuleNotFoundError | 示例用了 numpy，本机只有 Pillow | 用上面的纯 PIL 实现 |
| 交付的 HTML 转发给别人打不开 | 图片用了本地路径/外链 | 一律 base64 内嵌 |

## 相关

- 技能：`note-to-word-digest`（把讲解整理成 Word）、`windows-shell-workarounds`
