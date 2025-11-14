import * as React from 'react';
import { cn } from '../../lib/utils.ts';

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <table className={cn('w-full text-left text-sm text-gray-200', className)} {...props} />
);

export const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('text-xs uppercase tracking-wide text-gray-400', className)} {...props} />
);

export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-b border-gray-800 last:border-b-0 hover:bg-gray-900/40', className)} {...props} />
);

export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('px-4 py-3 font-medium', className)} {...props} />
);

export const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('divide-y divide-gray-900/80', className)} {...props} />
);

export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-4 py-3 align-middle', className)} {...props} />
);

export default Table;
