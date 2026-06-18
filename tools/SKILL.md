# HPO 中文数据库更新流程（SKILL）

记录从 HPO 官方源（`hp.obo`）开始，一步步更新 `public/` 中的中文数据库（`hpo_terms_cn.json`、`hpo_names.txt`、`hpo_terms_cn.txt`）的全流程。本文中的命令均假设当前工作目录为项目根目录 `DeepHPO/`，特殊情况（如脚本写死了相对路径）会显式注明。

## 涉及的产物

公开数据（最终落到 `public/`，会被前端使用）：

| 文件 | 用途 |
| --- | --- |
| `public/hpo_terms_cn.json` | HPO 中文翻译主库，键为 HPO ID，值含 `name`/`name_cn`/`definition`/`definition_cn` 等 |
| `public/hpo_names.txt` | 所有 `name` 与 `name_cn` 去重排序后的纯文本，供前端匹配/索引 |
| `public/hpo_terms_cn.txt` | TSV 形式的 `HPO_ID\tname\tname_cn`，便于人工查阅或外部使用 |

中间产物（流程结束后清理，不入库）：

`tools/hp.obo`、`tools/hpo_terms.json`、`tools/done_list.txt`、`tools/hpo_terms_cn_new.json`、`tools/hpo_terms_cn_merge.json`

## 步骤总览

```
hp.obo
  └─[1] hpo_obo2json.py──▶ hpo_terms.json
                                │
public/hpo_terms_cn.json (旧)   │
  └─[2] hpo_old2dl.py──▶ done_list.txt
                                │
                                ▼
              [3] hpo_en2ch.py（仅翻译 obo 中存在但 done_list 中没有的条目）
                                │
                                ▼
                         hpo_terms_cn_new.json
                                │
public/hpo_terms_cn.json (旧)   │
       └──┬──[4] hpo_merge_old.py──▶ hpo_terms_cn_merge.json
          │                                │
          │       [5] 人工抽检 / 修复多行字段
          │                                │
          └──[6] 替换──▶ public/hpo_terms_cn.json (新)
                                │
                                ├─[7] extract_hpo_names.py──▶ public/hpo_names.txt
                                └─[8] extract_hpo_terms.py──▶ public/hpo_terms_cn.txt
                                │
                          [9] 清理 tools/ 下中间产物
```

## 步骤详解

### 1. 下载并解析 `hp.obo` → `hpo_terms.json`

把官方 `hp.obo` 放在 `tools/hp.obo`：

```bash
# 下载到 tools/ 目录
curl -L -o tools/hp.obo http://purl.obolibrary.org/obo/hp.obo
```

> **注意**：`hpo_obo2json.py` 的输入 / 输出路径是裸的 `hp.obo` / `hpo_terms.json`，必须在 `tools/` 目录里运行。

```bash
cd tools && python hpo_obo2json.py && cd ..
```

产物：`tools/hpo_terms.json`（含全部 HPO Term，每条带 `id`/`name`/`definition`/`is_a`）。

### 2. 生成已完成清单 → `done_list.txt`

读取现有 `public/hpo_terms_cn.json` 的 key 列表，作为"已译完"集合：

```bash
python tools/hpo_old2dl.py
```

产物：`tools/done_list.txt`，每行一个 HPO ID。

> **注意**：脚本里的路径是相对项目根的（`public/...`、`tools/...`），所以必须从项目根运行。

### 3. 增量翻译 → `hpo_terms_cn_new.json`

由 `tools/hpo_en2ch.py` 完成（调用 LLM 接口）。脚本会读取 `tools/hpo_terms.json` 与 `tools/done_list.txt`，只翻译"在 obo 里、不在 done list 里"的差集，写出 `tools/hpo_terms_cn_new.json`。

> 此步骤通常由人工触发（耗时长、可能需要分批/重试），不在自动化流水线中。

### 4. 合并新旧 → `hpo_terms_cn_merge.json`

`hpo_merge_old.py` 内部读的是裸文件名 `hpo_terms_cn_new.json` 和 `hpo_terms_cn.json`，期望两者同目录。所以要把 `public/hpo_terms_cn.json` 临时复制到 `tools/`，运行后再清理临时副本：

```bash
cp public/hpo_terms_cn.json tools/hpo_terms_cn.json
cd tools && python hpo_merge_old.py && cd ..
rm tools/hpo_terms_cn.json   # 删掉临时副本，原文件依然在 public/
```

