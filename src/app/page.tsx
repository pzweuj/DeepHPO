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
  const [streamingLog, setStreamingLog] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
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
        setStreamingLog('');

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
              } else if (currentEvent === 'token') {
                try {
                  const tokenData = JSON.parse(dataStr);
                  if (tokenData.content) {
                    setStreamingLog(prev => prev + tokenData.content);
                  }
                } catch {}
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
      {/* 右上角按钮组 */}
      <div className="fixed top-8 right-8 flex items-center gap-2 z-50">
        <a
          href="https://github.com/pzweuj/DeepHPO"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
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
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
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
      </div>

      {/* 设置对话框 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">设置 (Anthropic API)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">API URL</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.deepseek.com/anthropic"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Anthropic Messages API 基础地址</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="deepseek-v4-pro"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
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


      {/* Logo + Info */}
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
          DeepHPO
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>内容由AI生成，请仔细甄别</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span>基于 Human Phenotype Ontology (2026-02-16)</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <a
            href="https://hpo.jax.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            hpo.jax.org
          </a>
        </div>
      </div>

      {/* 左右布局：左侧表格，右侧输入框 */}
      <div className="flex gap-6 h-[calc(100vh-140px)]">
        {/* 左侧：结果表格 */}
        <div ref={tableContainerRef} className="flex-1 min-w-0">
          <Table data={tableData} isLoading={isLoading} />
        </div>

        {/* 右侧：输入框 + 流式输出 */}
        <div className="w-[400px] flex-shrink-0 flex flex-col gap-4">
          <div className="flex-1">
            <SearchBox
              initialQuery={query}
              onSearch={handleSearch}
              isLoading={isLoading}
              searchType={searchType}
              onTypeChange={handleTypeChange}
              elapsedTime={elapsedTime}
            />
          </div>
          {streamingLog && (
            <div className="h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-3 text-xs font-mono text-gray-700 dark:text-gray-300">
              {streamingLog}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
