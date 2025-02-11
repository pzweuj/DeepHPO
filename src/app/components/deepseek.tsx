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

const parseResponseToTableData = (response: string): TableData[] => {
  const lines = response.split('\n').filter(line => line.startsWith('|'));
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

  return tableData;
};

export const query = async ({ question }: DeepSeekProps): Promise<TableData[]> => {
  try {
    // 直接从环境变量获取token
    const token = process.env.DEEPSEEK_API_KEY;
    if (!token) {
      throw new Error('DEEPSEEK_API_KEY environment variable not configured');
    }

    // 服务端组件不需要AbortController
    const options = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [{
          role: 'system',
          content: `你是一位资深临床遗传学专家，擅长使用人类表型本体（HPO）进行精准表型分析。请按照以下要求处理临床特征信息：
          1. **术语规范**
          - 严格使用HPO最新官方术语（当前版本：2024-06-01）
          - 仅匹配HPO明确收录的表型，拒绝推测性描述
          - 优先匹配特异性高的表型术语
          - 不要输出否定或患者不存在的表型
          
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
          | HP:0002353 | HP:0002353 | 脑电图异常 | 中   | 直接描述 |
          
          4. **特殊处理**
          - 对"特殊面容"等模糊描述，应分解为具体特征（如眼距过宽、鼻梁低平等）
          - 对矛盾表述（如"身材矮小但四肢细长"）保留原始描述并添加[需复核]标记
          - 实验室指标需标注参考范围（如"碱性磷酸酶升高（＞500 U/L）"）`
        }, {
          role: 'user',
          content: question
        }],
        stream: false,
        max_tokens: 512,
        temperature: 0.3,
        top_p: 0.5,
        frequency_penalty: 0.2,
        presence_penalty: 0.1
      })
    };

    const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
    const data: DeepSeekResponse = await res.json();
    return parseResponseToTableData(data.choices[0].message.content);
  } catch (error) {
    console.error('Error:', error);
    // 返回默认结果
    return [{
      hpo: 'HP:0000001',
      name: 'All',
      chineseName: '所有表型',
      destination: 'deepseek服务器超时',
      description: '请换个时间再试吧',
      confidence: '-',
      remark: '超时'
    }];
  }
};

// 添加默认导出
export default {
  query
};
