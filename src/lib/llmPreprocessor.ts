/**
 * LLM预处理器
 * 使用LLM进行智能文本预处理，提取患者实际症状
 */

export interface LLMPreprocessResult {
  symptoms: string[];              // 提取的症状列表
  medicalHistory: string[];        // 既往病史
  diagnosis: string[];             // 诊断
  negatedSymptoms: string[];       // 否定症状
  familyHistory: string[];         // 家族史
  rawExtraction: string;           // LLM原始输出
  processingTime: number;          // 处理耗时
}

/**
 * 使用LLM进行预处理
 */
export async function preprocessWithLLM(
  input: string,
  apiConfig: {
    apiUrl?: string;
    apiKey?: string;
    model?: string;
  }
): Promise<LLMPreprocessResult> {
  const startTime = Date.now();
  
  try {
    // 获取API配置
    const token = (apiConfig.apiKey?.trim() || undefined) || 
                  process.env.NEXT_PUBLIC_OPENAI_API_KEY || 
                  process.env.OPENAI_API_KEY;
    const apiUrl = (apiConfig.apiUrl?.trim() || undefined) || 
                   process.env.NEXT_PUBLIC_OPENAI_API_URL || 
                   process.env.OPENAI_API_URL || 
                   'https://api.siliconflow.cn/v1/chat/completions';
    const model = (apiConfig.model?.trim() || undefined) || 
                  process.env.NEXT_PUBLIC_OPENAI_MODEL || 
                  process.env.OPENAI_MODEL || 
                  'deepseek-ai/DeepSeek-V3';

    if (!token) {
      throw new Error('API Key未配置');
    }


    // 构建预处理Prompt
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{
          role: 'system',
          content: `你是一位临床文本分析专家。请从病历中提取患者当前存在的症状和体征。

**严格规则**：
1. **提取患者本人当前存在的症状**，包括：
   - 主诉中的症状（如"发作性认知障碍"、"头晕"、"乏力"等）
   - 现病史中描述的所有阳性症状和体征
   - 既往病史中的疾病名称（如"脑梗死"、"肝硬化"等）
   - 拟诊断的疾病名称

2. **不要提取**：
   - 否定症状（如"无头痛"、"否认发热"、"无恶心"）
   - 家族史（如"父亲高血压"、"哥哥肾病"）
   - 推断的症状（不要从诊断推断未提及的症状）

3. **输出格式**（JSON）：
{
  "symptoms": ["症状1", "症状2", ...],
  "medicalHistory": ["既往疾病1", "既往疾病2", ...],
  "diagnosis": ["诊断1", "诊断2", ...],
  "negatedSymptoms": ["否定症状1", "否定症状2", ...],
  "familyHistory": ["家族史1", "家族史2", ...]
}

**重要提示**：
- symptoms数组应包含所有阳性症状和体征的描述
- medicalHistory应包含既往病史中提到的疾病
- diagnosis应包含拟诊断或入院诊断
- 将所有阳性表现都放入symptoms中，不要遗漏

**示例1**：
输入："患者有头晕，无头痛，父亲高血压。既往病史：糖尿病"
输出：
{
  "symptoms": ["头晕"],
  "medicalHistory": ["糖尿病"],
  "diagnosis": [],
  "negatedSymptoms": ["头痛"],
  "familyHistory": ["父亲高血压"]
}

**示例2**：
输入："发作性认知障碍1天余；患者于1天余前出现认知障碍，表现为记忆力下降、认字困难，伴头晕。既往病史：脑梗死、肝硬化。拟'脑梗死'收入我科。"
输出：
{
  "symptoms": ["发作性认知障碍", "记忆力下降", "认字困难", "头晕"],
  "medicalHistory": ["脑梗死", "肝硬化"],
  "diagnosis": ["脑梗死"],
  "negatedSymptoms": [],
  "familyHistory": []
}`
        }, {
          role: 'user',
          content: input
        }],
        temperature: 0.1,  // 低温度，更确定
        max_tokens: 1024,
        response_format: { type: "json_object" }  // 要求JSON输出
      })
    });

    if (!response.ok) {
      throw new Error(`LLM预处理失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ API响应格式错误:', JSON.stringify(data, null, 2));
      throw new Error('API响应格式错误');
    }
    
    const rawOutput = data.choices[0].message.content;

    // 解析JSON输出
    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch (e) {
      console.error('❌ JSON解析失败:', e);
      console.error('原始输出:', rawOutput);
      throw new Error(`JSON解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }

    const result: LLMPreprocessResult = {
      symptoms: parsed.symptoms || [],
      medicalHistory: parsed.medicalHistory || [],
      diagnosis: parsed.diagnosis || [],
      negatedSymptoms: parsed.negatedSymptoms || [],
      familyHistory: parsed.familyHistory || [],
      rawExtraction: rawOutput,
      processingTime: Date.now() - startTime
    };


    return result;

  } catch (error) {
    console.error('❌ LLM预处理错误:', error);
    console.error('错误详情:', error instanceof Error ? error.message : String(error));
    
    // 失败时抛出错误，让上层处理fallback
    throw error;
  }
}

/**
 * 将预处理结果转换为查询字符串
 */
export function preprocessResultToQuery(result: LLMPreprocessResult): string {
  const allItems = [
    ...result.symptoms,
    ...result.medicalHistory,
    ...result.diagnosis
  ];
  
  return allItems.join('、');
}

export default {
  preprocessWithLLM,
  preprocessResultToQuery
};
