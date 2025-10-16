// HPO术语匹配组件
import HPOSearchEngine from '@/lib/hpoSearchEngine';
import { preprocessWithLLM, preprocessResultToQuery } from '@/lib/llmPreprocessor';

interface LLMQueryProps {
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

/**
 * 搜索相关HPO术语
 */
async function searchRelevantTerms(query: string, maxTerms: number = 20): Promise<string> {
  try {
    const searchEngine = HPOSearchEngine.getInstance();
    await searchEngine.initialize();
    
    // 将查询字符串拆分为单个症状词
    const symptoms = query.split(/[、，,；;]/).map(s => s.trim()).filter(s => s.length > 0);
    console.log(`📝 拆分为 ${symptoms.length} 个症状:`, symptoms);
    
    // 为每个症状搜索HPO术语
    const allTerms = new Map<string, any>();
    
    for (const symptom of symptoms) {
      const terms = await searchEngine.findRelevantTerms(symptom, 3);
      terms.forEach(term => {
        if (!allTerms.has(term.id)) {
          allTerms.set(term.id, term);
        }
      });
    }
    
    const uniqueTerms = Array.from(allTerms.values()).slice(0, maxTerms);
    
    if (uniqueTerms.length === 0) {
      console.warn('⚠️  未找到相关HPO术语');
      return '';
    }
    
    console.log(`✅ 找到 ${uniqueTerms.length} 个相关HPO术语`);
    
    let context = '以下是可能相关的HPO术语，请优先从中选择匹配:\n\n';
    uniqueTerms.forEach(term => {
      context += `${term.id} | ${term.name} | ${term.name_cn}\n${term.definition_cn}\n\n`;
    });
    
    return context;
  } catch (error) {
    console.error('❌ 搜索HPO术语失败:', error);
    return '';
  }
}

const parseResponseToTableData = async (response: string): Promise<TableData[]> => {
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

    const searchEngine = HPOSearchEngine.getInstance();
    const tableData: TableData[] = [];
    
    // 批量获取HPO ID
    const hpoIds = lines.slice(2)
      .map(line => {
        const columns = line.split('|').map(col => col.trim()).filter(Boolean);
        return columns.length >= 5 ? columns[0].trim() : null;
      })
      .filter(Boolean) as string[];
    
    const hpoTerms = searchEngine.getTerms(hpoIds);
    const termMap = new Map(hpoTerms.map(t => [t.id, t]));
    
    lines.slice(2).forEach(line => {
      const columns = line.split('|').map(col => col.trim()).filter(Boolean);
      if (columns.length >= 5) {
        const hpoId = columns[0].trim();
        const hpoTerm = termMap.get(hpoId);
        
        if (hpoTerm) { // 只保留json中存在的术语
          tableData.push({
            hpo: hpoId,
            name: hpoTerm.name,
            chineseName: hpoTerm.name_cn,
            destination: hpoTerm.definition,
            description: hpoTerm.definition_cn,
            confidence: columns[3],
            remark: columns[4] || ''
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

// 通用LLM查询函数 - 兼容OpenAI格式的API
export const query = async ({ question, apiUrl: customApiUrl, apiKey: customApiKey, model: customModel }: LLMQueryProps): Promise<TableData[]> => {
  try {
    // 配置优先级：用户页面设置 > 环境变量 > 默认值/报错
    // 注意：空字符串''也算"未设置"，需要fallback到环境变量
    // 优先使用.env.local中的配置，避免系统环境变量干扰
    const token = (customApiKey?.trim() || undefined) || 
                  process.env.NEXT_PUBLIC_OPENAI_API_KEY || 
                  process.env.OPENAI_API_KEY;
    const apiUrl = (customApiUrl?.trim() || undefined) || 
                   process.env.NEXT_PUBLIC_OPENAI_API_URL || 
                   process.env.OPENAI_API_URL || 
                   'https://api.siliconflow.cn/v1/chat/completions';
    const model = (customModel?.trim() || undefined) || 
                  process.env.NEXT_PUBLIC_OPENAI_MODEL || 
                  process.env.OPENAI_MODEL || 
                  'deepseek-ai/DeepSeek-V3';

    // 简化的配置日志
    console.log('🔧 API配置:', {
      apiUrl: apiUrl,
      model: model,
      hasKey: !!token
    });

    if (!token) {
      console.error('❌ API Key未找到！');
      console.error('传入的customApiKey:', customApiKey);
      console.error('环境变量OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '存在但未显示' : '不存在');
      throw new Error('API Key未配置 - 请在页面设置中配置或在.env文件中添加OPENAI_API_KEY。如果已配置.env，请确保已重启服务器！');
    }

    // 使用LLM进行智能预处理
    const llmPreprocessed = await preprocessWithLLM(question, {
      apiUrl: customApiUrl,
      apiKey: customApiKey,
      model: customModel
    });
    
    // 转换为查询字符串
    let cleanedQuestion = preprocessResultToQuery(llmPreprocessed);
    
    console.log('🔍 LLM预处理:', {
      症状: llmPreprocessed.symptoms,
      既往病史: llmPreprocessed.medicalHistory,
      诊断: llmPreprocessed.diagnosis,
      查询字符串: cleanedQuestion
    });
    
    // 如果LLM预处理返回空结果，使用原始输入
    if (!cleanedQuestion || cleanedQuestion.trim().length === 0) {
      console.warn('⚠️  预处理返回空，使用原始输入');
      cleanedQuestion = question;
    }
    
    // 生成警告信息
    const preprocessWarnings: string[] = [];
    if (llmPreprocessed.negatedSymptoms.length > 0) {
      preprocessWarnings.push(`检测到否定症状: ${llmPreprocessed.negatedSymptoms.join('、')}`);
    }
    if (llmPreprocessed.familyHistory.length > 0) {
      preprocessWarnings.push(`检测到家族史: ${llmPreprocessed.familyHistory.join('、')}`);
    }
    if (preprocessWarnings.length > 0) {
      console.log('⚠️  警告:', preprocessWarnings.join('; '));
    }
    
    // 检查清理后是否还有内容
    if (!cleanedQuestion || cleanedQuestion.trim().length === 0) {
      console.warn('⚠️  查询清理后为空，可能全是否定症状或家族史');
      return [{
        hpo: 'HP:0000001',
        name: 'No Valid Symptoms',
        chineseName: '无有效症状',
        destination: '查询中仅包含否定症状或家族史',
        description: preprocessWarnings.join('\n'),
        confidence: '-',
        remark: '请描述患者本人存在的症状'
      }];
    }
    
    // 搜索相关HPO术语
    const relevantTermsContext = await searchRelevantTerms(cleanedQuestion, 20);
    
    console.log('🔎 开始匹配HPO术语...');

    // OpenAI格式的API调用
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
          content: `你是HPO术语匹配专家。你的任务是将临床症状描述精确匹配到HPO术语。

**匹配规则**：
1. 只匹配输入中明确提到的症状
2. 不要推断、不要补充、不要从诊断推导症状
3. 优先使用参考信息中的HPO术语
4. 每个症状对应一个最合适的HPO术语
5. 最多返回5个术语

**输出格式**（Markdown表格）：
| HPO ID | 英文术语 | 中文译名 | 置信度 | 备注 |
|--------|---------|---------|--------|------|
| HP:XXXXXXX | English Term | 中文 | 高/中/低 | 说明 |

${relevantTermsContext ? `**参考HPO术语**：\n${relevantTermsContext}` : ''}`
        }, {
          role: 'user',
          content: `请为以下症状匹配HPO术语：

${cleanedQuestion}

注意：只匹配上述明确提到的症状，不要添加其他内容。`
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
    
    // 检查HTTP状态码
    if (!analysisRes.ok) {
      const errorText = await analysisRes.text();
      console.error('API HTTP Error:', {
        status: analysisRes.status,
        statusText: analysisRes.statusText,
        body: errorText
      });
      throw new Error(`API请求失败 (${analysisRes.status}): ${errorText.substring(0, 200)}`);
    }
    
    const analysisText = await analysisRes.text();
    
    if (!analysisText) {
      throw new Error('API返回空响应');
    }

    let analysisData;
    try {
      analysisData = JSON.parse(analysisText);
    } catch (jsonError) {
      console.error('JSON解析错误:', jsonError);
      console.error('原始响应:', analysisText.substring(0, 500));
      throw new Error(`无效的JSON响应: ${analysisText.substring(0, 100)}`);
    }


    if (!analysisData.choices || analysisData.choices.length === 0) {
      console.error('完整API响应:', JSON.stringify(analysisData, null, 2));
      throw new Error(`API响应中没有choices字段。响应结构: ${JSON.stringify(Object.keys(analysisData))}`);
    }

    return await parseResponseToTableData(analysisData.choices[0].message.content);
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
