/**
 * 文本分词工具 - 简单分词方案
 * 用于医疗病历文本的分词处理
 * 不依赖native模块，适合Docker部署
 */

/**
 * 停用词列表
 */
const STOP_WORDS = new Set([
  '的', '了', '和', '与', '及', '或', '等', '为', '是', '在', '有', '无', '不', '未',
  '可', '能', '已', '被', '将', '由', '对', '于', '从', '到', '向', '以', '按', '经',
  '但', '而', '且', '则', '即', '又', '也', '都', '很', '较', '更', '最', '非常',
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '个', '次', '例',
  '患者', '病人', '入院', '出院', '查体', '体征', '辅助', '检查', '治疗', '用药',
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

  // 使用标点符号和空格分割
  // 医疗病历常见分隔符：逗号、句号、分号、冒号等
  const words = text
    .split(/[，。、；：！？\s,.;:!?]+/)
    .filter(word => {
      const trimmed = word.trim();
      // 过滤停用词
      if (STOP_WORDS.has(trimmed)) return false;
      // 过滤太短的词（保留长度>=2的）
      if (trimmed.length < 2) return false;
      return true;
    });

  // 去重
  return Array.from(new Set(words));
}

/**
 * 智能分词：专门用于医疗病历文本
 * @param text 输入的医疗病历文本
 * @returns 分词结果数组
 */
export function segmentMedicalRecord(text: string): string[] {
  // 先尝试提取更细粒度的症状描述
  // 医疗文本常见模式：症状+程度、时间+症状等

  const result: string[] = [];

  // 1. 提取带数字的症状描述（如"3天前"、"发作性"）
  const patterns = [
    // 症状描述模式
    /[发作间歇进行持续逐渐反复][性得]/g,
    // 时间描述
    /\d+[天周月年小时分秒][前后]/g,
    // 程度描述
    /[轻重中度严重明显轻微]/g,
  ];

  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => result.push(m));
    }
  });

  // 2. 基础分词
  const baseWords = segmentText(text);
  baseWords.forEach(word => {
    if (!result.includes(word)) {
      result.push(word);
    }
  });

  return result;
}