'use client';
import Image from "next/image";
import { useState } from 'react';
import Table from './components/table';
import DeepSeek from './components/deepseek';
import { searchHPOTerms } from './components/greper';
import SearchBox from './components/searchBox';

export default function Home() {
  const [searchType, setSearchType] = useState('matcher');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableData, setTableData] = useState([
    {
      hpo: 'HP:0000001',
      name: 'All',
      chineseName: '所有表型',
      destination: '-',
      description: '-',
      confidence: '高',
      remark: '示例'
    }
  ]);

  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query?: string) => {
    const currentQuery = (query || searchQuery).trim();
    
    if (currentQuery === '') {
      setTableData([{
        hpo: 'HP:0000001',
        name: 'All',
        chineseName: '所有表型',
        destination: '-',
        description: '-',
        confidence: '高',
        remark: '请输入搜索内容'
      }]);
      return;
    }

    if (searchType !== 'matcher' && typeof searchHPOTerms !== 'function') {
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const result = searchType === 'matcher' 
        ? await DeepSeek.query({
            token: '',
            question: currentQuery
          })
        : await Promise.resolve(searchHPOTerms(currentQuery));
      
      setTableData(result);
    } catch (error) {
      console.error('查询失败:', error);
      setTableData([]);
      alert('查询失败，请稍后重试');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-950 dark:to-gray-900 p-8">
      {/* GitHub Link */}
      <a
        href="https://github.com/pzweuj/CHPO"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed top-4 right-4 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors z-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.237 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      </a>

      {/* Logo and Search */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex justify-center mb-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            CHPO
          </h1>
        </div>

        <SearchBox
          searchType={searchType}
          setSearchType={setSearchType}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearching={isSearching}
          handleSearch={handleSearch}
        />
      </div>

      {/* Table */}
      <div className="max-w-full mx-auto">
        <Table data={tableData} />
      </div>

      {/* 将HPO信息部分移动到这里 */}
      <div className="fixed bottom-0 left-0 right-0 py-4 bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-950 dark:to-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto text-sm text-gray-500 dark:text-gray-400">
          <p className="text-center">
            内容由AI生成，请仔细甄别
          </p>
          <div className="flex items-center justify-center gap-2 p-2 rounded-lg">
            <p>本应用使用Human Phenotype Ontology (2025-01-16)</p>
            <Image
              src="/hpo-logo-white-no-words.png"
              alt="HPO Logo"
              width={24}
              height={24}
              className="dark:invert"
            />
          </div>
          <p className="text-center">
            在 <a 
              href="http://www.human-phenotype-ontology.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              http://www.human-phenotype-ontology.org
            </a> 上找到更多信息
          </p>
        </div>
      </div>
    </div>
  );
}
