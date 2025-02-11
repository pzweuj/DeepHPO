// 直接导入JSON文件并添加类型声明
const hpoTerms = require('/public/hpo_terms_cn.json') as Record<string, {
  id: string;
  name: string;
  definition: string;
  name_cn: string;
  definition_cn: string;
}>;

interface TableData {
  hpo: string;
  name: string;
  chineseName: string;
  destination: string;
  description: string;
  confidence: string;
  remark: string;
}

export function searchHPOTerms(query: string): TableData[] {
  const results: TableData[] = [];
  
  // 将查询转换为小写以便不区分大小写
  const lowerQuery = query?.toLowerCase() || '';
  const enableFullTextSearch = lowerQuery.length > 15; // 添加长度判断

  // 遍历JSON数据
  Object.values(hpoTerms).forEach(term => {
    // 基础匹配条件
    const baseMatch = (term.id?.toLowerCase() || '').includes(lowerQuery) ||
                      (term.name?.toLowerCase() || '').includes(lowerQuery) ||
                      (term.name_cn?.toLowerCase() || '').includes(lowerQuery);

    // 当查询长度大于15时，增加定义匹配
    const fullTextMatch = enableFullTextSearch && 
                         ((term.definition?.toLowerCase() || '').includes(lowerQuery) ||
                          (term.definition_cn?.toLowerCase() || '').includes(lowerQuery));

    if (baseMatch || fullTextMatch) {
      const tableData: TableData = {
        hpo: term.id,
        name: term.name,
        chineseName: term.name_cn,
        destination: term.definition,
        description: term.definition_cn,
        confidence: '-',
        remark: '搜索匹配'
      };
      
      results.push(tableData);
    }
  });

  // 如果没有找到任何结果，添加默认条目
  if (results.length === 0 && query.trim() !== '') {
    const defaultData: TableData = {
      hpo: 'HP:0000001',
      name: 'All',
      chineseName: '所有表型',
      destination: 'NOTFOUND',
      description: '未找到结果',
      confidence: '-',
      remark: '查询失败'
    };
    results.push(defaultData);
  }

  return results;
}
