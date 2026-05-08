'use client';
import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import Table from './components/table';
import SearchBox from './components/searchBox';

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-950 dark:to-gray-900 p-8 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const searchType = searchParams.get('type') || 'matcher';

  const [tableData, setTableData] = useState<any[]>([{
    hpo: 'HP:0000001',
    name: 'All',
    chineseName: '所有表型',
    definition: 'Ready',
    definitionCn: '等待查询',
    confidence: '-',
    remark: '等待查询'
  }]);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showFooter, setShowFooter] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedApiUrl = localStorage.getItem('apiUrl');
    const savedApiKey = localStorage.getItem('apiKey');
    const savedModel = localStorage.getItem('model');

    if (savedApiUrl) setApiUrl(savedApiUrl);
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setModel(savedModel);
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowFooter(false);
      } else {
        setShowFooter(true);
      }

      setLastScrollY(currentScrollY);

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setShowFooter(true);
      }, 2000);
    };

    const handleTableScroll = () => {
      setShowFooter(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setShowFooter(true);
      }, 2000);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const tableEl = tableContainerRef.current;
    if (tableEl) {
      tableEl.addEventListener('scroll', handleTableScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (tableEl) {
        tableEl.removeEventListener('scroll', handleTableScroll);
      }
      clearTimeout(timeoutId);
    };
  }, [lastScrollY]);

  const handleSearch = useCallback((searchQuery: string) => {
    router.push(`/?q=${encodeURIComponent(searchQuery)}&type=${searchType}`);
  }, [router, searchType]);

  const handleTypeChange = useCallback((newType: string) => {
    if (query) {
      router.push(`/?q=${encodeURIComponent(query)}&type=${newType}`);
    } else {
      router.push(`/?type=${newType}`);
    }
  }, [router, query]);

  // Streaming 数据获取
  useEffect(() => {
    if (!query) {
      setIsLoading(false);
      return;
    }

    // 取消上一个请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let isMounted = true;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setElapsedTime(0);

        const res = await fetch(`/api/query?type=${searchType}&q=${encodeURIComponent(query)}`, {
          headers: {
            'x-api-url': apiUrl,
            'x-api-key': apiKey,
            'x-model': model
          },
          signal: controller.signal
        });

        if (!res.ok) {
          throw new Error(`请求失败 (${res.status})`);
        }

        // 表型匹配模式：直接JSON响应
        if (searchType === 'searcher') {
          const data = await res.json();
          if (isMounted && data && data.length > 0) {
            setTableData(data);
          }
          return;
        }

        // LLM模式：流式响应
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (!isMounted) return;

              if (currentEvent === 'keepalive') {
                // 保持连接活跃
              } else if (currentEvent === 'stage') {
                // 两轮查询阶段信息
                try {
                  JSON.parse(dataStr);
                } catch {}
              } else if (currentEvent === 'preprocess') {
                // 预处理完成
                try {
                  JSON.parse(dataStr);
                } catch {}
              } else if (currentEvent === 'candidates') {
                // 搜索完成
                try {
                  JSON.parse(dataStr);
                } catch {}
              } else if (currentEvent === 'data') {
                try {
                  const data = JSON.parse(dataStr);
                  if (data && data.length > 0) {
                    setTableData(data);
                  }
                } catch {
                  console.error('解析数据失败');
                }
              } else if (currentEvent === 'error') {
                try {
                  const errorData = JSON.parse(dataStr);
                  setTableData(errorData);
                } catch {
                  console.error('解析错误信息失败');
                }
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('数据获取失败:', error);
        if (isMounted) {
          setTableData([{
            hpo: 'HP:0000001',
            name: 'Error',
            chineseName: '搜索错误',
            definition: 'ERROR',
            definitionCn: error.message || '查询失败',
            confidence: '-',
            remark: '请检查网络或API配置'
          }]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [query, searchType, apiUrl, apiKey, model]);

  // 计时器
  useEffect(() => {
    if (!isLoading) return;

    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading]);

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
      <div className="w-full mx-auto mb-8">
        <div className="flex justify-center mb-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            DeepHPO
          </h1>
        </div>

        <SearchBox
          initialQuery={query}
          onSearch={handleSearch}
          isLoading={isLoading}
          searchType={searchType}
          onTypeChange={handleTypeChange}
          elapsedTime={elapsedTime}
        />
      </div>

      {/* Results */}
      <div ref={tableContainerRef} className="max-w-full mx-auto h-[calc(100vh-380px)] overflow-y-auto">
        <Table data={tableData} isLoading={isLoading} />
      </div>

      {/* Footer */}
      <div className={`fixed bottom-0 left-0 right-0 py-4 bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-950 dark:to-gray-900 border-t border-gray-200 dark:border-gray-800 transition-transform duration-300 ${showFooter ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-2xl mx-auto text-sm text-gray-500 dark:text-gray-400">
          <p className="text-center">
            内容由AI生成，请仔细甄别
          </p>
          <div className="flex items-center justify-center gap-2 p-2 rounded-lg">
            <p>本应用使用Human Phenotype Ontology (2026-02-16)</p>
            <svg
              width={24}
              height={24}
              viewBox="0 0 388 398"
              className="dark:invert"
            >
              <path fill="#f9faf9" d="M -0.5,-0.5 C 57.5,-0.5 115.5,-0.5 173.5,-0.5C 99.992,9.99634 47.1587,48.663 15,115.5C 7.02954,134.22 1.86287,153.553 -0.5,173.5C -0.5,115.5 -0.5,57.5 -0.5,-0.5 Z" />
              <path fill="#050505" d="M 173.5,-0.5 C 186.833,-0.5 200.167,-0.5 213.5,-0.5C 288.123,10.396 341.29,50.0627 373,118.5C 380.215,137.03 385.049,156.03 387.5,175.5C 387.5,187.5 387.5,199.5 387.5,211.5C 379.803,276.081 348.469,325.581 293.5,360C 292.365,360.749 291.365,360.583 290.5,359.5C 285.351,348.029 278.351,337.862 269.5,329C 335.743,285.973 359.909,225.806 342,148.5C 320.031,85.8736 276.198,49.3736 210.5,39C 144.778,34.9434 94.2776,60.4434 59,115.5C 35.4555,158.972 32.1221,203.972 49,250.5C 63.3233,284.152 86.1566,310.319 117.5,329C 108.44,338.731 100.94,349.565 95,361.5C 40.2522,327.016 8.4189,277.683 -0.5,213.5C -0.5,200.167 -0.5,186.833 -0.5,173.5C 1.86287,153.553 7.02954,134.22 15,115.5C 47.1587,48.663 99.992,9.99634 173.5,-0.5 Z" />
              <path fill="#f9faf9" d="M 213.5,-0.5 C 271.5,-0.5 329.5,-0.5 387.5,-0.5C 387.5,58.1667 387.5,116.833 387.5,175.5C 385.049,156.03 380.215,137.03 373,118.5C 341.29,50.0627 288.123,10.396 213.5,-0.5 Z" />
              <path fill="#f9f9f9" d="M 387.5,211.5 C 387.5,273.5 387.5,335.5 387.5,397.5C 325.5,397.5 263.5,397.5 201.5,397.5C 217.973,390.559 224.473,378.226 221,360.5C 218.414,351.751 212.914,345.751 204.5,342.5C 203.508,310.907 203.175,279.24 203.5,247.5C 203.334,239.826 203.5,232.159 204,224.5C 222.055,214.577 226.722,200.244 218,181.5C 205.475,166.799 190.975,164.632 174.5,175C 163.456,186.454 161.623,199.288 169,213.5C 172.75,218.083 177.25,221.75 182.5,224.5C 183.5,263.828 183.833,303.161 183.5,342.5C 171.209,346.869 164.876,355.703 164.5,369C 165.214,383.204 172.214,392.704 185.5,397.5C 123.5,397.5 61.5,397.5 -0.5,397.5C -0.5,336.167 -0.5,274.833 -0.5,213.5C 8.4189,277.683 40.2522,327.016 95,361.5C 100.94,349.565 108.44,338.731 117.5,329C 86.1566,310.319 63.3233,284.152 49,250.5C 32.1221,203.972 35.4555,158.972 59,115.5C 94.2776,60.4434 144.778,34.9434 210.5,39C 276.198,49.3736 320.031,85.8736 342,148.5C 359.909,225.806 335.743,285.973 269.5,329C 278.351,337.862 285.351,348.029 290.5,359.5C 291.365,360.583 292.365,360.749 293.5,360C 348.469,325.581 379.803,276.081 387.5,211.5 Z" />
              <path fill="#050505" d="M 184.5,85.5 C 236.295,84.6279 272.795,107.628 294,154.5C 309.736,204.611 297.569,246.444 257.5,280C 247.111,287.361 235.778,292.861 223.5,296.5C 222.353,296.182 221.519,295.516 221,294.5C 218.226,282.992 219.56,271.992 225,261.5C 225.903,260.299 227.069,259.465 228.5,259C 235.167,258.667 241.833,258.333 248.5,258C 253.304,256.782 256.637,253.949 258.5,249.5C 256.657,244.235 257.324,239.401 260.5,235C 260.104,233.103 259.104,231.603 257.5,230.5C 259.272,229.73 260.272,228.397 260.5,226.5C 258.132,221.392 259.466,217.892 264.5,216C 265.804,215.196 266.471,214.029 266.5,212.5C 263.863,205.893 260.696,199.56 257,193.5C 253.372,160.545 235.539,140.045 203.5,132C 159.652,130.013 135.319,150.847 130.5,194.5C 131.091,206.77 134.591,218.104 141,228.5C 145.967,234.469 151.301,240.135 157,245.5C 158,247.5 159,249.5 160,251.5C 163.648,267.016 163.315,282.349 159,297.5C 148.121,291.977 137.621,285.811 127.5,279C 91.959,249.046 79.1257,211.213 89,165.5C 104.054,118.599 135.888,91.9321 184.5,85.5 Z" />
              <path fill="#050505" d="M 203.5,247.5 C 202.833,263.163 202.5,278.996 202.5,295C 202.501,311.181 203.167,327.014 204.5,342.5C 212.914,345.751 218.414,351.751 221,360.5C 224.473,378.226 217.973,390.559 201.5,397.5C 196.167,397.5 190.833,397.5 185.5,397.5C 172.214,392.704 165.214,383.204 164.5,369C 164.876,355.703 171.209,346.869 183.5,342.5C 183.833,303.161 183.5,263.828 182.5,224.5C 177.25,221.75 172.75,218.083 169,213.5C 161.623,199.288 163.456,186.454 174.5,175C 190.975,164.632 205.475,166.799 218,181.5C 226.722,200.244 222.055,214.577 204,224.5C 203.5,232.159 203.334,239.826 203.5,247.5 Z" />
            </svg>
          </div>
          <p className="text-center">
            在 <a
              href="https://hpo.jax.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              https://hpo.jax.org
            </a> 上找到更多信息
          </p>
        </div>
      </div>
    </div>
  );
}
