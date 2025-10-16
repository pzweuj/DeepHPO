'use client';

import React from 'react';
import { useFormStatus } from 'react-dom';

interface SearchBoxProps {
  initialType: string;
  initialQuery: string;
}

export default function SearchBox({ initialType, initialQuery }: SearchBoxProps) {
  const [localQuery, setLocalQuery] = React.useState(initialQuery);
  const [searchType, setSearchType] = React.useState(initialType);
  const { pending } = useFormStatus();

  const toggleSearchType = () => {
    setSearchType(prev => prev === 'matcher' ? 'phenotype' : 'matcher');
  };

  React.useEffect(() => {
    setLocalQuery(initialQuery);
  }, [initialQuery]);

  const calculateRows = (text: string) => {
    const lineCount = text.split('\n').length;
    const charCount = text.length;
    return Math.min(Math.max(lineCount, Math.ceil(charCount / 80)), 6);
  };

  return (
    <form action="/" method="GET" className="relative w-full max-w-2xl">
      {/* 隐藏字段传递搜索类型 */}
      <input type="hidden" name="type" value={searchType} />
      
      <div className="absolute left-3 top-[calc(50%-0.1rem)] -translate-y-1/2">
        <button
          type="button"
          onClick={toggleSearchType}
          className="bg-blue-500 dark:bg-blue-600 border-none text-white focus:outline-none focus:ring-0 px-2 py-1 rounded-md transition-colors cursor-pointer shadow-sm text-center"
        >
          {searchType === 'matcher' ? 'LLM' : '表型'}
        </button>
      </div>
      
      <textarea
        id="phenotypeSearchInput"
        name="q"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && localQuery.length <= 600) {
            e.preventDefault();
            (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
          }
        }}
        onFocus={(e) => e.target.select()}
        placeholder={searchType === 'matcher' ? '输入临床信息, 使用LLM提取表型信息' : '搜索HPO编号或中英文表型信息'}
        className="w-full pl-28 pr-6 py-[1rem] rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-gray-200/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 shadow-sm transition-colors text-base resize-none scrollbar-hide leading-[1.35]"
        style={{ height: `${calculateRows(localQuery) * 24 + 32}px` }}
      />
      
      <button
        type="submit"
        disabled={pending || localQuery.length > 600}
        className={`absolute right-3 top-[calc(50%-0.1rem)] -translate-y-1/2 p-2 rounded-full transition-colors ${
          pending || localQuery.length > 600
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {pending ? (
          <div className="h-6 w-6 animate-spin">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-full w-full text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v3m6.366-.366-2.12 2.12M21 12h-3m.366 6.366-2.12-2.12M12 21v-3m-6.366.366 2.12-2.12M3 12h3m-.366-6.366 2.12 2.12"
              />
            </svg>
          </div>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-white"
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