import { cn } from "@/lib/utils";
import { LoadingSpinner } from "./loading-spinner";
import { EmptyState } from "./empty-state";
import { Database } from "lucide-react";

interface Column<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  rowKey?: (item: T) => string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({ 
  data, 
  columns, 
  isLoading, 
  emptyMessage = "No data available", 
  className,
  rowKey,
  onRowClick
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-md border border-border bg-card">
        <LoadingSpinner />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card">
        <EmptyState 
          icon={Database} 
          title="No Data" 
          description={emptyMessage} 
          className="h-48"
        />
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-auto rounded-md border border-border bg-card", className)}>
      <table className="w-full text-sm text-left">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className={cn("px-4 py-3 font-medium", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((item, rowIndex) => {
            const key = rowKey ? rowKey(item) : String(rowIndex);
            return (
              <tr 
                key={key} 
                className={cn(
                  "hover:bg-muted/30 transition-colors", 
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className={cn("px-4 py-3", col.className)}>
                    {col.cell ? col.cell(item, rowIndex) : col.accessorKey ? String(item[col.accessorKey]) : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
