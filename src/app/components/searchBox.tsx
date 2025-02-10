'use client';

import React from 'react';

interface SearchBoxProps {
  searchType: string;
  setSearchType: (type: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  handleSearch: () => void;
}

export default function SearchBox({
  searchType,
  setSearchType,
  searchQuery,
  setSearchQuery,
  isSearching,
  handleSearch
}: SearchBoxProps) {
  // 添加本地状态管理输入值
  const [localQuery, setLocalQuery] = React.useState(searchQuery);

  // 同步父组件传入的searchQuery变化（如清空搜索）
  React.useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value); // 仅更新本地状态
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // 回车时提交搜索
      setSearchQuery(localQuery);
      handleSearch();
    }
  };

  // 搜索按钮点击处理
  const handleSearchClick = () => {
    // 同步本地状态到父组件后再执行搜索
    setSearchQuery(localQuery);
    handleSearch();
  };

  const calculateRows = (text: string) => {
    const lineCount = text.split('\n').length;
    const charCount = text.length;
    // 每行大约80个字符，最小1行，最大6行
    return Math.min(Math.max(lineCount, Math.ceil(charCount / 80)), 6);
  };

  return (
    <div className="relative w-full max-w-2xl">
      <div className="absolute left-3 top-[calc(50%-0.1rem)] -translate-y-1/2">
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value)}
          className="appearance-none bg-transparent border-none text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-0 px-2 py-1 rounded-md bg-gray-200/50 dark:bg-gray-700/50 hover:bg-gray-300/50 dark:hover:bg-gray-600/50 transition-colors"
        >
          <option value="phenotype">表型</option>
          <option value="matcher">deepseek</option>
        </select>
      </div>
      <textarea
        id="phenotypeSearchInput"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={(e) => e.target.select()}
        placeholder={searchType === 'matcher' ? '输入临床信息, 使用deepseek提取表型信息' : '搜索HPO编号或中英文表型信息'}
        className="w-full pl-28 pr-6 py-[1rem] rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-gray-200/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 shadow-sm transition-colors text-base resize-none scrollbar-hide leading-[1.35]"
        style={{ height: `${calculateRows(localQuery) * 24 + 32}px` }}
      />
      <SearchButton isSearching={isSearching} onClick={handleSearchClick} />
    </div>
  );
}

const SearchButton = React.memo(({ 
  isSearching,
  onClick 
}: { 
  isSearching: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSearching}
      className="absolute right-3 top-[calc(50%-0.1rem)] -translate-y-1/2 p-2 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-75 disabled:cursor-wait"
    >
      {isSearching ? (
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
  );
});