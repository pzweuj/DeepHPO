'use client';

import React from 'react';

interface HighlightedTextProps {
  text: string;
  wordMap: Map<string, string[]>;
}

interface Segment {
  start: number;
  end: number;
  word: string;
  hpoIds: string[];
}

export default function HighlightedText({ text, wordMap }: HighlightedTextProps) {
  if (!text || wordMap.size === 0) return null;

  // 找到每个词在文本中的所有位置
  const segments: Segment[] = [];
  wordMap.forEach((hpoIds, word) => {
    let pos = 0;
    const lowerText = text.toLowerCase();
    const lowerWord = word.toLowerCase();
    while (true) {
      const idx = lowerText.indexOf(lowerWord, pos);
      if (idx === -1) break;
      segments.push({ start: idx, end: idx + word.length, word, hpoIds });
      pos = idx + 1;
    }
  });

  if (segments.length === 0) return null;

  // 按位置排序，处理重叠：保留先开始的，跳过落在已保留范围内的
  segments.sort((a, b) => a.start - b.start || b.end - a.end);
  const retained: Segment[] = [];
  let lastEnd = 0;
  for (const seg of segments) {
    if (seg.start >= lastEnd) {
      retained.push(seg);
      lastEnd = seg.end;
    }
  }

  // 切分文本并渲染
  const result: React.ReactNode[] = [];
  let cursor = 0;
  retained.forEach((seg, i) => {
    if (seg.start > cursor) {
      result.push(<span key={`txt-${i}`}>{text.slice(cursor, seg.start)}</span>);
    }
    result.push(
      <span key={`hl-${i}`} className="relative group inline">
        <span className="text-blue-600 dark:text-blue-400 font-medium border-b border-dashed border-blue-400 dark:border-blue-500 cursor-help">
          {text.slice(seg.start, seg.end)}
        </span>
        <span className="opacity-0 group-hover:opacity-100 pointer-events-none absolute left-0 bottom-full mb-1 z-30 transition-opacity">
          <span className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-2 py-1.5 text-xs whitespace-nowrap">
            <span className="font-medium text-blue-600 dark:text-blue-400">HPO: </span>
            {seg.hpoIds.map((id, j) => (
              <span key={id}>
                {j > 0 && ', '}
                <a
                  href={`https://hpo.jax.org/browse/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-500 pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {id}
                </a>
              </span>
            ))}
          </span>
        </span>
      </span>
    );
    cursor = seg.end;
  });
  if (cursor < text.length) {
    result.push(<span key="txt-end">{text.slice(cursor)}</span>);
  }

  return (
    <div className="h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
      {result}
    </div>
  );
}