产物：`tools/hpo_terms_cn_merge.json`。脚本会：

- 自动剥除新条目里多余的 `is_a` 字段
- 用新条目覆盖同 key 的旧条目
- 按 key 升序排序

### 5. 人工抽检 / 修复异常字段

LLM 在翻译 `obsolete *` 这类废弃条目时，可能在 `name_cn` 里写出"过时译名 / 现代术语"两行（含字面 `\n`）。这样的多行 name 会污染 `hpo_names.txt`（`extract_hpo_names.py` 不做换行清洗）。修复策略：**只保留"现代术语"那部分**，让 `name_cn` 始终是单行。

排查脚本：

```bash
python -c "
import json
d = json.load(open('tools/hpo_terms_cn_merge.json','r',encoding='utf-8'))
bad = [(hid, k) for hid, e in d.items() for k in ('name','name_cn')
       if isinstance(e.get(k), str) and ('\n' in e[k] or '\r' in e[k])]
print('entries with embedded newlines:', len(bad))
for x in bad[:20]: print(x)
"
```

修正方式：直接编辑 JSON，或写个一次性 Python 改写片段。例如本次运行修复了 4 个条目（详见末尾"本次运行记录"）。

### 6. 替换 `public/hpo_terms_cn.json`

人工抽检通过后：

```bash
mv tools/hpo_terms_cn_merge.json public/hpo_terms_cn.json
```

> 用 `mv` 而不是 `cp`，避免在 `tools/` 下留下与 `public/` 同名同内容的副本造成歧义。

### 7. 提取去重名称表 → `public/hpo_names.txt`

```bash
python tools/extract_hpo_names.py
```

`extract_hpo_names.py` 用 `os.path` 解算项目根，可以从任意目录运行。它会：

- 同时收集 `name` 与 `name_cn`
- `set` 去重，按小写字母序排序
- 写入 `public/hpo_names.txt`，每行一个

校验：脚本输出的"共提取 N 个不重复名称"应当等于 `wc -l public/hpo_names.txt`。若 `wc -l` 比 N 多，说明仍有 `name`/`name_cn` 含字面换行，回到 **步骤 5** 修复。

### 8. 提取 TSV 表 → `public/hpo_terms_cn.txt`

```bash
python tools/extract_hpo_terms.py
```

产物：`public/hpo_terms_cn.txt`，首行为表头 `HPO_ID\tname\tname_cn`。

### 9. 清理中间产物

```bash
rm -f tools/hp.obo \
      tools/hpo_terms.json \
      tools/done_list.txt \
      tools/hpo_terms_cn_new.json \
      tools/hpo_terms_cn_merge.json
```

至此 `tools/` 下应只保留脚本本身（`*.py`）。

## 易踩坑速查

- **`hpo_obo2json.py` / `hpo_merge_old.py`** 用了裸相对路径，必须从 `tools/` 目录运行；其他脚本可在项目根运行。
- **Windows 终端打印中文乱码**：脚本写出的 JSON / TXT 都是 UTF-8（`ensure_ascii=False`），文件本身没问题，只是终端 `print()` 时显示乱码，可忽略。
- **多行 `name_cn`**：必须在合并后、提取名称前清掉，否则 `hpo_names.txt` 会出现"半截 name"。
- **去重导致名称数下降**：当新增条目的 `name_cn` 与库里旧条目相同（如修复 obsolete 时落到同一个现代术语）时，`hpo_names.txt` 总条数会比预期略少，属正常。

## 本次运行记录（参考实例）

- 解析 `hp.obo` → `hpo_terms.json`：**20384** 条
- `done_list.txt`：**19944** 条（来自旧 `hpo_terms_cn.json`）
- 增量翻译：**440** 条（20384 − 19944）
- 合并后：**20384** 条，按 key 排序
- 修复 4 个含字面 `\n` 的废弃条目，统一只保留现代术语：

  | HPO | name (en) | name_cn 修复后 |
  | --- | --- | --- |
  | HP:0002357 | obsolete Dysphasia | 语言障碍 |
  | HP:0002622 | obsolete Dissecting aortic dilatation | 主动脉夹层 |
  | HP:0020098 | obsolete Herpes encephalitis | 单纯疱疹病毒脑炎 |
  | HP:0100805 | obsolete Precocious menopause | 原发性卵巢功能不全 |

- `public/hpo_names.txt`：**40347** 行（其中 2 条修复后落在已有名称上，去重后比候选 40349 少 2）
