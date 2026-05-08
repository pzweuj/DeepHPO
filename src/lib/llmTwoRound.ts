/**
 * HPO术语匹配 - 两轮查询优化版 (Anthropic Messages API)
 * 1. LLM预处理提取症状关键词
 * 2. 本地搜索候选术语
 * 3. LLM在候选中精确匹配
 */

import fs from 'fs';
import path from 'path';
import HPOSearchEngine from './hpoSearchEngine';
import { preprocessWithLLM, preprocessResultToQuery } from './llmPreprocessor';

interface TableData {
  hpo: string;
  name: string;
  chineseName: string;
  definition: string;
  definitionCn: string;
  confidence: string;
  remark: string;
}

interface TwoRoundQueryProps {
  question: string;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
}

// 加载完整 HPO 数据用于结果验证
let cachedHpoMap: Map<string, any> | null = null;

function loadHpoMap(): Map<string, any> {
  if (cachedHpoMap) return cachedHpoMap;

  const jsonPath = path.join(process.cwd(), 'public', 'hpo_terms_cn.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  cachedHpoMap = new Map(Object.entries(data));
  return cachedHpoMap;
}

function getApiConfig(custom?: { apiUrl?: string; apiKey?: string; model?: string }) {
  const token = (custom?.apiKey?.trim() || undefined) ||
                process.env.NEXT_PUBLIC_API_KEY ||
                process.env.API_KEY;
  const apiUrl = (custom?.apiUrl?.trim() || undefined) ||
                 process.env.NEXT_PUBLIC_API_URL ||
                 process.env.API_URL ||
                 'https://api.deepseek.com/anthropic';
  const model = (custom?.model?.trim() || undefined) ||
                process.env.NEXT_PUBLIC_MODEL ||
                process.env.MODEL ||
                'deepseek-v4-pro';

  if (!token) {
    throw new Error('API Key未配置');
  }

  return { token, apiUrl, model };
}

const parseResponseToTableData = (response: string, hpoMap: Map<string, any>): TableData[] => {
  if (!response || typeof response !== 'string') {
    throw new Error('Invalid or empty response');
  }

  let items: Array<{ hpo_id: string; confidence: string; remark: string }> = [];

  try {
    items = JSON.parse(response);
  } catch {
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

// 提取 Anthropic Messages API 输出文本
function extractOutputText(data: any): string | null {
  return data.content?.find((c: any) => c.type === 'text')?.text || null;
}

/**
 * 两轮查询：预处理 → 搜索候选 → LLM精确匹配
 */
export async function queryTwoRound({
  question,
  apiUrl: customApiUrl,
  apiKey: customApiKey,
  model: customModel
}: TwoRoundQueryProps): Promise<TableData[]> {
  try {
    const { token, apiUrl, model } = getApiConfig({
      apiUrl: customApiUrl,
      apiKey: customApiKey,
      model: customModel
    });

    const hpoMap = loadHpoMap();
    const searchEngine = HPOSearchEngine.getInstance();

    // 第一轮：LLM预处理提取症状
    console.log('第一轮：LLM预处理...');
    const preprocessResult = await preprocessWithLLM(question, {
      apiUrl,
      apiKey: customApiKey,
      model
    });

    const symptoms = preprocessResultToQuery(preprocessResult);
    console.log(`提取症状: ${symptoms}`);

    if (!symptoms || symptoms.trim() === '') {
      return [{
        hpo: 'HP:0000001',
        name: 'No Symptoms',
        chineseName: '未提取到症状',
        definition: 'NOTFOUND',
        definitionCn: '未能从输入中提取到有效症状',
        confidence: '-',
        remark: '预处理结果为空'
      }];
    }

    // 第二轮：逐词搜索候选术语（每个症状独立搜索，合并去重）
    console.log('第二轮：本地搜索候选术语...');
    const symptomWords = symptoms.split(/[\s、,;:.，。；：]+/).filter(w => w.length > 1);
    console.log(`拆分症状为 ${symptomWords.length} 个词: ${symptomWords.join(', ')}`);

    const termMap = new Map<string, { term: any; matchedWords: string[]; score: number }>();
    for (const word of symptomWords) {
      const results = await searchEngine.search(word, {
        maxResults: 20,
        includeDefinitions: false
      });
      results.forEach(term => {
        if (termMap.has(term.id)) {
          const existing = termMap.get(term.id)!;
          existing.matchedWords.push(word);
          existing.score += 1;
        } else {
          termMap.set(term.id, { term, matchedWords: [word], score: 1 });
        }
      });
    }

    const candidateTerms = Array.from(termMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(r => r.term);
    console.log(`搜索到 ${candidateTerms.length} 个候选术语`);

    if (candidateTerms.length === 0) {
      return [{
        hpo: 'HP:0000001',
        name: 'No Candidates',
        chineseName: '未找到候选术语',
        definition: 'NOTFOUND',
        definitionCn: '本地搜索未找到相关HPO术语',
        confidence: '-',
        remark: `症状: ${symptoms}`
      }];
    }

    // 构建候选术语表（用于第三轮LLM上下文）
    const candidateTable = candidateTerms.map(term =>
      `${term.id}|${term.name}|${term.name_cn}|${term.definition_cn || term.definition}`
    ).join('\n');

    // 第三轮：LLM在候选中精确匹配 (Anthropic Messages API)
    console.log('第三轮：LLM精确匹配...');
    const matchEndpoint = `${apiUrl}/v1/messages`;
    console.log(`[匹配] 请求: POST ${matchEndpoint} | model=${model} | 候选术语数=${candidateTerms.length}`);
    const res = await fetch(matchEndpoint, {
      method: 'POST',
      headers: {
        'x-api-key': token,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        system: `# Role
你是一位HPO术语匹配专家。请从以下候选术语中选出最匹配输入症状的HPO术语。

# Rules
1. 只从候选术语表中选取，不得使用其他术语
2. 选择最精确匹配的术语，优先选择具体术语而非宽泛术语
3. 最多返回10个术语
4. 如果候选术语中没有合适的，返回空数组 []

# Output Format
返回JSON数组：
[{"hpo_id":"HP:XXXXXXX","confidence":"高/中/低","remark":"对应的症状"}]

# 候选HPO术语表（HP:ID|英文名|中文名|中文定义）
---
${candidateTable}
---`,
        messages: [{
          role: 'user',
          content: `# 原始输入\n${question}\n\n# 提取的症状\n${symptoms}`
        }],
        max_tokens: 512,
        temperature: 0.1,
        thinking: { type: 'disabled' }
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[匹配] 失败 ${res.status}: ${errorText.substring(0, 500)}`);
      throw new Error(`API请求失败 (${res.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await res.json();
    console.log(`[匹配] 响应: status=${res.status}, model=${data.model}, stop_reason=${data.stop_reason}`);
    const outputText = extractOutputText(data);
    console.log(`[匹配] 输出: ${outputText?.substring(0, 300)}`);

    if (!outputText) {
      throw new Error('API响应中没有有效输出');
    }

    return parseResponseToTableData(outputText, hpoMap);

  } catch (error) {
    console.error('两轮查询错误:', error);
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
}

/**
 * 两轮查询 - Streaming版本 (Responses API SSE)
 */
export function queryTwoRoundStream({
  question,
  apiUrl: customApiUrl,
  apiKey: customApiKey,
  model: customModel
}: TwoRoundQueryProps): ReadableStream {
  const encoder = new TextEncoder();
  let keepaliveInterval: ReturnType<typeof setInterval>;

  return new ReadableStream({
    start(controller) {
      keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode('event: keepalive\ndata: {}\n\n'));
        } catch {
          clearInterval(keepaliveInterval);
        }
      }, 5000);

      (async () => {
        try {
          const { token, apiUrl, model } = getApiConfig({
            apiUrl: customApiUrl,
            apiKey: customApiKey,
            model: customModel
          });

          const hpoMap = loadHpoMap();
          const searchEngine = HPOSearchEngine.getInstance();

          // 第一轮：LLM预处理
          controller.enqueue(encoder.encode('event: stage\ndata: {"stage":"预处理","message":"正在提取症状关键词..."}\n\n'));

          const preprocessResult = await preprocessWithLLM(question, {
            apiUrl,
            apiKey: customApiKey,
            model
          });

          const symptoms = preprocessResultToQuery(preprocessResult);
          controller.enqueue(encoder.encode(`event: preprocess\ndata: ${JSON.stringify({ symptoms })}\n\n`));

          if (!symptoms || symptoms.trim() === '') {
            controller.enqueue(encoder.encode('event: data\ndata: [{"hpo":"HP:0000001","name":"No Symptoms","chineseName":"未提取到症状","definition":"NOTFOUND","definitionCn":"未能提取有效症状","confidence":"-","remark":"预处理为空"}]\n\n'));
            return;
          }

          // 第二轮：逐词搜索候选术语
          controller.enqueue(encoder.encode('event: stage\ndata: {"stage":"搜索","message":"正在搜索候选术语..."}\n\n'));

          const symptomWords = symptoms.split(/[\s、,;:.，。；：]+/).filter(w => w.length > 1);
          console.log(`拆分症状为 ${symptomWords.length} 个词: ${symptomWords.join(', ')}`);

          const termMap = new Map<string, { term: any; matchedWords: string[]; score: number }>();
          for (const word of symptomWords) {
            const results = await searchEngine.search(word, {
              maxResults: 20,
              includeDefinitions: false
            });
            results.forEach(term => {
              if (termMap.has(term.id)) {
                const existing = termMap.get(term.id)!;
                existing.matchedWords.push(word);
                existing.score += 1;
              } else {
                termMap.set(term.id, { term, matchedWords: [word], score: 1 });
              }
            });
          }

          const candidateTerms = Array.from(termMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 50)
            .map(r => r.term);
          controller.enqueue(encoder.encode(`event: candidates\ndata: ${JSON.stringify({ count: candidateTerms.length })}\n\n`));

          if (candidateTerms.length === 0) {
            controller.enqueue(encoder.encode('event: data\ndata: [{"hpo":"HP:0000001","name":"No Candidates","chineseName":"未找到候选","definition":"NOTFOUND","definitionCn":"未找到相关术语","confidence":"-","remark":"搜索无结果"}]\n\n'));
            return;
          }

          const candidateTable = candidateTerms.map(term =>
            `${term.id}|${term.name}|${term.name_cn}|${term.definition_cn || term.definition}`
          ).join('\n');

          // 第三轮：LLM精确匹配 (Anthropic Messages API streaming)
          controller.enqueue(encoder.encode('event: stage\ndata: {"stage":"匹配","message":"正在精确匹配HPO术语..."}\n\n'));

          const matchEndpoint = `${apiUrl}/v1/messages`;
          console.log(`[匹配-流] 请求: POST ${matchEndpoint} | model=${model} | 候选术语数=${candidateTerms.length}`);
          const res = await fetch(matchEndpoint, {
            method: 'POST',
            headers: {
              'x-api-key': token,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              system: `# Role
你是一位HPO术语匹配专家。请从以下候选术语中选出最匹配输入症状的HPO术语。

# Rules
1. 只从候选术语表中选取，不得使用其他术语
2. 选择最精确匹配的术语，优先选择具体术语而非宽泛术语
3. 最多返回10个术语
4. 如果候选术语中没有合适的，返回空数组 []

# Output Format
返回JSON数组：
[{"hpo_id":"HP:XXXXXXX","confidence":"高/中/低","remark":"对应的症状"}]

# 候选HPO术语表（HP:ID|英文名|中文名|中文定义）
---
${candidateTable}
---`,
              messages: [{
                role: 'user',
                content: `# 原始输入\n${question}\n\n# 提取的症状\n${symptoms}`
              }],
              stream: false,
              max_tokens: 512,
              temperature: 0.1,
              thinking: { type: 'disabled' }
            })
          });

          if (!res.ok) {
            const errorText = await res.text();
            console.error(`[匹配-流] 失败 ${res.status}: ${errorText.substring(0, 500)}`);
            throw new Error(`API请求失败 (${res.status})`);
          }

          const data = await res.json();
          console.log(`[匹配-流] 响应: model=${data.model}, stop_reason=${data.stop_reason}`);
          const outputText = extractOutputText(data);
          console.log(`[匹配-流] 输出: ${outputText?.substring(0, 500)}`);
          const tableData = parseResponseToTableData(outputText || '', hpoMap);
          console.log(`[匹配-流] 完成, 解析出${tableData.length}条结果`);
          controller.enqueue(encoder.encode(`event: data\ndata: ${JSON.stringify(tableData)}\n\n`));

        } catch (error) {
          console.error('两轮查询Stream错误:', error);
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify([{ hpo: 'HP:0000001', name: 'Error', chineseName: '匹配错误', definition: 'ERROR', definitionCn: errorMessage, confidence: '-', remark: '请检查配置' }])}\n\n`));
        } finally {
          clearInterval(keepaliveInterval);
          controller.close();
        }
      })();
    }
  });
}

export default { queryTwoRound, queryTwoRoundStream };
