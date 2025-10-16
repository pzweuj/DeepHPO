/**
 * LLM配置文件
 * 用于调整HPO术语提取的各项参数
 */

export const LLMConfig = {
  /**
   * 相关术语搜索配置
   */
  relevantTerms: {
    // 动态术语数量阈值
    simple: {
      maxLength: 50,      // 简单查询的最大长度
      termCount: 12,      // 简单查询使用的术语数
    },
    medium: {
      maxLength: 150,     // 中等查询的最大长度
      termCount: 16,      // 中等查询使用的术语数
    },
    complex: {
      termCount: 20,      // 复杂查询使用的术语数
    },
    
    // 固定术语数量（如果不想动态调整，设置此值）
    // fixed: 15,
  },

  /**
   * LLM API调用参数
   */
  apiParams: {
    maxTokens: 2048,           // 最大输出token数
    temperature: 0.2,          // 温度：0-1，越低越确定
    topP: 0.5,                 // Top-p采样
    frequencyPenalty: 0.2,     // 频率惩罚
    presencePenalty: 0.1,      // 存在惩罚
  },

  /**
   * 输出限制
   */
  output: {
    maxResults: 5,             // 最多返回的HPO术语数
    minConfidence: '中',       // 最低置信度要求
  },

  /**
   * 性能优化
   */
  performance: {
    enableCache: true,         // 启用缓存
    cacheTimeout: 3600000,     // 缓存超时时间（毫秒）
    batchSize: 20,             // 批量处理大小
  },

  /**
   * 调试选项
   */
  debug: {
    logSearchTerms: true,      // 记录搜索到的术语
    logPrompt: false,          // 记录完整Prompt（可能很长）
    logResponse: true,         // 记录API响应
    logTiming: true,           // 记录耗时
  },
};

/**
 * 根据查询长度动态获取术语数量
 */
export function getDynamicTermCount(queryLength: number): number {
  const { simple, medium, complex } = LLMConfig.relevantTerms;
  
  if (queryLength < simple.maxLength) {
    return simple.termCount;
  } else if (queryLength < medium.maxLength) {
    return medium.termCount;
  } else {
    return complex.termCount;
  }
}

/**
 * 获取术语数量（支持固定或动态）
 */
export function getTermCount(queryLength: number): number {
  // 如果设置了固定值，使用固定值
  const config = LLMConfig.relevantTerms as any;
  if ('fixed' in config && typeof config.fixed === 'number') {
    return config.fixed;
  }
  
  // 否则使用动态调整
  return getDynamicTermCount(queryLength);
}

export default LLMConfig;
