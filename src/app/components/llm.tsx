/**
 * HPO术语匹配 - 全量术语表直接注入 LLM
 * 利用 1M 上下文窗口，将完整 HPO 术语表放入 system prompt
 */

import fs from 'fs';
import path from 'path';

interface TableData {
  hpo: string;
  name: string;
  chineseName: string;
  definition: string;
  definitionCn: string;
  confidence: string;
  remark: string;
}

interface LLMQueryProps {
  question: string;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
}

// 缓存术语表内容
let cachedLookupTable: string | null = null;

function loadLookupTable(): string {
  if (cachedLookupTable) return cachedLookupTable;

  const filePath = path.join(process.cwd(), 'public', 'hpo_lookup_table.txt');
  cachedLookupTable = fs.readFileSync(filePath, 'utf-8');
  console.log(`📋 已加载 HPO 术语表: ${cachedLookupTable.split('\n').length} 条`);
  return cachedLookupTable;
}

function getApiConfig(custom?: { apiUrl?: string; apiKey?: string; model?: string }) {
  const token = (custom?.apiKey?.trim() || undefined) ||
                process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
                process.env.OPENAI_API_KEY;
  const apiUrl = (custom?.apiUrl?.trim() || undefined) ||
                 process.env.NEXT_PUBLIC_OPENAI_API_URL ||
                 process.env.OPENAI_API_URL ||
                 'https://api.siliconflow.cn/v1/chat/completions';
  const model = (custom?.model?.trim() || undefined) ||
                process.env.NEXT_PUBLIC_OPENAI_MODEL ||
                process.env.OPENAI_MODEL ||
                'deepseek-ai/DeepSeek-V4-Flash';

  if (!token) {
    throw new Error('API Key未配置 - 请在页面设置中配置或在.env文件中添加OPENAI_API_KEY');
  }

  return { token, apiUrl, model };
}

const parseResponseToTableData = (response: string, hpoMap: Map<string, any>): TableData[] => {
  if (!response || typeof response !== 'string') {
    throw new Error('Invalid or empty response');
  }

  // 尝试从响应中提取 JSON 数组
  let items: Array<{ hpo_id: string; confidence: string; remark: string }> = [];

  // 直接解析
  try {
    items = JSON.parse(response);
  } catch {
    // 从 markdown 代码块或文本中提取 JSON
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        items = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error('无法解析响应中的JSON');
      }
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('响应中没有有效的HPO术语');
  }

  const tableData: TableData[] = [];

  for (const item of items) {
    const hpoId = item.hpo_id;
    const hpoTerm = hpoMap.get(hpoId);

    if (hpoTerm) {
      tableData.push({
        hpo: hpoId,
        name: hpoTerm.name,
        chineseName: hpoTerm.name_cn,
        definition: hpoTerm.definition,
        definitionCn: hpoTerm.definition_cn,
        confidence: item.confidence || '-',
        remark: item.remark || ''
      });
    }
  }

  if (tableData.length === 0) {
    throw new Error('响应中的HPO ID在术语表中不存在');
  }

  return tableData;
};

// 加载完整 HPO 数据用于结果验证
let cachedHpoMap: Map<string, any> | null = null;

function loadHpoMap(): Map<string, any> {
  if (cachedHpoMap) return cachedHpoMap;

  const jsonPath = path.join(process.cwd(), 'public', 'hpo_terms_cn.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  cachedHpoMap = new Map(Object.entries(data));
  return cachedHpoMap;
}

export const query = async ({ question, apiUrl: customApiUrl, apiKey: customApiKey, model: customModel }: LLMQueryProps): Promise<TableData[]> => {
  try {
    const { token, apiUrl, model } = getApiConfig({
      apiUrl: customApiUrl,
      apiKey: customApiKey,
      model: customModel
    });

    const lookupTable = loadLookupTable();
    const hpoMap = loadHpoMap();

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'system',
          content: `# Role
你是一位HPO（Human Phenotype Ontology）术语匹配专家。你的任务是将临床描述中的症状、体征和疾病精确匹配到HPO术语。

# Rules
1. 只匹配输入中明确提到的症状、体征和疾病，不要推断或补充
2. 忽略否定症状（如"无头痛"、"否认发热"）和家族史（如"父亲高血压"）
3. 选择最具体、最精确的术语，不要选择过于宽泛的上级术语
4. 一个临床表现匹配一个HPO术语，复合症状可拆分为多个术语
5. HPO ID必须来自下方术语表，不得编造
6. 最多返回10个术语

# Output Format
返回JSON数组，每个元素包含hpo_id、confidence、remark三个字段：
[{"hpo_id":"HP:XXXXXXX","confidence":"高/中/低","remark":"对应的临床表现"}]

- confidence: 精确匹配为"高"，近义匹配为"中"，模糊匹配为"低"
- remark: 简要说明该术语对应输入中的哪个症状

# Example
输入："患者有癫痫发作，伴智力发育迟缓"
输出：[{"hpo_id":"HP:0001250","confidence":"高","remark":"癫痫发作"},{"hpo_id":"HP:0001249","confidence":"高","remark":"智力发育迟缓"}]

# HPO术语表
以下为完整的HPO术语表，格式为 HP:ID|英文名|中文名|中文定义。请仅从该表中选取术语：
---
${lookupTable}
---`
        }, {
          role: 'user',
          content: question
        }],
        stream: false,
        enable_thinking: false,
        max_tokens: 512,
        temperature: 0.1,
        top_p: 0.3
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API请求失败 (${res.status}): ${errorText.substring(0, 200)}`);
    }

    const responseText = await res.text();
    if (!responseText) {
      throw new Error('API返回空响应');
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`无效的JSON响应: ${responseText.substring(0, 100)}`);
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error(`API响应中没有choices字段: ${JSON.stringify(Object.keys(data))}`);
    }

    return parseResponseToTableData(data.choices[0].message.content, hpoMap);
  } catch (error) {
    console.error('API Error:', error);
    return [{
      hpo: 'HP:0000001',
      name: 'Error',
      chineseName: '匹配错误',
      definition: 'ERROR',
      definitionCn: error instanceof Error ? error.message : '未知错误',
      confidence: '-',
      remark: '请检查输入或API配置'
    }];
  }
};

export default { query };
