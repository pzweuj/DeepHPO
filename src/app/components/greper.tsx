/**
 * HPO术语搜索 - 服务端专用
 * 使用优化的搜索引擎，避免全量遍历
 */

import HPOSearchEngine from '@/lib/hpoSearchEngine';

interface TableData {
  hpo: string;
  name: string;
  chineseName: string;
  destination: string;
  description: string;
  confidence: string;
  remark: string;
}

export async function searchHPOTerms(query: string): Promise<TableData[]> {
  try {
    const searchEngine = HPOSearchEngine.getInstance();
    
    // 使用优化的搜索引擎
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
      remark: '搜索匹配'
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
