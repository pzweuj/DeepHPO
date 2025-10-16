'use client';
import { useEffect, useState } from 'react';
import Image from "next/image";
import Table from './components/table';
import SearchBox from './components/searchBox';

export default function Home({
  searchParams
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const [tableData, setTableData] = useState<any[]>([{
    hpo: 'HP:0000001',
    name: 'All',
    chineseName: '所有表型',
    destination: 'Ready',
    description: '等待查询',
    confidence: '-',
    remark: '等待查询'
  }]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');

  // 从localStorage加载设置
  useEffect(() => {
    const savedApiUrl = localStorage.getItem('apiUrl');
    const savedApiKey = localStorage.getItem('apiKey');
    const savedModel = localStorage.getItem('model');

    if (savedApiUrl) setApiUrl(savedApiUrl);
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setModel(savedModel);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const type = searchParams?.type?.toString() || 'matcher';
        const query = searchParams?.q?.toString() || '';
        
        // 当没有查询参数时保持默认数据
        if (!query) {
          setIsLoading(false);
          return;
        }

        // 调用API路由
        const res = await fetch(`/api/query?type=${type}&q=${encodeURIComponent(query)}`, {
          headers: {
            'x-api-url': apiUrl,
            'x-api-key': apiKey,
            'x-model': model
          }
        });
        const data = await res.json();
        // 仅当有数据时更新
        if (data && data.length > 0) {
          setTableData(data);
        }
      } catch (error) {
        console.error('数据获取失败:', error);
        setTableData([/* 错误状态数据 */]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [searchParams, apiUrl, apiKey, model]); // 添加API设置作为依赖项

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-950 dark:to-gray-900 p-8">
      {/* 设置按钮 */}
      <button
        onClick={() => setShowSettings(true)}
        className="fixed top-4 left-4 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors z-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M24 13.616v-3.232c-1.651-.587-2.694-.752-3.219-2.019v-.001c-.527-1.271.1-2.134.847-3.707l-2.285-2.285c-1.561.742-2.433 1.375-3.707.847h-.001c-1.269-.526-1.435-1.576-2.019-3.219h-3.232c-.582 1.635-.749 2.692-2.019 3.219h-.001c-1.271.528-2.132-.098-3.707-.847l-2.285 2.285c.745 1.568 1.375 2.434.847 3.707-.527 1.271-1.584 1.438-3.219 2.02v3.232c1.632.58 2.692.749 3.219 2.019.53 1.282-.114 2.166-.847 3.707l2.285 2.286c1.562-.743 2.434-1.375 3.707-.847h.001c1.27.526 1.436 1.579 2.019 3.219h3.232c.582-1.636.75-2.69 2.027-3.222h.001c1.262-.524 2.12.101 3.698.851l2.285-2.286c-.744-1.563-1.375-2.433-.848-3.706.527-1.271 1.588-1.44 3.221-2.021zm-12 2.384c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4z" />
        </svg>
      </button>

      {/* 设置对话框 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">设置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">API URL</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                取消
              </button>
              <button
                onClick={() => {
                  // 保存设置到localStorage
                  localStorage.setItem('apiUrl', apiUrl);
                  localStorage.setItem('apiKey', apiKey);
                  localStorage.setItem('model', model);
                  setShowSettings(false);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Link */}
      <a
        href="https://github.com/pzweuj/DeepHPO"
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
            DeepHPO
          </h1>
        </div>

        <SearchBox 
          initialType={searchParams?.type?.toString() || 'matcher'}
          initialQuery={searchParams?.q?.toString() || ''}
        />
      </div>

      {/* 修改滚动区域 */}
      <div className="max-w-full mx-auto h-[calc(100vh-300px)] overflow-y-auto">
        <Table data={tableData} isLoading={isLoading} />
      </div>

      {/* 将HPO信息部分移动到这里 */}
      <div className="fixed bottom-0 left-0 right-0 py-4 bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-950 dark:to-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto text-sm text-gray-500 dark:text-gray-400">
          <p className="text-center">
            内容由AI生成，请仔细甄别
          </p>
          <div className="flex items-center justify-center gap-2 p-2 rounded-lg">
            <p>本应用使用Human Phenotype Ontology (2025-09-01)</p>
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
