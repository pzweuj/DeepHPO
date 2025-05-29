// deepseek-V3 使用硅基流动API
interface DeepSeekResponse {
  // 定义API返回的数据结构
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

interface DeepSeekProps {
  question: string;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
}

interface TableData {
  hpo: string;
  name: string;
  chineseName: string;
  destination: string;
  description: string;
  confidence: string;
  remark: string;
}

// 新增hpo术语数据导入
const hpoTerms = require('/public/hpo_terms_cn.json') as Record<string, {
  id: string;
  name: string;
  definition: string;
  name_cn: string;
  definition_cn: string;
}>;

// 改进的分词和相似度匹配函数
const findRelevantTerms = (input: string, maxTerms: number = 8): string => {
  if (!input || input.trim() === '') return '';
  
  // 检测输入是否包含中文
  const hasChinese = /[\u4e00-\u9fa5]/.test(input);
  
  // 增强分词：处理中英文混合情况
  const words = input
    .toLowerCase()
    .replace(/[,.;:?!，。；：？！、]/g, ' ') // 增加更多标点符号
    .split(/\s+/)
    .filter(word => word.length > 1) // 过滤掉单字符词
    .map(word => word.trim());
  
  // 提取可能的医学术语短语（2-4个词的组合）
  const phrases: string[] = [];
  for (let i = 0; i < words.length; i++) {
    phrases.push(words[i]); // 单词
    if (i + 1 < words.length) phrases.push(`${words[i]} ${words[i+1]}`); // 双词组合
    if (i + 2 < words.length) phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`); // 三词组合
    if (i + 3 < words.length) phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]} ${words[i+3]}`); // 四词组合
  }
  
  // 中文分词处理
  if (hasChinese) {
    // 按字符分割中文，创建2-4字符的滑动窗口
    const chineseChars = input.match(/[\u4e00-\u9fa5]/g) || [];
    for (let i = 0; i < chineseChars.length; i++) {
      phrases.push(chineseChars[i]); // 单字符
      if (i + 1 < chineseChars.length) phrases.push(chineseChars.slice(i, i+2).join(''));
      if (i + 2 < chineseChars.length) phrases.push(chineseChars.slice(i, i+3).join(''));
      if (i + 3 < chineseChars.length) phrases.push(chineseChars.slice(i, i+4).join(''));
    }
  }
  
  // 记录每个术语的匹配分数
  const termScores: Record<string, number> = {};
  
  // 遍历所有HPO术语
  Object.entries(hpoTerms).forEach(([id, term]) => {
    let score = 0;
    const termNameLower = term.name.toLowerCase();
    const termNameCnLower = term.name_cn.toLowerCase();
    const termDefLower = term.definition.toLowerCase();
    const termDefCnLower = term.definition_cn.toLowerCase();
    
    // 检查每个词/短语是否在术语中出现
    phrases.forEach(phrase => {
      const phraseLower = phrase.toLowerCase();
      
      // 精确匹配（完全匹配术语名称）
      if (termNameLower === phraseLower || termNameCnLower === phraseLower) {
        score += 10; // 精确匹配权重最高
      }
      
      // 部分匹配（包含关系）
      else {
        // 英文名称匹配
        if (termNameLower.includes(phraseLower)) {
          score += 3 + (phraseLower.length / termNameLower.length) * 2; // 匹配度越高分数越高
        }
        // 中文名称匹配
        if (termNameCnLower.includes(phraseLower)) {
          score += 3 + (phraseLower.length / termNameCnLower.length) * 2;
        }
        // 英文定义匹配
        if (termDefLower.includes(phraseLower)) {
          score += 1 + (phraseLower.length / Math.min(100, termDefLower.length)) * 0.5;
        }
        // 中文定义匹配
        if (termDefCnLower.includes(phraseLower)) {
          score += 1 + (phraseLower.length / Math.min(100, termDefCnLower.length)) * 0.5;
        }
      }
    });
    
    // HPO ID直接匹配（如果用户输入了HPO ID）
    if (input.toUpperCase().includes(id)) {
      score += 15; // ID匹配权重最高
    }
    
    if (score > 0) {
      termScores[id] = score;
    }
  });
  
  // 按分数排序并获取前N个最相关的术语
  const topTerms = Object.entries(termScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([id]) => id);
  
  // 构建相关术语的上下文信息
  let context = "";
  if (topTerms.length > 0) {
    context = "参考以下可能相关的HPO术语:\n";
    topTerms.forEach(id => {
      const term = hpoTerms[id];
      context += `- ${id} (${term.name}/${term.name_cn}): ${term.definition_cn}\n`;
    });
  }
  
  return context;
};

