'use client';



import { useState } from 'react';

import { useTranslations } from 'next-intl';

import {

  AlertDialog,

  AlertDialogAction,

  AlertDialogCancel,

  AlertDialogContent,

  AlertDialogDescription,

  AlertDialogFooter,

  AlertDialogHeader,

  AlertDialogTitle,

} from '@/components/ui/alert-dialog';

import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';

import { buildEntityDisplayLabel } from '@/modules/common/utils/entity-display-label';

import {

  Table as ShadcnTable,

  TableBody,

  TableCell,

  TableHead,

  TableHeader,

  TableRow,

} from '@/components/ui/table';

import { type ApiResponse, type PaginationLinks, type PaginationMeta } from '@/types/ApiResponse';

import { type EntityModuleConfig, type TableColumn } from '@/types/EntityModuleConfig';

import { flexRender, type Table } from '@tanstack/react-table';

import { AlertTriangle, Edit, PlusCircle, Printer, Trash2 } from 'lucide-react';

import { EntityTablePagination } from './entity-table-pagination';



type User = {

  id: string | number;

  name?: string;

  email?: string;

  roles?: Array<string | { name: string }>;

  department?: { name: string };

  [key: string]: any;

};



type EntityTableProps<TData extends { id: string | number }> = {

  table: Table<TData>;

  config: Omit<EntityModuleConfig, 'columns'> & { columns: TableColumn[] };

  isFetching?: boolean;

  error?: any;

  onEdit: (row: { original: TData }) => void;

  onDelete: (id: string | number) => Promise<ApiResponse<null>>;

  pagination?: PaginationMeta;

  links?: PaginationLinks;

  onPageChange: (pageIndex: number) => void;

  onPageSizeChange: (pageSize: number) => void;

  perPage: number;

  refetch?: () => void;

};



