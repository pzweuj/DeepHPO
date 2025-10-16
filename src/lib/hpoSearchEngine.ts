/**
 * HPO搜索引擎 - 服务端专用
 * 使用索引优化搜索性能，避免全量遍历
 */

import fs from 'fs';
import path from 'path';

interface HPOTerm {
  id: string;
  name: string;
  definition: string;
  name_cn: string;
  definition_cn: string;
}

interface SearchIndex {
  byId: Map<string, HPOTerm>;
  byNamePrefix: Map<string, Set<string>>; // 前缀索引
  byNameCnPrefix: Map<string, Set<string>>; // 中文前缀索引
  byKeyword: Map<string, Set<string>>; // 关键词索引
}

class HPOSearchEngine {
  private static instance: HPOSearchEngine;
  private terms: Map<string, HPOTerm>;
  private index: SearchIndex;
  private initialized: boolean = false;

  private constructor() {
    this.terms = new Map();
    this.index = {
      byId: new Map(),
      byNamePrefix: new Map(),
      byNameCnPrefix: new Map(),
      byKeyword: new Map(),
    };
  }

  static getInstance(): HPOSearchEngine {
    if (!HPOSearchEngine.instance) {
      HPOSearchEngine.instance = new HPOSearchEngine();
    }
    return HPOSearchEngine.instance;
  }

  /**
   * 初始化搜索引擎，构建索引
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const jsonPath = path.join(process.cwd(), 'public', 'hpo_terms_cn.json');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Record<string, HPOTerm>;

      console.log('Building HPO search index...');
      const startTime = Date.now();

      // 构建索引
      Object.entries(data).forEach(([id, term]) => {
        this.terms.set(id, term);
        this.index.byId.set(id.toLowerCase(), term);

        // 构建英文名称前缀索引
        this.addPrefixIndex(term.name, id, this.index.byNamePrefix);

        // 构建中文名称前缀索引
        this.addPrefixIndex(term.name_cn, id, this.index.byNameCnPrefix);

        // 构建关键词索引（英文）
        this.addKeywordIndex(term.name, id);
        this.addKeywordIndex(term.definition, id);

        // 构建关键词索引（中文）
        this.addKeywordIndex(term.name_cn, id);
        this.addKeywordIndex(term.definition_cn, id);
      });

      this.initialized = true;
      console.log(`HPO index built in ${Date.now() - startTime}ms, ${this.terms.size} terms indexed`);
    } catch (error) {
      console.error('Failed to initialize HPO search engine:', error);
      throw error;
    }
  }

  /**
   * 添加前缀索引
   */
  private addPrefixIndex(text: string, id: string, prefixMap: Map<string, Set<string>>): void {
    if (!text) return;
    
    const normalized = text.toLowerCase().trim();
    const words = normalized.split(/\s+/);

    words.forEach(word => {
      // 为每个词的前缀创建索引（最少2个字符）
      for (let i = 2; i <= Math.min(word.length, 10); i++) {
        const prefix = word.substring(0, i);
        if (!prefixMap.has(prefix)) {
          prefixMap.set(prefix, new Set());
        }
        prefixMap.get(prefix)!.add(id);
      }
    });
  }

  /**
   * 添加关键词索引
   */
  private addKeywordIndex(text: string, id: string): void {
    if (!text) return;

    const normalized = text.toLowerCase();
    const words = normalized.split(/[\s,;:.，。；：]+/).filter(w => w.length > 1);

    words.forEach(word => {
      if (!this.index.byKeyword.has(word)) {
        this.index.byKeyword.set(word, new Set());
      }
      this.index.byKeyword.get(word)!.add(id);
    });
  }

  /**
   * 搜索HPO术语
   */
  async search(query: string, options: {
    maxResults?: number;
    includeDefinitions?: boolean;
  } = {}): Promise<HPOTerm[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const { maxResults = 50, includeDefinitions = false } = options;
    
    if (!query || query.trim() === '') {
      return [];
    }

    const normalizedQuery = query.toLowerCase().trim();
    const resultIds = new Set<string>();
    const scores = new Map<string, number>();

    // 1. HPO ID精确匹配（最高优先级）
    if (normalizedQuery.startsWith('hp:')) {
      const term = this.index.byId.get(normalizedQuery);
      if (term) {
        return [term];
      }
    }

    // 2. 前缀匹配
    const queryWords = normalizedQuery.split(/\s+/);
    queryWords.forEach(word => {
      if (word.length >= 2) {
        // 英文前缀匹配
        const enMatches = this.index.byNamePrefix.get(word.substring(0, Math.min(word.length, 10)));
        if (enMatches) {
          enMatches.forEach(id => {
            resultIds.add(id);
            scores.set(id, (scores.get(id) || 0) + 5);
          });
        }

        // 中文前缀匹配
        const cnMatches = this.index.byNameCnPrefix.get(word.substring(0, Math.min(word.length, 10)));
        if (cnMatches) {
          cnMatches.forEach(id => {
            resultIds.add(id);
            scores.set(id, (scores.get(id) || 0) + 5);
          });
        }
      }
    });

    // 3. 关键词匹配
    queryWords.forEach(word => {
      const matches = this.index.byKeyword.get(word);
      if (matches) {
        matches.forEach(id => {
          resultIds.add(id);
          scores.set(id, (scores.get(id) || 0) + 2);
        });
      }
    });

    // 4. 如果查询较长，进行全文搜索（仅在前面结果不足时）
    if (resultIds.size < maxResults && normalizedQuery.length > 15 && includeDefinitions) {
      this.terms.forEach((term, id) => {
        if (resultIds.size >= maxResults * 2) return; // 限制搜索范围

        const defMatch = term.definition?.toLowerCase().includes(normalizedQuery) ||
                        term.definition_cn?.toLowerCase().includes(normalizedQuery);
        
        if (defMatch) {
          resultIds.add(id);
          scores.set(id, (scores.get(id) || 0) + 1);
        }
      });
    }

    // 5. 精确名称匹配加分
    resultIds.forEach(id => {
      const term = this.terms.get(id);
      if (term) {
        if (term.name.toLowerCase() === normalizedQuery || term.name_cn.toLowerCase() === normalizedQuery) {
          scores.set(id, (scores.get(id) || 0) + 10);
        }
      }
    });

    // 6. 排序并返回结果
    const sortedResults = Array.from(resultIds)
      .map(id => ({
        term: this.terms.get(id)!,
        score: scores.get(id) || 0
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(r => r.term);

    return sortedResults;
  }

  /**
   * 根据ID获取术语
   */
  getTerm(id: string): HPOTerm | undefined {
    return this.terms.get(id);
  }

  /**
   * 批量获取术语
   */
  getTerms(ids: string[]): HPOTerm[] {
    return ids.map(id => this.terms.get(id)).filter(Boolean) as HPOTerm[];
  }

  /**
   * 智能搜索相关术语（用于LLM上下文）
   * @param input 查询文本
   * @param maxTerms 最大返回数量
   * @param minRelevanceScore 最低相关度分数（过滤低质量结果）
   */
  async findRelevantTerms(
    input: string, 
    maxTerms: number = 12,
    minRelevanceScore: number = 2
  ): Promise<HPOTerm[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 搜索更多结果，然后过滤
    const results = await this.search(input, { 
      maxResults: maxTerms * 2,  // 搜索两倍数量
      includeDefinitions: true 
    });

    // 根据相关度过滤并取前 N 个
    // 这里可以添加评分逻辑，目前直接返回
    return results.slice(0, maxTerms);
  }
}

export default HPOSearchEngine;
export type { HPOTerm };
