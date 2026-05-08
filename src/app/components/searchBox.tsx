'use client';

import React from 'react';

interface SearchBoxProps {
  initialQuery: string;
  onSearch: (query: string) => void;
  isLoading?: boolean;
  searchType: string;
  onTypeChange: (type: string) => void;
  elapsedTime?: number;
}

export default function SearchBox({ initialQuery, onSearch, isLoading, searchType, onTypeChange, elapsedTime = 0 }: SearchBoxProps) {
  const [localQuery, setLocalQuery] = React.useState(initialQuery);

  React.useEffect(() => {
    setLocalQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && localQuery.trim() && localQuery.length <= 2000) {
      onSearch(localQuery.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full h-full">
      {/* 模式切换 - 左上角 */}
      <button
        type="button"
        onClick={() => onTypeChange(searchType === 'matcher' ? 'searcher' : 'matcher')}
        className="absolute left-3 bottom-3 z-10 px-4 py-2 rounded-xl transition-colors text-white text-sm font-medium bg-blue-500 shadow-sm hover:bg-blue-600"
      >
        {searchType === 'matcher' ? 'LLM' : '表型'}
      </button>

      <textarea
        id="phenotypeSearchInput"
        name="q"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading && localQuery.trim() && localQuery.length <= 2000) {
              onSearch(localQuery.trim());
            }
          }
        }}
        onFocus={(e) => e.target.select()}
        placeholder="输入临床信息，提取HPO表型术语"
        className="w-full h-full pl-6 pr-6 pt-4 pb-14 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-gray-200/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 shadow-sm transition-colors text-base resize-none scrollbar-hide leading-[1.35]"
      />

      {/* 搜索按钮 - 右下角 */}
      <button
        type="submit"
        disabled={isLoading || !localQuery.trim() || localQuery.length > 2000}
        className={`absolute right-3 bottom-3 px-4 py-2 rounded-xl transition-colors text-white text-sm font-medium ${
          isLoading || !localQuery.trim() || localQuery.length > 2000
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isLoading ? (
          <span>{elapsedTime}s</span>
        ) : (
          <span>搜索</span>
        )}
      </button>
    </form>
  );
}
