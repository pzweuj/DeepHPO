// 通用LLM API调用组件 - 兼容OpenAI格式的任何端点
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

import HPOSearchEngine from '@/lib/hpoSearchEngine';
import { getTermCount, LLMConfig } from '@/config/llm.config';
import { preprocessQuery, isValidQuery, formatWarnings } from '@/lib/queryPreprocessor';

// 使用搜索引擎查找相关术语
const findRelevantTerms = async (input: string, maxTerms: number = 12): Promise<string> => {
  if (!input || input.trim() === '') return '';
  
  try {
    const searchEngine = HPOSearchEngine.getInstance();
    const relevantTerms = await searchEngine.findRelevantTerms(input, maxTerms);
    
    if (relevantTerms.length === 0) return '';
    
    // 构建相关术语的上下文信息
    let context = "参考以下可能相关的HPO术语:\n";
    relevantTerms.forEach(term => {
      context += `- ${term.id} (${term.name}/${term.name_cn}): ${term.definition_cn}\n`;
    });
    
    return context;
  } catch (error) {
    console.error('Error finding relevant terms:', error);
    return '';
  }
};

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

    // 调试日志 - 服务端
    console.log('=== 服务端环境变量检查 ===');
    console.log('process.env.OPENAI_API_KEY存在:', !!process.env.OPENAI_API_KEY);
    console.log('process.env.OPENAI_API_KEY前缀:', process.env.OPENAI_API_KEY?.substring(0, 10));
    console.log('process.env.OPENAI_API_URL:', process.env.OPENAI_API_URL);
    console.log('process.env.OPENAI_MODEL:', process.env.OPENAI_MODEL);
    
    console.log('\nAPI配置来源:', {
      customKey: customApiKey ? (customApiKey.trim() ? '✅ 用户设置' : '❌ 空字符串') : '❌ 未传递',
      envKey: process.env.OPENAI_API_KEY ? '✅ 环境变量' : '❌ 未配置',
      finalKey: token ? `✅ 使用: ${token.substring(0, 10)}...` : '❌ 无可用Key',
      apiUrl: apiUrl,
      model: model
    });

    if (!token) {
      console.error('❌ API Key未找到！');
      console.error('传入的customApiKey:', customApiKey);
      console.error('环境变量OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '存在但未显示' : '不存在');
      throw new Error('API Key未配置 - 请在页面设置中配置或在.env文件中添加OPENAI_API_KEY。如果已配置.env，请确保已重启服务器！');
    }

    // 预处理查询：过滤否定症状和家族史
    const preprocessed = preprocessQuery(question);
    
    // 记录预处理结果
    if (preprocessed.warnings.length > 0) {
      console.log('⚠️  查询预处理:');
      console.log(formatWarnings(preprocessed));
      console.log(`原始查询: ${question}`);
      console.log(`清理后: ${preprocessed.cleanedQuery}`);
    }
    
    // 检查清理后是否还有内容
    if (!isValidQuery(preprocessed)) {
      console.warn('⚠️  查询清理后为空，可能全是否定症状或家族史');
      return [{
        hpo: 'HP:0000001',
        name: 'No Valid Symptoms',
        chineseName: '无有效症状',
        destination: '查询中仅包含否定症状或家族史',
        description: formatWarnings(preprocessed),
        confidence: '-',
        remark: '请描述患者本人存在的症状'
      }];
    }
    
    // 使用清理后的查询进行后续处理
    const cleanedQuestion = preprocessed.cleanedQuery;
    
    // 动态调整相关术语数量：根据查询复杂度自适应
    // 配置可在 src/config/llm.config.ts 中调整
    const queryLength = cleanedQuestion.length;
    const maxTerms = getTermCount(queryLength);
    
    if (LLMConfig.debug.logSearchTerms) {
      console.log(`查询长度: ${queryLength}, 使用术语数: ${maxTerms}`);
    }
    
    const startTime = Date.now();
    // 使用清理后的查询搜索相关术语
    const relevantTermsContext = await findRelevantTerms(cleanedQuestion, maxTerms);
    
    if (LLMConfig.debug.logTiming) {
      console.log(`搜索相关术语耗时: ${Date.now() - startTime}ms`);
    }
    
    console.log('Processing query:', cleanedQuestion.substring(0, 30) + '...');

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
          content: `你是一位资深临床遗传学专家，擅长使用人类表型本体（HPO）进行精准表型分析。请按照以下要求处理临床特征信息：
          
          1. **术语规范**
          - 严格使用HPO最新官方术语
          - 仅匹配HPO明确收录的表型，拒绝推测性描述
          - 优先匹配特异性高的表型术语
          - **严禁输出否定症状**：如果描述中出现"无"、"否认"、"没有"等否定词，则完全忽略该症状
          - **严禁输出家族史**：如果描述中出现"父亲"、"母亲"、"哥哥"、"姐姐"、"家族"等，则完全忽略该症状
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
          content: cleanedQuestion  // 使用清理后的查询
        }],
        stream: false,
        max_tokens: LLMConfig.apiParams.maxTokens,
        temperature: LLMConfig.apiParams.temperature,
        top_p: LLMConfig.apiParams.topP,
        frequency_penalty: LLMConfig.apiParams.frequencyPenalty,
        presence_penalty: LLMConfig.apiParams.presencePenalty
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

    // 详细输出API响应结构以便调试
    console.log('API响应结构:', {
      hasChoices: !!analysisData.choices,
      choicesLength: analysisData.choices?.length,
      keys: Object.keys(analysisData),
      firstChoice: analysisData.choices?.[0] ? Object.keys(analysisData.choices[0]) : null
    });

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
