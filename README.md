<p align="center">
  <img src="src/app/favicon.ico" alt="deephpo" width="100" />
</p>

<h1 align="center">DeepHPO</h1>

## 项目简介
DeepHPO是一个基于大语言模型的临床表型 HPO术语提取的Web应用，旨在为用户提供便捷的HPO术语查询服务。

[在线使用](https://deephpo.biotools.space/)！在线版本部署于 Hugging Face，所用模型**不定时更换**。所有输入均可能记录在 Log 中公开，**无隐私保护**，建议私有部署。


**支持 Anthropic Messages API 格式的端点。可通过主页设置按钮配置自己的 API 服务。**

**HPO术语由大语言模型翻译，请仔细甄别**

## 工作原理

采用「LLM 预处理 + 本地检索 + LLM 精确匹配」的三阶段流程，无需将整张术语表塞入上下文：

1. **预处理**：LLM 从病历文本中提取患者当前存在的症状、既往病史与诊断，剔除否定症状与家族史，并可基于医学知识谨慎推断高度相关的核心症状。
2. **本地检索**：自建 HPO 搜索引擎（前缀索引 + 关键词索引）对每个症状词检索候选术语，并通过 `hpo_names.txt` 的字符 trigram 索引做同义词扩展，合并去重后取前 50 条候选。
3. **精确匹配**：将候选术语表（`HP:ID | 英文名 | 中文名 | 中文定义`）注入 LLM 上下文，由 LLM 在候选中选出最匹配的术语，按「高/中/低」给出置信度，并识别否定语义避免误匹配。

全流程以 SSE 流式返回阶段进度，前端实时展示。相较早期「整表注入」方案，上下文体积大幅缩减，仅传入候选术语。

你可以在[这里下载](https://github.com/pzweuj/DeepHPO/blob/main/public/hpo_terms_cn.json)由大语言模型翻译的词表。

## 主要功能
1. 输入患者临床信息，由大语言模型提取并匹配 HPO 术语（LLM 模式）
2. 本地表型搜索模式：直接基于本地索引检索，无需调用 LLM
3. 支持 Anthropic Messages API 格式的各种端点
4. 输入文本中匹配词高亮，悬停可查看对应的 HPO ID
5. 结果分页展示，支持导出为 TSV
6. 网页设置按钮动态配置 API（保存在浏览器 localStorage，覆盖环境变量）

## 技术栈
- **框架**：Next.js 14 + React 18 + TypeScript
- **UI**：Tailwind CSS + TanStack Table
- **AI**：兼容 Anthropic Messages API 格式的各种大模型（自部署默认 `deepseek-v4-pro`）

## 快速开始

克隆项目

```bash
git clone https://github.com/pzweuj/DeepHPO.git
```


### 配置环境变量

**重要**: 必须创建环境变量文件才能使用LLM功能！

复制模板文件（推荐使用 `.env.local`，已被 gitignore）：

```bash
cp .env.local.self .env.local
```

编辑 `.env.local`，填入你的API配置：

```env
API_KEY=你的API密钥
API_URL=https://api.deepseek.com/anthropic
MODEL=deepseek-v4-pro

# 日志控制 (true=启用日志, false=禁用日志)
ENABLE_LOG=false
```

#### 支持的API

- 任何兼容 **Anthropic Messages API** 格式的端点

**动态配置**: 你也可以在网页设置按钮中动态输入API配置（保存在浏览器 localStorage，会覆盖环境变量）。


### 部署

```bash
npm install
npm run build
npm run start
```

如需诊断 API 配置：

```bash
npm run check-env
```

### Docker 部署

项目自带 Dockerfile（默认监听 7860 端口，适用于 Hugging Face Spaces）：

```bash
docker build -t deephpo .
docker run -p 7860:7860 --env-file .env.local deephpo
```

## 引用与许可

应用数据库来源于[HPO obo文件](http://purl.obolibrary.org/obo/hp.obo)（版本 2026-06-06）。

了解更多请访问：[http://www.human-phenotype-ontology.org](http://www.human-phenotype-ontology.org)

Cite: [doi: 10.1093/nar/gkad1005](https://pmc.ncbi.nlm.nih.gov/articles/PMC10767975/)
