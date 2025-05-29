'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';

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
  isLoading?: boolean;
}

const columnHelper = createColumnHelper<TableData>();

// const MAX_TABLE_SIZE = 1000;

export default function Table({ data, isLoading }: TableProps) {
  const safeData = useMemo(() => data.slice(0, 20), [data]);

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
    data: safeData,
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
      <div className="flex-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
        <div className="min-w-full">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            {isLoading ? (
              <tbody>
                <tr>
                  <td colSpan={6} className="text-center py-4 text-gray-500 dark:text-gray-400">
                    正在加载数据，分析中，安坐和放松...
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className="px-4 py-4 whitespace-normal text-sm text-gray-700 dark:text-gray-300 relative group"
                      >
                        <div className="relative z-0">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
