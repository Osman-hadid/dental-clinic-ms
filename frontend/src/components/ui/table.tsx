'use client';

import * as React from 'react';
import { JSX } from 'react';
import { cn } from '@/lib/utilities';

const Table = ({ children, className, ...props }: React.ComponentProps<'table'>): JSX.Element => {
  return (
    <div
      data-slot="table-container"
      className="relative w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain"
    >
      <table
        data-slot="table"
        className={cn('w-max min-w-full caption-bottom text-sm', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
};

const TableHeader = ({ className, ...props }: React.ComponentProps<'thead'>): JSX.Element => {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />;
};

const TableBody = ({ className, ...props }: React.ComponentProps<'tbody'>): JSX.Element => {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
};

const TableFooter = ({ className, ...props }: React.ComponentProps<'tfoot'>): JSX.Element => {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-muted/50 border-t font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
};

const TableRow = ({ className, ...props }: React.ComponentProps<'tr'>): JSX.Element => {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-primary/[0.045] data-[state=selected]:bg-primary/[0.08] border-b border-border/65 transition-colors',
        className
      )}
      {...props}
    />
  );
};

const TableHead = ({ className, ...props }: React.ComponentProps<'th'>): JSX.Element => {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-muted-foreground h-11 bg-muted/65 px-3 text-start align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
};

const TableCell = ({ className, ...props }: React.ComponentProps<'td'>): JSX.Element => {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
};

const TableCaption = ({ className, ...props }: React.ComponentProps<'caption'>): JSX.Element => {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  );
};

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
