// deepseek-V3 使用腾讯云API
// 注1: 我的资源在2025年4月10日到期
// 注2: 调用的是腾讯云大模型知识引擎接口，已部署提示词以及HPO知识库，准确度更高

import { v4 as uuidv4 } from 'uuid';

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

// 导入 HPO 术语数据
const hpoTerms = require('/public/hpo_terms_cn.json') as Record<
  string,
  {
    id: string;
    name: string;
    definition: string;
    name_cn: string;
    definition_cn: string;
  }
>;

// 解析 API 响应为表格数据
const parseResponseToTableData = (response: string): TableData[] => {
  try {
    if (!response || typeof response !== 'string') {
      throw new Error('Invalid or empty response');
    }

    const lines = response.split('\n').filter((line) => line.startsWith('|'));
    if (lines.length < 3) {
      throw new Error('Response does not contain valid table data');
    }

    const tableData: TableData[] = [];
    lines.slice(2).forEach((line) => {
      const columns = line
        .split('|')
        .map((col) => col.trim())
        .filter(Boolean);

      if (columns.length >= 5) {
        const hpoId = columns[0].trim();
        const hpoTerm = hpoTerms[hpoId];

        if (hpoTerm) {
          tableData.push({
            hpo: hpoId,
            name: hpoTerm.name,
            chineseName: hpoTerm.name_cn,
            destination: hpoTerm.definition,
            description: hpoTerm.definition_cn,
            confidence: columns[3],
            remark: columns[4] || '',
          });
        }
      }
    });

    if (tableData.length === 0) {
      throw new Error('No valid HPO terms found in response');
    }

    return tableData;
  } catch (error) {
    console.error('Parsing error:', error);
    return [
      {
        hpo: 'HP:0000001',
        name: 'Parsing Error',
        chineseName: '解析错误',
        destination: '无法解析API响应',
        description: error instanceof Error ? error.message : '未知解析错误',
        confidence: '-',
        remark: '请检查输入格式',
      },
    ];
  }
};

// 查询函数
export const query = async ({ question }: DeepSeekProps): Promise<TableData[]> => {
  const BOT_APP_KEY = process.env.LKE_APP_KEY; // 从环境变量获取机器人密钥
  const VISITOR_BIZ_ID = uuidv4(); // 使用 UUID 生成访客 ID
  const sessionId = uuidv4(); // 使用 UUID 生成唯一的会话 ID

  const reqData = {
    content: question,
    bot_app_key: BOT_APP_KEY,
    visitor_biz_id: VISITOR_BIZ_ID,
    session_id: sessionId,
    streaming_throttle: 1, // 节流控制
  };

  try {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream', // 流式响应
      },
      body: JSON.stringify(reqData),
    };

    const res = await fetch('https://wss.lke.cloud.tencent.com/v1/qbot/chat/sse', options);

    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }

    let fullResponse = ''; // 用于存储完整的响应数据
    const reader = res.body?.getReader();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      fullResponse += chunk; // 拼接所有数据块
    }

    console.log('Full response:', fullResponse); // 打印调试信息

    // 确保 JSON 数据完整
    const lines = fullResponse.split('\n');
    let finalResponse = '';

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const eventData = line.slice(5).trim();
        if (eventData) {
          try {
            const data = JSON.parse(eventData);

            if (data.type === 'reply' && data.payload.is_final) {
              finalResponse = data.payload.content;
            }
          } catch (jsonError) {
            console.error('JSON parsing error for line:', line, jsonError);
            continue; // 忽略无法解析的行
          }
        }
      }
    }

    if (!finalResponse) {
      throw new Error('No final response received from API');
    }

    return parseResponseToTableData(finalResponse);
  } catch (error) {
    console.error('API Error:', error);
    return [
      {
        hpo: 'HP:0000001',
        name: 'API Error',
        chineseName: 'API错误',
        destination: 'API请求失败',
        description: error instanceof Error ? error.message : '未知API错误',
        confidence: '-',
        remark: '请稍后重试',
      },
    ];
  }
};

// 默认导出
export default {
  query,
};