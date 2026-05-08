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

  const calculateRows = (text: string) => {
    const lineCount = text.split('\n').length;
    const charCount = text.length;
    return Math.min(Math.max(lineCount, Math.ceil(charCount / 80)), 6);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && localQuery.trim() && localQuery.length <= 2000) {
      onSearch(localQuery.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      {/* 模式切换 - 左侧内部 */}
      <button
        type="button"
        onClick={() => onTypeChange(searchType === 'matcher' ? 'searcher' : 'matcher')}
        className="absolute left-2 top-[calc(50%-0.1rem)] -translate-y-1/2 z-10 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors bg-blue-500 text-white shadow-sm hover:bg-blue-600"
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
        className="w-full pl-16 pr-16 py-[1rem] rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-gray-200/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 shadow-sm transition-colors text-base resize-none scrollbar-hide leading-[1.35]"
        style={{ height: `${calculateRows(localQuery) * 24 + 32}px` }}
      />

      <button
        type="submit"
        disabled={isLoading || !localQuery.trim() || localQuery.length > 2000}
        className={`absolute right-3 top-[calc(50%-0.1rem)] -translate-y-1/2 px-3 py-1.5 rounded-full transition-colors text-white text-xs font-medium min-w-[2.5rem] ${
          isLoading || !localQuery.trim() || localQuery.length > 2000
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isLoading ? (
          <span>{elapsedTime}s</span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        )}
      </button>
    </form>
  );
}
