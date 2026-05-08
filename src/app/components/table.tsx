'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';

interface TableData {
  hpo: string;
  name: string;
  chineseName: string;
  definition: string;
  definitionCn: string;
  confidence: string;
  remark?: string;
}

interface TableProps {
  data: TableData[];
  isLoading?: boolean;
}

const columnHelper = createColumnHelper<TableData>();

export default function Table({ data, isLoading }: TableProps) {
  const pageSize = 20;
  const safeData = useMemo(() => data, [data]);

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
      size: 200,
      minSize: 200,
    }),
    columnHelper.accessor('definition', {
      header: 'Description',
      cell: info => info.getValue(),
      enableHiding: true,
    }),
    columnHelper.accessor('definitionCn', {
      header: '描述',
      cell: info => info.getValue(),
      enableHiding: true,
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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: pageSize,
      },
    },
    state: {
      columnVisibility: {
        definition: false,
        definitionCn: false,
        confidence: false,
        remark: false,
      },
    },
  });

  return (
    <div className="w-full h-full flex flex-col rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            {isLoading && safeData.length === 0 ? (
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
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative group"
                  >
                    {row.getVisibleCells().map((cell, ci) => (
                      <td
                        key={cell.id}
                        className="px-4 py-4 whitespace-normal text-sm text-gray-700 dark:text-gray-300"
                        style={{ width: cell.column.getSize() }}
                      >
                        <div className="relative z-0">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                        {/* Hover 弹窗：放在第一个 td 内 */}
                        {ci === 0 && (
                          <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute left-0 right-0 top-full mt-1 z-20 transition-opacity">
                            <div className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 mr-4 text-sm max-w-xl space-y-1">
                              <div>
                                <span className="font-medium text-blue-600 dark:text-blue-400">Description: </span>
                                <span className="text-gray-700 dark:text-gray-300">{row.original.definition || '-'}</span>
                              </div>
                              <div>
                                <span className="font-medium text-blue-600 dark:text-blue-400">描述: </span>
                                <span className="text-gray-700 dark:text-gray-300">{row.original.definitionCn || '-'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* 填充空行使表格填满 */}
                {Array.from({ length: Math.max(0, pageSize - table.getRowModel().rows.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-[56px]">
                    {table.getVisibleLeafColumns().map((_, j) => (
                      <td key={j} className="px-4 py-4 text-sm">&nbsp;</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
      </div>

      {/* 分页信息 - 底部 */}
      {!isLoading && safeData.length > 0 && (
        <div className="px-4 py-2 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
          <div>
            显示 {table.getState().pagination.pageIndex * pageSize + 1} - {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, safeData.length)} / 共 {safeData.length} 条结果
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 rounded bg-blue-500 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              上一页
            </button>
            <span>
              第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 rounded bg-blue-500 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
