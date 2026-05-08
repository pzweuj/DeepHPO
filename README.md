# DeepHPO <img src="src/app/favicon.ico" alt="deephpo" width="40" height="40">

## 项目简介
DeepHPO是一个基于大语言模型的临床表型 HPO术语提取的Web应用，旨在为用户提供便捷的HPO术语查询服务。

[在线使用](https://deephpo.biotools.space/)！ 默认使用DeepSeek-V4-Flash模型。


**支持 Anthropic Messages API 格式的端点，默认使用 DeepSeek 的 Anthropic 兼容 API。可通过主页设置按钮配置自己的 API 服务。**

**HPO术语使用DeepSeek-V4-Flash翻译，请仔细甄别**

## 工作原理

将完整的 HPO 术语表（约 20,000 条，含中英文名称和定义）直接注入大语言模型的上下文中（约 420K tokens），由 LLM 一次性完成症状提取和术语匹配。无需向量数据库、无需索引引擎，仅依赖模型自身的语义理解能力。

你可以在[这里下载](https://github.com/pzweuj/DeepHPO/blob/main/public/hpo_terms_cn.json)由DeepSeek-V4-Flash翻译的词表。

## 主要功能
1. 输入患者临床诊断信息，由大语言模型提取匹配的 HPO 术语
2. 支持 Anthropic Messages API 格式
3. 分页展示搜索结果

## 技术栈
- **框架**：Next.js 14 + React 18 + TypeScript
- **UI**：Tailwind CSS + TanStack Table
- **AI**：兼容 Anthropic Messages API 格式的各种大模型（默认 DeepSeek-V4-Pro）

## 快速开始

克隆项目

```bash
git clone https://github.com/pzweuj/DeepHPO.git
```


### 配置环境变量

**重要**: 必须创建 `.env.local` 文件才能使用LLM功能！

#### 步骤1: 创建 .env.local 文件

```bash
# Windows PowerShell - 使用 .env.local 避免系统环境变量冲突
Copy-Item .env.local.self .env.local

# 或手动复制 .env.local.self 并重命名为 .env.local
```

#### 步骤2: 配置API Key

编辑支持 Anthropic Messages API 的文件，填入你的API配置：

```env
API_KEY=你的API密钥
API_URL=https://api.deepseek.com/anthropic
MODEL=deepseek-v4-pro
```

#### 支持的API

- **DeepSeek (Anthropic API)**: `https://api.deepseek.com/anthropic` [获取Key](https://platform.deepseek.com/)
- **Anthropic 官方**: `https://api.anthropic.com` [获取Key](https://console.anthropic.com/)
- **其他兼容 Anthropic Messages API 的端点**

**动态配置**: 你也可以在网页设置按钮中动态输入API配置（会覆盖环境变量）。


接下来自行部署这个应用

```bash
npm install
npm run build
```

## 引用与许可

应用数据库来源于[HPO obo文件](http://purl.obolibrary.org/obo/hp.obo)（版本 2026-02-16）。

了解更多请访问：[http://www.human-phenotype-ontology.org](http://www.human-phenotype-ontology.org)

Cite: [doi: 10.1093/nar/gkad1005](https://pmc.ncbi.nlm.nih.gov/articles/PMC10767975/)
