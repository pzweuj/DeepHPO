'use client';

import React, { useMemo } from 'react';

interface SearchBoxProps {
  initialQuery: string;
  onSearch: (query: string) => void;
  isLoading?: boolean;
  searchType: string;
  onTypeChange: (type: string) => void;
  elapsedTime?: number;
  wordMap?: Map<string, { hpoIds: string[]; type: 'exact' | 'substring' }>;
}

export default function SearchBox({ initialQuery, onSearch, isLoading, searchType, onTypeChange, elapsedTime = 0, wordMap }: SearchBoxProps) {
  const [localQuery, setLocalQuery] = React.useState(initialQuery);
  const highlightRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setLocalQuery(initialQuery);
  }, [initialQuery]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
      highlightRef.current.scrollLeft = (e.target as HTMLTextAreaElement).scrollLeft;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && localQuery.trim() && localQuery.length <= 2000) {
      onSearch(localQuery.trim());
    }
  };

  // 高亮匹配词
  const highlightedContent = useMemo(() => {
    if (!wordMap || wordMap.size === 0 || !localQuery) return null;

    const segments: { start: number; end: number; word: string; hpoIds: string[]; type: 'exact' | 'substring' }[] = [];
    const lowerText = localQuery.toLowerCase();
    wordMap.forEach((entry, word) => {
      let pos = 0;
      const lowerWord = word.toLowerCase();
      while (true) {
        const idx = lowerText.indexOf(lowerWord, pos);
        if (idx === -1) break;
        segments.push({ start: idx, end: idx + word.length, word, hpoIds: entry.hpoIds, type: entry.type });
        pos = idx + 1;
      }
    });

    if (segments.length === 0) return null;

    segments.sort((a, b) => a.start - b.start || b.end - a.end);
    const retained: typeof segments = [];
    let lastEnd = 0;
    for (const seg of segments) {
      if (seg.start >= lastEnd) {
        retained.push(seg);
        lastEnd = seg.end;
      }
    }

    const result: React.ReactNode[] = [];
    let cursor = 0;
    retained.forEach((seg, i) => {
      if (seg.start > cursor) {
        result.push(<span key={`t-${i}`}>{localQuery.slice(cursor, seg.start)}</span>);
      }
      result.push(
        <span key={`h-${i}`} className="relative group inline pointer-events-auto">
          <span className={seg.type === 'exact' ? 'text-blue-600 dark:text-blue-400 font-medium border-b border-dashed border-blue-400 dark:border-blue-500 cursor-help' : 'text-purple-600 dark:text-purple-400 font-medium border-b border-dashed border-purple-400 dark:border-purple-500 cursor-help'}>
            {localQuery.slice(seg.start, seg.end)}
          </span>
          <span className="opacity-0 group-hover:opacity-100 absolute right-0 top-full mt-1 z-30 transition-opacity pointer-events-none">
            <span className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-2 py-1.5 text-xs whitespace-normal max-w-[280px]">
              {seg.hpoIds.map((id, j) => (
                <span key={id}>
                  {j > 0 && ', '}
                  <a href={`https://hpo.jax.org/browse/${id}`} target="_blank" rel="noopener noreferrer" className="text-gray-700 dark:text-gray-300 hover:text-blue-500 pointer-events-auto" onClick={(e) => e.stopPropagation()}>{id}</a>
                </span>
              ))}
            </span>
          </span>
        </span>
      );
      cursor = seg.end;
    });
    if (cursor < localQuery.length) {
      result.push(<span key="t-end">{localQuery.slice(cursor)}</span>);
    }
    return result;
  }, [localQuery, wordMap]);

  return (
    <form onSubmit={handleSubmit} className="relative w-full h-full">
      {/* 模式切换 */}
      <button
        type="button"
        onClick={() => onTypeChange(searchType === 'matcher' ? 'searcher' : 'matcher')}
        className="absolute left-3 bottom-3 z-10 px-4 py-2 rounded-xl transition-colors text-white text-sm font-medium bg-blue-500 shadow-sm hover:bg-blue-600"
      >
        {searchType === 'matcher' ? 'LLM' : '表型'}
      </button>

      {/* 高亮层（textarea 下方，同步滚动） */}
      <div
        ref={highlightRef}
        aria-hidden="true"
        className="absolute inset-0 pl-6 pr-6 pt-4 pb-14 text-base leading-[1.35] whitespace-pre-wrap break-words overflow-hidden pointer-events-none"
      >
        {highlightedContent || <span className="text-transparent">{localQuery}</span>}
      </div>

      {/* 透明 textarea */}
      <textarea
        id="phenotypeSearchInput"
        name="q"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onScroll={handleScroll}
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
        className="w-full h-full pl-6 pr-6 pt-4 pb-14 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-transparent shadow-sm transition-colors text-base resize-none scrollbar-hide leading-[1.35]"
        style={{ caretColor: 'auto', color: highlightedContent ? 'transparent' : undefined } as React.CSSProperties}
      />

      {/* 搜索按钮 */}
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
