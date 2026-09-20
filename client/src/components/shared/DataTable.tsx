import React, { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertCircle } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Extra className on both <th> and <td> */
  className?: string;
  /** Put on <td> only (e.g. 'num' for right-aligned tabular numbers) */
  tdClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  isError?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  /** Extra className on the wrapping div */
  className?: string;
}

const SKELETON_ROWS = 6;

export function DataTable<T>({
  columns,
  data,
  keyField,
  onRowClick,
  isLoading,
  isError,
  emptyMessage = 'No records found',
  emptyIcon,
  className,
}: DataTableProps<T>) {
  return (
    <div className={clsx('rounded-card border border-border overflow-hidden bg-surface-0', className)}>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={clsx(col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* ── Loading state ── */}
            {isLoading &&
              Array.from({ length: SKELETON_ROWS }).map((_, ri) => (
                <tr key={`skel-${ri}`}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <div className="h-3.5 bg-surface-100 rounded animate-pulse w-full" />
                    </td>
                  ))}
                </tr>
              ))}

            {/* ── Error state ── */}
            {!isLoading && isError && (
              <tr>
                <td colSpan={columns.length}>
                  <div className="py-10 flex flex-col items-center gap-2 text-danger">
                    <AlertCircle className="w-6 h-6" />
                    <p className="text-[13px] font-medium">Failed to load data</p>
                    <p className="text-[12px] text-ink-600">Check your connection and try again.</p>
                  </div>
                </td>
              </tr>
            )}

            {/* ── Empty state ── */}
            {!isLoading && !isError && data.length === 0 && (
              <tr>
                <td colSpan={columns.length}>
                  <div className="py-12 flex flex-col items-center gap-2 text-ink-400">
                    {emptyIcon && <span className="mb-1">{emptyIcon}</span>}
                    <p className="text-[13px]">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            )}

            {/* ── Data rows ── */}
            {!isLoading &&
              !isError &&
              data.map((row) => (
                <tr
                  key={String(row[keyField])}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(onRowClick && 'cursor-pointer')}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(col.className, col.tdClassName)}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '')}
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
