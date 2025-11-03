/**
 * 文本分词工具 - 使用 nodejieba 进行中文分词
 * 用于医疗病历文本的分词处理
 * 注意：此模块仅在服务端使用
 */

// 动态加载 nodejieba，仅在服务端
let nodejieba: any = null;
let jiebaLoadAttempted = false;

function getNodejieba() {
  if (jiebaLoadAttempted) {
    return nodejieba;
  }
  
  jiebaLoadAttempted = true;
  
  // 只在服务端加载
  if (typeof window === 'undefined') {
    try {
      nodejieba = require('nodejieba');
      console.log('nodejieba loaded successfully');
    } catch (error) {
      console.error('Failed to load nodejieba:', error);
      nodejieba = null;
    }
  }
  
  return nodejieba;
}

/**
 * 停用词列表
 */
const STOP_WORDS = new Set([
  '的', '了', '和', '与', '及', '或', '等', '为', '是', '在', '有', '无', '不', '未',
  '可', '能', '已', '被', '将', '由', '对', '于', '从', '到', '向', '以', '按', '经',
  '但', '而', '且', '则', '即', '又', '也', '都', '很', '较', '更', '最', '非常',
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '个', '次', '例',
]);

/**
 * 对文本进行分词
 * @param text 输入文本（可以是医疗病历）
 * @returns 分词后的词语数组
 */
export function segmentText(text: string): string[] {
  if (!text || text.trim() === '') {
    return [];
  }
  
  // 获取 nodejieba 实例
  const jieba = getNodejieba();
  
  // 检查 nodejieba 是否可用
  if (!jieba) {
    // 降级方案：简单按标点和空格分割
    return text
      .split(/[，。、；：！？\s,.\;:!?]+/)
      .filter(word => word.trim().length >= 2 && !STOP_WORDS.has(word));
  }
  
  // 使用 nodejieba 进行分词
  const words: string[] = jieba.cut(text);
  
  // 过滤停用词和单字符（除非是重要词汇）
  const filteredWords = words.filter((word: string) => {
    // 去除空白
    if (!word.trim()) {
      return false;
    }
    
    // 过滤停用词
    if (STOP_WORDS.has(word)) {
      return false;
    }
    
    // 保留长度>=2的词
    if (word.length >= 2) {
      return true;
    }
    
    // 保留英文和数字
    if (/[a-zA-Z0-9]/.test(word)) {
      return true;
    }
    
    return false;
  });
  
  // 去重
  return Array.from(new Set(filteredWords));
}

/**
 * 智能分词：专门用于医疗病历文本
 * @param text 输入的医疗病历文本
 * @returns 分词结果数组
 */
export function segmentMedicalRecord(text: string): string[] {
  return segmentText(text);
}
