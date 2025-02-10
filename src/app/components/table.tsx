'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState, useMemo } from 'react';

interface TableData {
  hpo: string;
  name: string;
  chineseName: string;
  destination: string;
  description: string;
  confidence: string;
  remark?: string;
}

interface TableProps {
  data: TableData[];
}

const columnHelper = createColumnHelper<TableData>();

// const MAX_TABLE_SIZE = 1000;

export default function Table({ data }: TableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  
  const safeData = useMemo(() => data.slice(0, 20), [data]); // 直接截取前20条数据

  const columns = [
    columnHelper.accessor('hpo', {
      header: 'HPO',
      cell: info => (
        <a 
          href={`https://hpo.jax.org/browse/term/${info.getValue()}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {info.getValue()}
        </a>
      ),
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('chineseName', {
      header: '名称',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('destination', {
      header: 'Description',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('description', {
      header: '描述',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('confidence', {
      header: '置信度',
      cell: info => info.getValue(),
      enableHiding: true,
    }),
    columnHelper.accessor('remark', {
      header: '备注',
      cell: info => info.getValue() || '-',
      enableHiding: true,
    }),
  ];

  const table = useReactTable({
    data: safeData, // 直接使用截取后的数据
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility: {
        confidence: false,
        remark: false,
      },
    },
  });

  return (
    <div className="w-full h-full flex flex-col overflow-hidden rounded-lg shadow-sm">
      <div className="flex-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                    style={{ minWidth: 120 }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative"
                onMouseEnter={() => setHoveredRow(row.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className="px-6 py-4 whitespace-normal text-sm text-gray-700 dark:text-gray-300 relative group"
                    onMouseEnter={() => cell.column.id === 'description' && setHoveredRow(row.id)}
                    onMouseLeave={() => cell.column.id === 'description' && setHoveredRow(null)}
                  >
                    <div className="relative z-0">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                    {hoveredRow === row.id && cell.column.id === 'description' && (
                      <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-700 p-2 shadow-lg z-10 border-t border-gray-200 dark:border-gray-600">
                        <div className="text-sm space-y-1">
                          <p>置信度: {row.original.confidence}</p>
                          <p>备注: {row.original.remark || '-'}</p>
                        </div>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