export const EntityTable = <TData extends User>({

  config,

  error,

  isFetching,

  onDelete,

  onEdit,

  onPageChange,

  onPageSizeChange,

  pagination,

  perPage,

  refetch,

  table,

}: Readonly<EntityTableProps<TData>>): React.ReactElement => {

  const t = useTranslations(config.singleQueryKey);

  const tGlobal = useTranslations('global');

  const totalItems = pagination?.total ?? table.getRowModel().rows.length;

  const pageIndex = table.getState().pagination.pageIndex;

  const pageSize = pagination?.perPage ?? perPage;

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<string | number | null>(null);



  const handleDeleteClick = (id: string | number): void => {

    setSelectedId(id);

    setIsDialogOpen(true);

  };



  const confirmDelete = async (): Promise<void> => {

    if (selectedId !== null) {

      await onDelete(selectedId);

      setIsDialogOpen(false);

      setSelectedId(null);

    }

  };



  const relationFromAccessor = (accessor?: string): string | null => {

    if (!accessor) {

      return null;

    }



    const map: Record<string, string> = {

      appointmentId: 'appointment',

      createdBy: 'creator',

      dentistId: 'dentist',

      invoiceId: 'invoice',

      patientId: 'patient',

      paymentId: 'payment',

      toothId: 'tooth',

      treatmentId: 'treatment',

      updatedBy: 'updater',

      visitId: 'visit',

    };



    return map[accessor] ?? null;

  };



  const renderCellValue = (value: any, row?: Record<string, any>, accessor?: string): string => {

    if (value === null || value === undefined) return '';



    const relation = relationFromAccessor(accessor);

    if ((typeof value === 'string' || typeof value === 'number') && relation && row) {

      const relatedObject = row[relation];

      if (relatedObject && typeof relatedObject === 'object') {

        return buildEntityDisplayLabel(relatedObject, { relation });

      }

    }



    if (Array.isArray(value)) {

      return value

        .map((item) => {

          if (typeof item === 'object' && item !== null) {

            return buildEntityDisplayLabel(item as Record<string, any>, { relation });

          }



          return String(item);

        })

        .filter(Boolean)

        .join(', ');

    }

    if (typeof value === 'object' && value !== null) {

      return buildEntityDisplayLabel(value as Record<string, any>, { relation });

    }

    return String(value);

  };



  const asText = (value: unknown): string => {

    if (value === null || value === undefined) {

      return '';

    }

    if (typeof value === 'number') {

      return String(value);

    }

    if (typeof value === 'string') {

      return value.trim();

    }

    return '';

  };



  const asNumber = (value: unknown): number => {

    const text = asText(value).replace(/[^0-9.-]/g, '');

    const parsed = Number(text);

    return Number.isFinite(parsed) ? parsed : 0;

  };



  const formatAmount = (value: unknown): string => asNumber(value).toFixed(2);



  const escapeHtml = (value: string): string =>

    value

      .replaceAll('&', '&amp;')

      .replaceAll('<', '&lt;')

      .replaceAll('>', '&gt;')

      .replaceAll('"', '&quot;')

      .replaceAll("'", '&#39;');



  const handlePrint = (entity: Record<string, any>): void => {

    const patient = (entity.patient as Record<string, unknown> | undefined) ?? {};

    const visit = (entity.visit as Record<string, unknown> | undefined) ?? {};



    const patientName = [

      asText(patient.firstName ?? patient.first_name),

      asText(patient.lastName ?? patient.last_name),

    ]

      .filter(Boolean)

      .join(' ')

      .trim() || asText(patient.fullName ?? patient.full_name ?? patient.name) || '-';

    const patientCode = asText(patient.patientCode ?? patient.patient_code) || '-';

    const patientPhone = asText(patient.contactNumber ?? patient.contact_number) || '-';

    const patientEmail = asText(patient.email) || '-';

    const patientAddress = asText(patient.address) || '-';

    const patientGender = asText(patient.gender) || '-';



    const invoiceId = asText(entity.id) || '-';

    const invoiceDate = asText(entity.invoiceDate ?? entity.invoice_date) || '-';

    const paymentType = asText(entity.paymentType ?? entity.payment_type) || '-';

    const status = asText(entity.status) || '-';

    const visitReference =

      asText(visit.tag ?? visit.name) || `#${asText(entity.visitId ?? entity.visit_id) || '-'}`;

    const notes = asText(entity.notes) || '-';

    const sourceVisitIdsRaw = entity.sourceVisitIds ?? entity.source_visit_ids;

    const sourceVisitIds = Array.isArray(sourceVisitIdsRaw)

      ? sourceVisitIdsRaw.map((value: unknown) => asText(value)).filter(Boolean)

      : [];

    const linkedVisits = sourceVisitIds.length > 0

      ? sourceVisitIds.map((value) => `#${value}`).join(', ')

      : visitReference;



    const totalAmountValue = asNumber(entity.totalAmount ?? entity.total_amount);

    const discountAmountValue = asNumber(entity.discount);

    const netAmountValue = asNumber(entity.netAmount ?? entity.net_amount);

    const payments = Array.isArray(entity.payments) ? entity.payments as Array<Record<string, unknown>> : [];

    const paidAmountValue = payments.reduce((sum, payment) => (

      sum + asNumber(payment.amount ?? payment.amountInput ?? payment.amount_input)

    ), 0);

    const remainingAmountValue = Math.max(0, netAmountValue - paidAmountValue);



    const totalAmount = totalAmountValue.toFixed(2);

    const discountAmount = discountAmountValue.toFixed(2);

    const netAmount = netAmountValue.toFixed(2);

    const paidAmount = paidAmountValue.toFixed(2);

    const remainingAmount = remainingAmountValue.toFixed(2);



    const html = `

      <!doctype html>

      <html>

        <head>

          <meta charset="utf-8" />

          <title>${escapeHtml(`${t(config.entity)} #${invoiceId}`)}</title>

          <style>

            :root {

              --text: #0f172a;

              --muted: #475569;

              --line: #dbeafe;

              --surface: #f8fafc;

              --brand: #0369a1;

            }

            * { box-sizing: border-box; }

            body {

              margin: 0;

              padding: 24px;

              font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;

              color: var(--text);

              background: #e2e8f0;

            }

            .sheet {

              max-width: 860px;

              margin: 0 auto;

              background: #ffffff;

              border: 1px solid var(--line);

              border-radius: 14px;

              overflow: hidden;

              box-shadow: 0 18px 42px rgba(15, 23, 42, 0.15);

            }

            .hero {

              padding: 24px;

              background: linear-gradient(120deg, #f0f9ff 0%, #e0f2fe 45%, #f8fafc 100%);

              border-bottom: 1px solid var(--line);

              display: grid;

              grid-template-columns: 1fr auto;

              gap: 16px;

            }

            .clinic h1 { margin: 0; font-size: 24px; letter-spacing: 0.4px; }

            .clinic p { margin: 6px 0 0; color: var(--muted); font-size: 12px; }

            .invoice-meta { text-align: right; }

            .badge {

              display: inline-block;

              padding: 6px 10px;

              border-radius: 999px;

              background: #dbeafe;

              color: #1e3a8a;

              font-size: 11px;

              font-weight: 700;

              text-transform: uppercase;

              letter-spacing: 0.6px;

            }

            .meta-row { margin-top: 8px; font-size: 12px; color: var(--muted); }

            .content { padding: 20px 24px 24px; }

            .cards {

              display: grid;

              grid-template-columns: 1fr 1fr;

              gap: 14px;

              margin-bottom: 16px;

            }

            .card {

              border: 1px solid var(--line);

              border-radius: 10px;

              background: var(--surface);

              padding: 14px;

            }

            .card h3 { margin: 0 0 10px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; }

            .card p { margin: 4px 0; font-size: 13px; }

            table {

              width: 100%;

              border-collapse: collapse;

              margin-top: 8px;

              border: 1px solid var(--line);

            }

            thead th {

              background: #f0f9ff;

              color: #0c4a6e;

              font-size: 12px;

              text-transform: uppercase;

              letter-spacing: 0.6px;

              padding: 10px 12px;

              text-align: left;

            }

            tbody td {

              padding: 12px;

              border-top: 1px solid var(--line);

              font-size: 13px;

            }

            .amount { text-align: right; white-space: nowrap; }

            .summary {

              margin-top: 14px;

              margin-left: auto;

              width: 280px;

              border: 1px solid var(--line);

              border-radius: 10px;

              overflow: hidden;

            }

            .summary-row {

              display: flex;

              justify-content: space-between;

              padding: 10px 12px;

              border-top: 1px solid var(--line);

              font-size: 13px;

            }

            .summary-row:first-child { border-top: none; }

            .summary-row.total {

              font-weight: 700;

              font-size: 15px;

              background: #f0f9ff;

            }

            .notes {

              margin-top: 14px;

              border: 1px dashed #bfdbfe;

              border-radius: 10px;

              padding: 12px;

              font-size: 13px;

            }

            .foot {

              margin-top: 16px;

              font-size: 11px;

              color: var(--muted);

              text-align: center;

            }

            @media print {

              body { background: #fff; padding: 0; }

              .sheet { max-width: 100%; box-shadow: none; border-radius: 0; }

            }

          </style>

        </head>

        <body>

          <main class="sheet">

            <header class="hero">

              <div class="clinic">

                <h1>Dental Invoice</h1>

                <p>Professional dental billing statement</p>

              </div>

              <div class="invoice-meta">

                <span class="badge">${escapeHtml(status)}</span>

                <div class="meta-row"><strong>Invoice #:</strong> ${escapeHtml(invoiceId)}</div>

                <div class="meta-row"><strong>Date:</strong> ${escapeHtml(invoiceDate)}</div>

                <div class="meta-row"><strong>Payment Type:</strong> ${escapeHtml(paymentType)}</div>

              </div>

            </header>

            <section class="content">

              <div class="cards">

                <article class="card">

                  <h3>Patient Details</h3>

                  <p><strong>Name:</strong> ${escapeHtml(patientName)}</p>

                  <p><strong>Patient Code:</strong> ${escapeHtml(patientCode)}</p>

                  <p><strong>Phone:</strong> ${escapeHtml(patientPhone)}</p>

                  <p><strong>Email:</strong> ${escapeHtml(patientEmail)}</p>

                  <p><strong>Gender:</strong> ${escapeHtml(patientGender)}</p>

                  <p><strong>Address:</strong> ${escapeHtml(patientAddress)}</p>

                </article>

                <article class="card">

                  <h3>Invoice Details</h3>

                  <p><strong>Visit:</strong> ${escapeHtml(visitReference)}</p>

                  <p><strong>Linked Visits:</strong> ${escapeHtml(linkedVisits)}</p>

                  <p><strong>Visit ID:</strong> ${escapeHtml(asText(entity.visitId ?? entity.visit_id) || '-')}</p>

                  <p><strong>Patient ID:</strong> ${escapeHtml(asText(entity.patientId ?? entity.patient_id) || '-')}</p>

                </article>

              </div>



              <table>

                <thead>

                  <tr>

                    <th>Description</th>

                    <th class="amount">Amount</th>

                  </tr>

                </thead>

                <tbody>

                  <tr>

                    <td>Gross Amount</td>

                    <td class="amount">${escapeHtml(totalAmount)} AFN</td>

                  </tr>

                  <tr>

                    <td>Discount</td>

                    <td class="amount">${escapeHtml(discountAmount)} AFN</td>

                  </tr>

                  <tr>

                    <td>Net Amount</td>

                    <td class="amount">${escapeHtml(netAmount)} AFN</td>

                  </tr>

                  <tr>

                    <td>Paid Amount</td>

                    <td class="amount">${escapeHtml(paidAmount)} AFN</td>

                  </tr>

                  <tr>

                    <td>Remaining Debt</td>

                    <td class="amount">${escapeHtml(remainingAmount)} AFN</td>

                  </tr>

                </tbody>

              </table>



              <aside class="summary">

                <div class="summary-row">

                  <span>Total Amount</span>

                  <span>${escapeHtml(totalAmount)} AFN</span>

                </div>

                <div class="summary-row">

                  <span>Discount</span>

                  <span>${escapeHtml(discountAmount)} AFN</span>

                </div>

                <div class="summary-row total">

                  <span>Net Amount</span>

                  <span>${escapeHtml(netAmount)} AFN</span>

                </div>

                <div class="summary-row">

                  <span>Paid</span>

                  <span>${escapeHtml(paidAmount)} AFN</span>

                </div>

                <div class="summary-row">

                  <span>Remaining</span>

                  <span>${escapeHtml(remainingAmount)} AFN</span>

                </div>

              </aside>



              <section class="notes">

                <strong>Notes:</strong> ${escapeHtml(notes)}

              </section>



              <footer class="foot">

                Thank you for trusting our dental services.

              </footer>

            </section>

          </main>

        </body>

      </html>

    `;



    const iframe = document.createElement('iframe');

    iframe.style.position = 'fixed';

    iframe.style.right = '0';

    iframe.style.bottom = '0';

    iframe.style.width = '0';

    iframe.style.height = '0';

    iframe.style.border = '0';

    iframe.style.visibility = 'hidden';

    document.body.append(iframe);



    const printDocument = iframe.contentWindow?.document;

    const printWindow = iframe.contentWindow;

    if (!printDocument || !printWindow) {

      iframe.remove();

      return;

    }



    printDocument.open();

    printDocument.write(html);

    printDocument.close();



    const cleanup = (): void => {

      setTimeout(() => {

        iframe.remove();

      }, 0);

    };



    printWindow.onafterprint = cleanup;

    setTimeout(() => {

      printWindow.focus();

      printWindow.print();

    }, 120);

  };



  if (isFetching) {

    return (

      <div className="rounded-md border">

        <ShadcnTable>

          <TableHeader className="bg-muted">

            <TableRow>

              {config.columns.map((column) => (

                <TableHead key={String(column.accessorKey)}>

                  <Skeleton className="h-6 w-3/4" />

                </TableHead>

              ))}

              <TableHead className="w-[100px]">

                <Skeleton className="h-6 w-3/4" />

              </TableHead>

            </TableRow>

          </TableHeader>

          <TableBody>

            {Array.from({ length: 10 }).map((_, index) => (

              <TableRow

                key={`skeleton-row-${index}-${config.columns[0]?.accessorKey || 'default'}`}

              >

                {config.columns.map((column) => (

                  <TableCell key={`skeleton-cell-${column.accessorKey}`}>

                    <Skeleton className="h-6 w-full" />

                  </TableCell>

                ))}

                <TableCell>

                  <div className="flex space-x-2">

                    <Skeleton className="h-8 w-8" />

                    <Skeleton className="h-8 w-8" />

                  </div>

                </TableCell>

              </TableRow>

            ))}

          </TableBody>

        </ShadcnTable>

      </div>

    );

  }



  if (error) {

    return (

      <div className="flex flex-col items-center justify-center rounded-md border border-red-200 bg-red-50 p-6 text-center">

        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />

        <h3 className="text-lg font-semibold text-red-700">{tGlobal('errorLoadingData')}</h3>

        <p className="text-sm text-red-600 mt-2">{error.message || tGlobal('unexpectedError')}</p>

        {refetch && (

          <Button

            variant="outline"

            className="mt-4 border-red-500 text-red-500 hover:bg-red-100"

            onClick={refetch}

          >

            {tGlobal('retry')}

          </Button>

        )}

      </div>

    );

  }



  return (

    <div className="flex flex-col gap-4">

      <div className="rounded-md border">

        <ShadcnTable>

          <TableHeader className="bg-muted sticky top-0 z-10">

            {table.getHeaderGroups().map((headerGroup) => (

              <TableRow key={headerGroup.id}>

                {headerGroup.headers.map((header) => {

                  if ((header.column.columnDef.meta as { hidden?: boolean })?.hidden) return null;

                  const headerValue =

                    typeof header.column.columnDef.header === 'string'

                      ? t(header.column.columnDef.header, {

                          defaultMessage: header.column.columnDef.header,

                        })

                      : (header.column.columnDef.header ?? '');

                  return (

                    <TableHead key={header.id}>

                      {header.isPlaceholder ? null : flexRender(headerValue, header.getContext())}

                    </TableHead>

                  );

                })}

                <TableHead className="w-[100px] text-center">{tGlobal('actions')}</TableHead>

              </TableRow>

            ))}

          </TableHeader>

          <TableBody>

            {table.getRowModel().rows.length === 0 ? (

              <TableRow>

                <TableCell colSpan={config.columns.length + 1} className="h-24 text-center">

                  <div className="flex flex-col items-center justify-center py-8">

                    <PlusCircle className="h-12 w-12 text-gray-400" />

                    <h3 className="mt-2 text-sm font-semibold text-gray-900">

                      {tGlobal('noRecordsFound')}

                    </h3>

                    <p className="mt-1 text-sm text-gray-500">

                      {tGlobal('getStartedByCreatingANew')} {t(config.entity)}.

                    </p>

                  </div>

                </TableCell>

              </TableRow>

            ) : (

              table.getRowModel().rows.map((row) => (

                <TableRow key={row.id}>

                  {row.getVisibleCells().map((cell) => {

                    const column = config.columns.find((c) => c.accessorKey === cell.column.id);

                    if (column?.meta?.hidden) return null;

                    const accessor = typeof column?.accessorKey === 'string' ? column.accessorKey : undefined;

                    const cellValue = column?.cell

                      ? column.cell(row.original)

                      : renderCellValue(cell.getValue(), row.original as Record<string, any>, accessor);



                    return <TableCell key={cell.id}>{cellValue}</TableCell>;

                  })}

                  <TableCell className="flex space-x-2">

                    {config.queryKey === 'invoices' ? (

                      <Button

                        variant="ghost"

                        size="icon"

                        onClick={() => {

                          handlePrint(row.original as Record<string, any>);

                        }}

                        aria-label={`Print ${t(config.entity)}`}

                        className="text-slate-600 hover:text-slate-800 hover:bg-slate-50"

                      >

                        <Printer className="h-4 w-4" />

                      </Button>

                    ) : null}

                    <Button

                      variant="ghost"

                      size="icon"

                      onClick={() => {

                        onEdit({ original: row.original });

                      }}

                      aria-label={`${tGlobal('edit')} ${t(config.entity)}`}

                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"

                    >

                      <Edit className="h-4 w-4" />

                    </Button>

                    <Button

                      variant="ghost"

                      size="icon"

                      onClick={() => {

                        handleDeleteClick(row.original.id);

                      }}

                      aria-label={`${tGlobal('delete')} ${t(config.entity)}`}

                      className="text-red-600 hover:text-red-800 hover:bg-red-50"

                    >

                      <Trash2 className="h-4 w-4" />

                    </Button>

                  </TableCell>

                </TableRow>

              ))

            )}

          </TableBody>

        </ShadcnTable>

      </div>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>{tGlobal('confirmDeleteTitle')}</AlertDialogTitle>

            <AlertDialogDescription>

              {tGlobal('confirmDeleteDescription', { entity: t(config.entity) })}

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>{tGlobal('cancel')}</AlertDialogCancel>

            <AlertDialogAction

              onClick={confirmDelete}

              className="bg-red-600 hover:bg-red-500 text-white"

            >

              {tGlobal('delete')}

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

      {totalItems > 10 && (

        <EntityTablePagination

          table={table}

          totalItems={totalItems}

          pageIndex={pageIndex}

          pageSize={pageSize}

          perPage={perPage}

          onPageChange={onPageChange}

          onPageSizeChange={onPageSizeChange}

        />

      )}

    </div>

  );

};

