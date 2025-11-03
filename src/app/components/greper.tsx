/**
 * HPO术语搜索 - 服务端专用
 * 使用优化的搜索引擎，避免全量遍历
 * 支持两种模式：
 * 1. 单词/短语直接搜索
 * 2. 医疗病历文本分词后批量搜索
 */

import HPOSearchEngine from '@/lib/hpoSearchEngine';
import { segmentMedicalRecord } from '@/lib/textSegmentation';

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
 * 判断是否为医疗病历文本（较长的文本，包含多个词语）
 */
function isMedicalRecordText(query: string): boolean {
  const trimmed = query.trim();
  // 如果文本包含逗号、句号等标点符号，认为是病历文本（包含多个症状描述）
  // 或者文本长度超过15个字符
  const hasPunctuation = /[，。；！？、,;]/.test(trimmed);
  const isLongText = trimmed.length > 15;
  
  return hasPunctuation || isLongText;
}

/**
 * 搜索HPO术语 - 支持单词搜索和病历文本分词搜索
 */
export async function searchHPOTerms(query: string): Promise<TableData[]> {
  try {
    const searchEngine = HPOSearchEngine.getInstance();
    
    // 判断是否需要进行分词处理
    const needSegmentation = isMedicalRecordText(query);
    
    if (needSegmentation) {
      // 医疗病历模式：先分词，再对每个词进行搜索
      const words = segmentMedicalRecord(query);
      
      // 收集所有匹配的术语，使用Map去重
      const termMap = new Map<string, { term: any; matchedWords: string[]; score: number }>();
      
      // 对每个分词结果进行搜索
      for (const word of words) {
        const results = await searchEngine.search(word, {
          maxResults: 20,
          includeDefinitions: false
        });
        
        // 合并结果
        results.forEach(term => {
          if (termMap.has(term.id)) {
            const existing = termMap.get(term.id)!;
            existing.matchedWords.push(word);
            existing.score += 1;
          } else {
            termMap.set(term.id, {
              term,
              matchedWords: [word],
              score: 1
            });
          }
        });
      }
      
      // 按匹配词数排序（匹配更多词的术语排在前面）
      const sortedResults = Array.from(termMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);
      
      // 转换为表格数据格式
      const tableData: TableData[] = sortedResults.map(({ term, matchedWords }) => ({
        hpo: term.id,
        name: term.name,
        chineseName: term.name_cn,
        destination: term.definition,
        description: term.definition_cn,
        confidence: `${matchedWords.length}`,
        remark: `匹配词: ${matchedWords.join(', ')}`
      }));
      
      if (tableData.length === 0) {
        return [{
          hpo: 'HP:0000001',
          name: 'No Results',
          chineseName: '未找到结果',
          destination: 'NOTFOUND',
          description: `分词结果: ${words.join(', ')}。未找到匹配的HPO术语`,
          confidence: '-',
          remark: '查询失败'
        }];
      }
      
      return tableData;
    } else {
      // 单词/短语模式：直接搜索
      const results = await searchEngine.search(query, {
        maxResults: 50,
        includeDefinitions: query.length > 15
      });

      // 转换为表格数据格式
      const tableData: TableData[] = results.map(term => ({
        hpo: term.id,
        name: term.name,
        chineseName: term.name_cn,
        destination: term.definition,
        description: term.definition_cn,
        confidence: '-',
        remark: '直接匹配'
      }));

      // 如果没有找到任何结果，返回提示
      if (tableData.length === 0 && query.trim() !== '') {
        return [{
          hpo: 'HP:0000001',
          name: 'No Results',
          chineseName: '未找到结果',
          destination: 'NOTFOUND',
          description: '未找到匹配的HPO术语，请尝试其他关键词',
          confidence: '-',
          remark: '查询失败'
        }];
      }

      return tableData;
    }
  } catch (error) {
    console.error('Search error:', error);
    return [{
      hpo: 'HP:0000001',
      name: 'Error',
      chineseName: '搜索错误',
      destination: 'ERROR',
      description: error instanceof Error ? error.message : '搜索过程中发生错误',
      confidence: '-',
      remark: '系统错误'
    }];
  }
}
