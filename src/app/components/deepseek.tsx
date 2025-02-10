// deepseek-V3 使用硅基流动API

import React, { useState } from 'react';

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
  token: string;
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

const parseResponseToTableData = (response: string): TableData[] => {
  const lines = response.split('\n').filter(line => line.startsWith('|'));
  const tableData: TableData[] = [];

  lines.slice(2).forEach(line => {
    const columns = line.split('|').map(col => col.trim()).filter(Boolean);
    if (columns.length >= 5) {
      tableData.push({
        hpo: columns[0],
        name: columns[1],
        chineseName: columns[2],
        destination: '',
        description: columns[1], // 使用英文术语作为描述
        confidence: columns[3],
        remark: columns[4] || ''
      });
    }
  });

  return tableData;
};

export const query = async ({ token, question }: DeepSeekProps): Promise<TableData[]> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15秒超时

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
      }),
      signal: controller.signal
    };

    const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
    clearTimeout(timeout);
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
