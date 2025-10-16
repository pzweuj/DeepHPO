# DeepHPO <img src="src/app/favicon.ico" alt="deephpo" width="40" height="40">

## 项目简介
DeepHPO是一个基于大语言模型的临床表型 HPO术语提取的Web应用，旨在为用户提供便捷的HPO术语查询服务。

### ✨ 最新优化
- ⚡ **94%更小的bundle**：从8MB+减少到80%更快的加载速度
- ⚡ **75%更快的搜索**：智能索引，毫秒级响应
- ⚡ **90%更低的内存**：服务端优化，客户端轻量化
- 📊 **分页展示**：支持大量结果流畅浏览

📚 [查看完整优化文档](./OPTIMIZATION.md) | [快速开始指南](./PERFORMANCE_GUIDE.md)

[在线使用](https://deephpo.biotools.site/)！ 默认使用DeepSeek-V3模型。

**Vercel的超时机制（60秒），可能会无法获取到完整信息导致查询失败。**

**支持任何兼容OpenAI格式的API端点和模型，您可以通过主页的设置按钮配置自己的API服务提供商、模型名称和API Key。**

**HPO术语使用DeepSeek-V3翻译，请仔细甄别**

1. 用户可以通过输入患者的临床诊断信息，系统会使用大语言模型对信息进行提取，输出其中可能存在的HPO术语

2. 用户可以通过以下方式查询表型信息：
- HPO编号
- 表型英文名称
- 表型英文描述
- 表型中文名称（由deepseek-V3生成，请仔细甄别）
- 表型中文描述（由deepseek-V3生成，请仔细甄别）

3. 你可以在[这里下载](https://github.com/pzweuj/DeepHPO/blob/main/public/hpo_terms_cn.json)由deepseek-V3翻译的词表。

## 主要功能
1. 搜索引擎式主页界面
2. 支持多种查询方式（HPO ID、中英文名称、描述）
3. ⚡ **智能索引搜索**：毫秒级响应，精准匹配
4. 基于大语言模型的患者临床信息HPO编号提取
5. 兼容任何OpenAI格式的API端点（DeepSeek、OpenAI、硅基流动等）
6. 📊 **分页展示**：支持大量搜索结果

## 切换功能

![shot](shot.png)


## 技术栈
- **框架**：Next.js 14 + React 18 + TypeScript
- **UI**：Tailwind CSS + TanStack Table
- **搜索引擎**：自研高性能索引系统
- **AI**：兼容OpenAI格式的各种大模型

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

⚠️ **为什么使用 `.env.local`？** 它优先级高于系统环境变量，避免冲突！

#### 步骤2: 配置API Key

编辑 `.env` 文件，填入你的API配置：

```env
OPENAI_API_KEY=你的API密钥
OPENAI_API_URL=https://api.siliconflow.cn/v1/chat/completions
OPENAI_MODEL=deepseek-ai/DeepSeek-V3
```

#### 支持的API提供商

- **硅基流动**: `https://api.siliconflow.cn/v1/chat/completions` [获取Key](https://cloud.siliconflow.cn/)
- **DeepSeek官方**: `https://api.deepseek.com/v1/chat/completions` [获取Key](https://platform.deepseek.com/)
- **OpenAI**: `https://api.openai.com/v1/chat/completions` [获取Key](https://platform.openai.com/)
- **其他兼容OpenAI格式的端点**

📝 [详细配置指南](./ENV_SETUP.md) | 🔧 [故障排查](./ENV_SETUP.md#常见问题排查)

**动态配置**: 你也可以在网页左上角设置按钮中动态输入API配置（会覆盖环境变量）。

**注：腾讯LKE已废弃。**

接下来自行部署这个应用

```bash
npm install
npm run build
```

## 引用与许可

应用数据库来源于[HPO obo文件](http://purl.obolibrary.org/obo/hp.obo)（版本 2025-09-01）。

了解更多请访问：[http://www.human-phenotype-ontology.org](http://www.human-phenotype-ontology.org)

Cite: [doi: 10.1093/nar/gkad1005](https://pmc.ncbi.nlm.nih.gov/articles/PMC10767975/)

