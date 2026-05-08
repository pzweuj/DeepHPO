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

// ========== 同义词扩展模块 ==========

let _synDataLoaded = false;
let _namesLines: string[] = [];
let _namesTrigramIndex: Map<string, number[]> = new Map();
let _nameToHpoId: Map<string, string> = new Map();

/** 提取字符 n-gram（滑动窗口） */
function extractCharNgrams(text: string, n: number): string[] {
  if (text.length < n) return [];
  const result: string[] = [];
  for (let i = 0; i <= text.length - n; i++) {
    result.push(text.substring(i, i + n));
  }
  return result;
}

/** 加载同义词数据：hpo_names.txt + 反向 name→ID 映射 */
function loadSynonymData(): void {
  if (_synDataLoaded) return;

  try {
    // 1. 加载 hpo_names.txt
    const namesPath = path.join(process.cwd(), 'public', 'hpo_names.txt');
    _namesLines = fs.readFileSync(namesPath, 'utf-8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    // 2. 构建字符 trigram 索引
    _namesTrigramIndex = new Map();
    for (let i = 0; i < _namesLines.length; i++) {
      const trigrams = extractCharNgrams(_namesLines[i].toLowerCase(), 3);
      for (const tg of trigrams) {
        const arr = _namesTrigramIndex.get(tg);
        if (arr) arr.push(i);
        else _namesTrigramIndex.set(tg, [i]);
      }
    }

    // 3. 从 hpo_terms_cn.json 构建 name→HPO ID 反向映射
    const hpoMap = loadHpoMap();
    _nameToHpoId = new Map();
    hpoMap.forEach((term: any, id: string) => {
      const enName = term.name?.toLowerCase().trim();
      const cnName = term.name_cn?.toLowerCase().trim();
      if (enName) _nameToHpoId.set(enName, id);
      if (cnName && cnName !== enName) _nameToHpoId.set(cnName, id);
    });

    _synDataLoaded = true;
  } catch (err) {
    console.warn('[同义词] 加载 hpo_names.txt 失败，同义词扩展将跳过:', (err as Error).message);
    _namesLines = [];
    _namesTrigramIndex = new Map();
    _nameToHpoId = new Map();
    _synDataLoaded = true; // 标记已尝试，避免反复重试
  }
}

/** 计算字符 bigram Jaccard 相似度 */
function scoreCharOverlap(query: string, candidate: string): number {
  const queryNgrams = new Set(extractCharNgrams(query.toLowerCase(), 2));
  const candNgrams = extractCharNgrams(candidate.toLowerCase(), 2);
  if (queryNgrams.size === 0 || candNgrams.length === 0) return 0;
  const intersection = candNgrams.filter(tg => queryNgrams.has(tg)).length;
  const union = queryNgrams.size + candNgrams.length - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 在 hpo_names 中搜索与 symptomWord 相似的名称 */
function searchSynonymsInNames(symptomWord: string, topK: number = 8): string[] {
  if (symptomWord.length < 3) return [];

  // 粗筛：trigram 命中计数
  const trigrams = extractCharNgrams(symptomWord.toLowerCase(), 3);
  const lineHits = new Map<number, number>();
  for (const tg of trigrams) {
    const matches = _namesTrigramIndex.get(tg);
    if (!matches) continue;
    for (const lineIdx of matches) {
      lineHits.set(lineIdx, (lineHits.get(lineIdx) || 0) + 1);
    }
  }

  if (lineHits.size === 0) return [];

  // 取 hit 数前 100 行做精细评分
  const top100 = Array.from(lineHits.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);

  const scored = top100.map(([lineIdx]) => ({
    lineIdx,
    name: _namesLines[lineIdx],
    score: scoreCharOverlap(symptomWord, _namesLines[lineIdx]),
  }));

  return scored
    .filter(s => s.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.name);
}

/** 将匹配到的名称解析为 HPO ID */
function resolveNamesToHpoIds(matchedNames: string[]): string[] {
  const idSet = new Set<string>();
  for (const name of matchedNames) {
    const hpoId = _nameToHpoId.get(name.toLowerCase().trim());
    if (hpoId) idSet.add(hpoId);
  }
  return Array.from(idSet);
}

/** 同义词扩展：对症状词搜索 hpo_names，返回额外候选 HPO ID */
function expandSynonyms(
  symptomWords: string[],
  hpoMap: Map<string, any>,
  topKPerWord: number = 8,
): string[] {
  loadSynonymData();
  if (_namesLines.length === 0) return [];

  const allIds = new Set<string>();
  for (const word of symptomWords) {
    if (word.length < 2) continue;
    const synonyms = searchSynonymsInNames(word, topKPerWord);
    const ids = resolveNamesToHpoIds(synonyms);
    for (const id of ids) {
      if (hpoMap.has(id)) allIds.add(id);
    }
  }
  return Array.from(allIds);
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
 * 构建严格格式约束的匹配系统提示词
 */
function buildMatchSystemPrompt(candidateTable: string): string {
  return `# Role
你是一位HPO术语匹配专家。请从候选术语表中选出最匹配输入症状的HPO术语。

# JSON Schema（严格约束）
返回一个JSON数组，每个元素必须包含以下字段：

| 字段       | 类型   | 约束                                          |
|-----------|--------|-----------------------------------------------|
| hpo_id    | string | 格式 "HP:XXXXXXX"，必须来自候选术语表           |
| confidence | string | 枚举值，仅允许: "高"、"中"、"低"               |
| remark    | string | 格式 "【症状词】→ 匹配理由"                    |

**严禁**输出任何非JSON文本（包括解释、Markdown代码块标记、前后空格以外的字符）。
仅输出裸JSON数组，例如：[{"hpo_id":"HP:XXXXXXX","confidence":"高","remark":"【症状词】→ 理由"}]

# Rules
1. 只从候选术语表中选取，严禁编造或使用表外HPO ID
2. 优先选择最精确匹配的具体术语，避免宽泛的父级术语
3. 当症状可匹配多个层级时，选择最特异的子级术语
4. 最多返回10个术语；若无合适匹配，返回空数组 []
5. 结果按 confidence 降序排列（高 > 中 > 低），同级别则具体术语在前

# Confidence 判定标准
- **高**：症状描述与术语名称/定义精确对应，无语义歧义，可直接确认
- **中**：症状与术语含义大体一致，但存在细微差异、术语范围偏大、或需推断
- **低**：症状与术语仅部分相关，或术语是一个过于宽泛的父级分类

# Remark 格式
- remark 必须使用格式：**【{原始症状词}】→ {一句话匹配理由}**
- 理由必须简短、具体，说明匹配依据
- 示例："【头晕】→ 症状名称直接匹配HPO术语"
- 示例："【肢体无力】→ 核心症状，与偏瘫高度相关"

# Few-shot Examples

## Example 1
候选术语表（HP:ID|英文名|中文名|中文定义）：
---
HP:0002321|Vertigo|眩晕|一种自我或周围环境旋转的不适感觉
HP:0001250|Seizure|癫痫发作|大脑异常放电引起的短暂症状
HP:0000822|Hypertension|高血压|动脉血压持续高于正常范围
---

输入症状："眩晕、乏力"
输出：
[{"hpo_id":"HP:0002321","confidence":"高","remark":"【眩晕】→ 症状名称精确匹配HPO术语"}]

（说明：乏力无合适对应术语，故仅返回眩晕一项）

## Example 2
候选术语表（HP:ID|英文名|中文名|中文定义）：
---
HP:0000822|Hypertension|高血压|动脉血压持续升高
HP:0001279|Syncope|晕厥|短暂意识丧失，由脑部血流减少引起
HP:0012622|Chronic kidney disease|慢性肾脏病|肾功能持续下降
HP:0000077|Abnormality of the kidney|肾异常|肾脏结构或功能异常
---

输入症状："高血压，晕厥，慢性肾病"
输出：
[{"hpo_id":"HP:0000822","confidence":"高","remark":"【高血压】→ 症状名称精确匹配"},
{"hpo_id":"HP:0001279","confidence":"高","remark":"【晕厥】→ 症状名称精确匹配"},
{"hpo_id":"HP:0012622","confidence":"高","remark":"【慢性肾病】→ 优先选择具体术语'慢性肾脏病'，而非宽泛的'肾异常'"}]

# 候选HPO术语表（HP:ID|英文名|中文名|中文定义）
---
${candidateTable}
---`;
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

    // 同义词扩展：从 hpo_names.txt 补充候选术语
    console.log('同义词扩展...');
    const synonymIds = expandSynonyms(symptomWords, hpoMap);
    let synonymAdded = 0;
    for (const hpoId of synonymIds) {
      if (!termMap.has(hpoId)) {
        const term = hpoMap.get(hpoId);
        if (term) {
          termMap.set(hpoId, { term, matchedWords: ['synonym'], score: 0.5 });
          synonymAdded++;
        }
      }
    }
    console.log(`同义词扩展: 新增 ${synonymAdded} 个候选术语`);

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
        system: buildMatchSystemPrompt(candidateTable),
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

          // 同义词扩展：从 hpo_names.txt 补充候选术语
          console.log('同义词扩展...');
          const synonymIds = expandSynonyms(symptomWords, hpoMap);
          let synonymAdded = 0;
          for (const hpoId of synonymIds) {
            if (!termMap.has(hpoId)) {
              const term = hpoMap.get(hpoId);
              if (term) {
                termMap.set(hpoId, { term, matchedWords: ['synonym'], score: 0.5 });
                synonymAdded++;
              }
            }
          }
          console.log(`同义词扩展: 新增 ${synonymAdded} 个候选术语`);

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
              system: buildMatchSystemPrompt(candidateTable),
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