const parseResponseToTableData = (response: string): TableData[] => {
  try {
    // 增加空响应检查
    if (!response || typeof response !== 'string') {
      throw new Error('Invalid or empty response');
    }

    const lines = response.split('\n').filter(line => line.startsWith('|'));
    // 增加有效行数检查
    if (lines.length < 3) {
      throw new Error('Response does not contain valid table data');
    }

    const tableData: TableData[] = [];
    lines.slice(2).forEach(line => {
      const columns = line.split('|').map(col => col.trim()).filter(Boolean);
      if (columns.length >= 5) {
        const hpoId = columns[0].trim();
        const hpoTerm = hpoTerms[hpoId];
        
        if (hpoTerm) { // 只保留json中存在的术语
          tableData.push({
            hpo: hpoId,
            name: hpoTerm.name, // 使用json中的英文术语
            chineseName: hpoTerm.name_cn, // 使用json中的中文译名
            destination: hpoTerm.definition, // 使用英文定义作为描述
            description: hpoTerm.definition_cn, // 使用中文定义作为描述
            confidence: columns[3], // 保留原始置信度
            remark: columns[4] || '' // 保留原始备注
          });
        }
      }
    });

    // 增加空结果检查
    if (tableData.length === 0) {
      throw new Error('No valid HPO terms found in response');
    }

    return tableData;
  } catch (error) {
    console.error('Parsing error:', error);
    // 返回包含错误信息的默认行
    return [{
      hpo: 'HP:0000001',
      name: 'Parsing Error',
      chineseName: '解析错误',
      destination: '无法解析API响应',
      description: error instanceof Error ? error.message : '未知解析错误',
      confidence: '-',
      remark: '请检查输入格式'
    }];
  }
};

// 单轮查询函数
export const query = async ({ question, apiUrl: customApiUrl, apiKey: customApiKey, model: customModel }: DeepSeekProps): Promise<TableData[]> => {
  try {
    // 优先使用传入的API配置，如果没有则使用环境变量
    const token = customApiKey || process.env.DEEPSEEK_API_KEY;
    const apiUrl = customApiUrl || 'https://api.siliconflow.cn/v1/chat/completions';
    const model = customModel || 'deepseek-ai/DeepSeek-V3';

    if (!token) {
      throw new Error('API Key未配置');
    }

    // 获取相关术语作为上下文
    const relevantTermsContext = findRelevantTerms(question, 12);
    
    console.log('Processing query:', question.substring(0, 30) + '...');

    // 单轮分析
    const analysisOptions = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: `${model}`,
        messages: [{
          role: 'system',
          content: `你是一位资深临床遗传学专家，擅长使用人类表型本体（HPO）进行精准表型分析。请按照以下要求处理临床特征信息：
          
          1. **术语规范**
          - 严格使用HPO最新官方术语
          - 仅匹配HPO明确收录的表型，拒绝推测性描述
          - 优先匹配特异性高的表型术语
          - 不要输出否定或患者不存在的表型
          - 不要输出没有把握的信息
          - 输出结果数目不要超过5个
          - 严格限制在用户描述的表型范畴内，不要过度推断
          - 优先考虑参考信息中提供的表型
          
          2. **分析流程**
          ① 特征分解：将复合描述拆解为独立表型要素
          ② 同义词映射：处理"developmental delay"等常见同义表述
          ③ 层级验证：确保所选术语符合HPO本体层级关系
          ④ 证据分级：用"!"标记目测可确认的表型（如畸形类）
          
          3. **输出规范**
          | HPO ID   | 英文术语 (HPO官方名称) | 中文译名 | 置信度 | 备注 |
          |----------|------------------------|----------|--------|------|
          | HP:0001250 | Seizure              | 癫痫发作 | 高     | 直接描述 |
          | HP:0030177 | Palmoplantar keratoderma | 掌跖角化症 | 中   | 需病理证实 |
          
          4. **特殊处理**
          - 对"特殊面容"等模糊描述，应分解为具体特征（如眼距过宽、鼻梁低平等）
          - 对矛盾表述保留原始描述并添加[需复核]标记
          - 实验室指标需标注参考范围
          - 严格遵循用户描述的症状，不要添加用户未提及的症状
          
          ${relevantTermsContext ? `\n5. **参考信息**\n${relevantTermsContext}` : ''}`
        }, {
          role: 'user',
          content: question
        }],
        stream: false,
        max_tokens: 2048,
        temperature: 0.2,
        top_p: 0.5,
        frequency_penalty: 0.2,
        presence_penalty: 0.1
      })
    };

    const analysisRes = await fetch(apiUrl, analysisOptions);
    const analysisText = await analysisRes.text();
    
    if (!analysisText) {
      throw new Error('Empty response from API');
    }

    let analysisData;
    try {
      analysisData = JSON.parse(analysisText);
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      throw new Error(`Invalid JSON response: ${analysisText.substring(0, 100)}`);
    }

    if (!analysisData.choices || analysisData.choices.length === 0) {
      throw new Error('No choices in API response');
    }

    return parseResponseToTableData(analysisData.choices[0].message.content);
  } catch (error) {
    console.error('API Error:', error);
    return [{
      hpo: 'HP:0000001',
      name: 'API Error',
      chineseName: 'API错误',
      destination: 'API请求失败',
      description: error instanceof Error ? error.message : '未知API错误',
      confidence: '-',
      remark: '请稍后重试'
    }];
  }
};

// 添加默认导出
export default {
  query
};
