/**
 * 查询预处理器
 * 用于清理和标准化用户输入，处理否定症状和家族史
 */

export interface PreprocessResult {
  cleanedQuery: string;           // 清理后的查询
  negatedSymptoms: string[];      // 检测到的否定症状
  familyHistory: string[];        // 检测到的家族史
  medicalHistory: string[];       // 检测到的既往病史
  diagnosis: string[];            // 检测到的诊断
  warnings: string[];             // 警告信息
  convertedSymptoms: string[];    // 转换后的相关症状
}

/**
 * 否定词列表 - 更精确的匹配
 */
const NEGATION_PATTERNS = [
  // 处理 "无XX、XX" 这种复合否定
  /无([^，,。；;]+?)[，,]/g,           // "无发热畏寒，" -> 提取"发热畏寒"
  /无([^，,。；;]+?)。/g,            // "无头痛。"
  /无([^，,。；;]+?)$/g,             // 行末的否定
  /没有\s*([^,，。;;；\s]{2,})/g,   // "没有发热"
  /否认\s*([^,，。;;；\s]{2,})/g,   // "否认癖痫"
  /不存在\s*([^,，。;;；\s]{2,})/g, // "不存在畸形"
  /未见\s*([^,，。;;；\s]{2,})/g,   // "未见异常"
  /未发现\s*([^,，。;;；\s]{2,})/g, // "未发现肿瘤"
  /排除\s*([^,，。;;；\s]{2,})/g,   // "排除感染"
];

/**
 * 既往病史和诊断模式
 */
const MEDICAL_HISTORY_PATTERNS = [
  /既往病史[:：]?\s*([^\n。]+)/g,
  /既往史[:：]?\s*([^\n。]+)/g,
  /病史[:：]?\s*([^\n。]+)/g,
];

const DIAGNOSIS_PATTERNS = [
  /拟[""\u201c\u201d]?([^""\u201c\u201d\n。]+)[""\u201c\u201d]?/g,  // "拟脑梗死"
  /诊断[:：]?\s*([^\n。]+)/g,
  /临床诊断[:：]?\s*([^\n。]+)/g,
];

/**
 * 家族关系词列表
 */
const FAMILY_PATTERNS = [
  /父亲\s*(\S+)/g,                  // "父亲有高血压"
  /母亲\s*(\S+)/g,                  // "母亲有糖尿病"
  /哥哥\s*(\S+)/g,                  // "哥哥有肾病"
  /姐姐\s*(\S+)/g,                  // "姐姐有癫痫"
  /弟弟\s*(\S+)/g,
  /妹妹\s*(\S+)/g,
  /爷爷\s*(\S+)/g,
  /奶奶\s*(\S+)/g,
  /外公\s*(\S+)/g,
  /外婆\s*(\S+)/g,
  /家族史[：:]\s*(\S+)/g,          // "家族史：高血压"
  /家族中\s*(\S+)/g,                // "家族中有人患病"
  /父母\s*(\S+)/g,                  // "父母有病史"
  /兄弟姐妹\s*(\S+)/g,
];

/**
 * 预处理查询文本
 */
export function preprocessQuery(query: string): PreprocessResult {
  const result: PreprocessResult = {
    cleanedQuery: query,
    negatedSymptoms: [],
    familyHistory: [],
    medicalHistory: [],
    diagnosis: [],
    warnings: [],
    convertedSymptoms: [],
  };

  // 1. 检测并移除否定症状
  NEGATION_PATTERNS.forEach(pattern => {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      if (match[1]) {
        result.negatedSymptoms.push(match[1]);
        // 从查询中移除这部分
        result.cleanedQuery = result.cleanedQuery.replace(match[0], '');
      }
    }
    pattern.lastIndex = 0; // 重置正则表达式
  });

  // 2. 提取既往病史（保留并添加到查询中）
  MEDICAL_HISTORY_PATTERNS.forEach(pattern => {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      if (match[1]) {
        const history = match[1].trim();
        result.medicalHistory.push(history);
        // 将病史中的疾病添加到查询中，因为它们可能有HPO术语
        if (!result.cleanedQuery.includes(history)) {
          result.cleanedQuery += ` ${history}`;
        }
      }
    }
    pattern.lastIndex = 0;
  });

  // 3. 提取诊断信息（保留并添加到查询中）
  DIAGNOSIS_PATTERNS.forEach(pattern => {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      if (match[1]) {
        const diag = match[1].trim();
        result.diagnosis.push(diag);
        // 将诊断添加到查询中，因为它们可能有HPO术语
        if (!result.cleanedQuery.includes(diag)) {
          result.cleanedQuery += ` ${diag}`;
        }
      }
    }
    pattern.lastIndex = 0;
  });

  // 4. 检测并移除家族史
  FAMILY_PATTERNS.forEach(pattern => {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      if (match[1]) {
        result.familyHistory.push(match[1]);
        // 从查询中移除这部分
        result.cleanedQuery = result.cleanedQuery.replace(match[0], '');
      }
    }
    pattern.lastIndex = 0; // 重置正则表达式
  });

  // 5. 清理多余的空格和标点
  result.cleanedQuery = result.cleanedQuery
    .replace(/[,，;；。.]+/g, '，')  // 统一标点
    .replace(/\s+/g, ' ')            // 合并空格
    .replace(/^[,，;；。.\s]+/, '')  // 移除开头的标点和空格
    .replace(/[,，;；。.\s]+$/, '')  // 移除结尾的标点和空格
    .trim();

  // 6. 生成警告信息
  if (result.negatedSymptoms.length > 0) {
    result.warnings.push(
      `检测到否定症状：${result.negatedSymptoms.join('、')}，已自动忽略`
    );
  }

  if (result.familyHistory.length > 0) {
    result.warnings.push(
      `检测到家族史：${result.familyHistory.join('、')}，已自动忽略（仅分析患者本人症状）`
    );
  }

  if (result.medicalHistory.length > 0) {
    result.warnings.push(
      `检测到既往病史：${result.medicalHistory.join('、')}，已包含在搜索中`
    );
  }

  if (result.diagnosis.length > 0) {
    result.warnings.push(
      `检测到诊断：${result.diagnosis.join('、')}，已包含在搜索中`
    );
  }

  return result;
}

/**
 * 检查查询是否有效（清理后是否还有内容）
 */
export function isValidQuery(preprocessed: PreprocessResult): boolean {
  return preprocessed.cleanedQuery.length > 0;
}

/**
 * 格式化警告信息用于显示
 */
export function formatWarnings(preprocessed: PreprocessResult): string {
  if (preprocessed.warnings.length === 0) {
    return '';
  }
  
  return '⚠️ 提示：\n' + preprocessed.warnings.map(w => `• ${w}`).join('\n');
}

export default {
  preprocessQuery,
  isValidQuery,
  formatWarnings,
};
