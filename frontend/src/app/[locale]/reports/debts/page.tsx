'use client';

import React, { FormEvent, JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/currency-utils';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { createDefaultReportRange, fetchReport, toInputDate } from '@/modules/dental-management/presentation/reports/report-client';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';

type DebtRow = {
  agingBucket: string;
  debtAmount: number;
  id: number;
  invoiceDate: string;
  invoiceId: string;
  netAmount: number;
  paidAmount: number;
  patientDebtAmount?: number;
  patientId: string;
  patientName: string;
  status: string;
};

type DebtReportResponse = {
  aging: Array<{ amount: number; bucket: string; count: number }>;
  rows: {
    data: DebtRow[];
    meta: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
    };
  };
  summary: {
    debtCount: number;
    totalDebt: number;
    totalNet: number;
    totalPaid: number;
  };
};

type SettleFormState = {
  amount: string;
  method: 'cash' | 'card' | 'insurance';
  notes: string;
  paymentDate: string;
};

const client = new AxiosClient();

const extractApiErrorMessage = (
  error: unknown,
  fallback: string,
  remainingTemplate: (remaining: string) => string
): string => {
  const payload = (error as {
    response?: { data?: { error?: { details?: Record<string, unknown>; message?: string } } };
  })?.response?.data?.error;

  if (!payload) return fallback;
  const amountLimit = payload.details?.outstandingBalance ?? payload.details?.outstandingAmount;
  if (typeof amountLimit === 'number') {
    return remainingTemplate(formatCurrency(amountLimit, 'AFN'));
  }
  return payload.message || fallback;
};

const createDefaultForm = (): SettleFormState => ({
  amount: '',
  method: 'cash',
  notes: '',
  paymentDate: toInputDate(new Date()),
});

const getSettledNote = (baseNote: string, row: DebtRow): string => {
  const prefix = `Debt settled for invoice #${row.invoiceId}`;
  const note = baseNote.trim();
  return note ? `${prefix} - ${note}` : prefix;
};

export default function DebtsPage(): JSX.Element {
  const locale = useLocale();
  const tDebts = useTranslations('app.debtsPage');
  const tSidebar = useTranslations('sidebar');
  const tReports = useTranslations('sidebar.reports');
  const range = createDefaultReportRange(90);
  const [report, setReport] = useState<DebtReportResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [form, setForm] = useState<SettleFormState>(() => createDefaultForm());
  const [startDate, setStartDate] = useState(range.startDate);
  const [endDate, setEndDate] = useState(range.endDate);
  const [search, setSearch] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [agingBucket, setAgingBucket] = useState('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activePage = report?.rows.meta.currentPage ?? page;
  const lastPage = report?.rows.meta.lastPage ?? 1;

  const refreshDebts = useCallback(async (pageNumber = page): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await fetchReport<DebtReportResponse>('/api/v1/dental-management/reports/debts', {
        debtAgingBucket: agingBucket,
        endDate,
        invoiceId,
        page: pageNumber,
        perPage: 12,
        search,
        sortBy: 'invoiceDate',
        sortDirection: 'desc',
        startDate,
      });
      setReport(data);
      setPage(pageNumber);
      const validIds = new Set(data.rows.data.map((row) => row.id));
      setSelectedIds((previous) => previous.filter((id) => validIds.has(id)));
    } finally {
      setIsLoading(false);
    }
  }, [agingBucket, endDate, invoiceId, page, search, startDate]);

  useEffect(() => {
    void refreshDebts(page);
  }, [agingBucket, endDate, invoiceId, page, search, startDate, refreshDebts]);

  const selectedRows = useMemo(() => {
    const ids = new Set(selectedIds);
    return (report?.rows.data ?? []).filter((row) => ids.has(row.id));
  }, [report?.rows.data, selectedIds]);

  const selectedDebt = selectedRows.length === 1 ? selectedRows[0] : null;
  const enteredAmount = Number.parseFloat(form.amount);
  const normalizedEnteredAmount = Number.isFinite(enteredAmount) ? Math.max(0, enteredAmount) : 0;
  const totalSelectedDebt = selectedRows.reduce((sum, row) => sum + row.debtAmount, 0);
  const selectedDebtAmount = selectedDebt ? selectedDebt.debtAmount : totalSelectedDebt;
  const remainingAfterPayment = Math.max(0, Number((selectedDebtAmount - normalizedEnteredAmount).toFixed(2)));

  const toggleSelectAll = (checked: boolean): void => {
    if (checked) {
      setSelectedIds((report?.rows.data ?? []).map((row) => row.id));
      return;
    }
    setSelectedIds([]);
  };

  const toggleRow = (id: number, checked: boolean): void => {
    setSelectedIds((previous) => {
      if (checked) {
        return previous.includes(id) ? previous : [...previous, id];
      }
      return previous.filter((item) => item !== id);
    });
  };

  const togglePatientRows = (patientId: string, checked: boolean): void => {
    const patientInvoices = (report?.rows.data ?? [])
      .filter((row) => row.patientId === patientId)
      .map((row) => row.id);
    
    setSelectedIds((previous) => {
      if (checked) {
        const newIds = patientInvoices.filter((id) => !previous.includes(id));
        return [...previous, ...newIds];
      }
      return previous.filter((id) => !patientInvoices.includes(id));
    });
  };

  const handleSettleSelected = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (selectedRows.length === 0) {
      toast.error(tDebts('selectAtLeastOne'));
      return;
    }

    const parsedAmount = Number.parseFloat(form.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a valid amount to pay.');
      return;
    }

    if (selectedRows.length > 1) {
      toast.error('Select only one debt when paying a partial amount.');
      return;
    }

    if (parsedAmount - selectedRows[0].debtAmount > 0.01) {
      toast.error(`Amount cannot be greater than remaining debt ${formatCurrency(selectedRows[0].debtAmount, 'AFN')}.`);
      return;
    }

    setIsSubmitting(true);

    void Promise.allSettled(
      selectedRows.map(async (row) => {
        await client.post(`/api/v1/dental-management/debts/${row.id}/settle`, {
          amount: parsedAmount,
          method: form.method,
          notes: getSettledNote(form.notes, row),
          paymentDate: form.paymentDate,
        });
      })
    )
      .then(async (results) => {
        const successCount = results.filter((result) => result.status === 'fulfilled').length;
        const firstFailure = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;

        if (successCount > 0) {
          toast.success(tDebts('savedSuccess', { count: successCount }));
          await refreshDebts(1);
        }

        if (firstFailure) {
          toast.error(extractApiErrorMessage(
            firstFailure.reason,
            tDebts('partialFailure'),
            (remaining) => tDebts('remainingError', { remaining }),
          ));
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'debts', isCurrent: true, label: tReports('debts') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <Card className="rounded-3xl border border-rose-200 bg-linear-to-br from-rose-50 via-background to-amber-50">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Wallet className="size-5 text-rose-500" />
                  {tDebts('title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <form onSubmit={handleSettleSelected} className="grid gap-3 rounded-2xl border bg-background/90 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-white/90 p-3">
                      <p className="text-xs text-muted-foreground">Selected Debt</p>
                      <p className="text-lg font-semibold text-rose-600">
                        {formatCurrency(selectedDebtAmount, 'AFN')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedDebt
                          ? `Invoice #${selectedDebt.invoiceId} · ${selectedDebt.patientName}`
                          : selectedRows.length > 1
                          ? `${selectedRows.length} invoices selected`
                          : 'Select one or more invoices to see the debt amount.'}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-white/90 p-3">
                      <p className="text-xs text-muted-foreground">Remaining After Payment</p>
                      <p className="text-lg font-semibold text-amber-600">
                        {selectedRows.length > 0 ? formatCurrency(remainingAfterPayment, 'AFN') : formatCurrency(0, 'AFN')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This updates dynamically as you enter the amount to pay.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="debt-date">{tDebts('paymentDate')}</Label>
                      <Input id="debt-date" type="date" value={form.paymentDate} onChange={(event) => setForm((previous) => ({ ...previous, paymentDate: event.target.value }))} required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="debt-amount">Amount To Pay</Label>
                      <Input id="debt-amount" type="number" min="0" step="0.01" value={form.amount ?? ''} onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))} placeholder="Enter paid amount" required />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                      <Label htmlFor="debt-method">{tDebts('paymentMethod')}</Label>
                      <select id="debt-method" className="h-9 rounded-md border bg-background px-3 text-sm" value={form.method} onChange={(event) => setForm((previous) => ({ ...previous, method: event.target.value as SettleFormState['method'] }))}>
                        <option value="cash">{tDebts('methods.cash')}</option>
                        <option value="card">{tDebts('methods.card')}</option>
                        <option value="insurance">{tDebts('methods.insurance')}</option>
                      </select>
                    </div>
                  <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Pay part of a debt now and keep the rest as remaining debt.
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="debt-notes">{tDebts('notes')}</Label>
                    <Input id="debt-notes" value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder={tDebts('notesPlaceholder')} />
                  </div>
                  <Button type="submit" disabled={isSubmitting || selectedRows.length === 0}>
                    {isSubmitting ? tDebts('saving') : tDebts('settleSelected', { count: selectedRows.length })}
                  </Button>
                </form>

                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border bg-white/85 p-3">
                      <p className="text-xs text-muted-foreground">Open Debt</p>
                      <p className="text-lg font-semibold">{formatCurrency(report?.summary.totalDebt ?? 0, 'AFN')}</p>
                      <p className="text-xs text-muted-foreground">Includes unpaid and partially paid invoice balances.</p>
                    </div>
                    <div className="rounded-xl border bg-white/85 p-3">
                      <p className="text-xs text-muted-foreground">Net Invoices</p>
                      <p className="text-lg font-semibold">{formatCurrency(report?.summary.totalNet ?? 0, 'AFN')}</p>
                    </div>
                    <div className="rounded-xl border bg-white/85 p-3">
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="text-lg font-semibold">{formatCurrency(report?.summary.totalPaid ?? 0, 'AFN')}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border bg-white/85 p-4 md:grid-cols-4">
                    <div className="grid gap-1.5">
                      <Label>Start Date</Label>
                      <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>End Date</Label>
                      <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Invoice ID</Label>
                      <Input value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} placeholder="Invoice number" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Aging Bucket</Label>
                      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={agingBucket} onChange={(event) => setAgingBucket(event.target.value)}>
                        <option value="all">All buckets</option>
                        <option value="0-30 days">0-30 days</option>
                        <option value="31-60 days">31-60 days</option>
                        <option value="61-90 days">61-90 days</option>
                        <option value="90+ days">90+ days</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5 md:col-span-3">
                      <Label>Search</Label>
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient or invoice..." />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" onClick={() => void refreshDebts(1)}>Apply Filters</Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white/85 p-4">
                    <p className="mb-2 text-sm font-medium">Aging Snapshot</p>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {(report?.aging ?? []).map((row) => (
                        <div key={row.bucket} className="rounded-xl border bg-background/80 p-3">
                          <p className="text-xs text-muted-foreground">{row.bucket}</p>
                          <p className="text-base font-semibold">{formatCurrency(row.amount, 'AFN')}</p>
                          <p className="text-xs text-muted-foreground">{row.count} invoices</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border">
              <CardHeader>
                <CardTitle>Outstanding Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && report === null ? (
                  <LoadingState compact title="Loading debts" description="Fetching open debt rows." />
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-1.5">
                      <Label>Search Invoices</Label>
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by patient name or invoice ID..." />
                    </div>
                    <div className="overflow-x-auto rounded-2xl border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/30 text-left text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={(report?.rows.data.length ?? 0) > 0 && selectedRows.length === (report?.rows.data.length ?? 0)}
                                onChange={(event) => toggleSelectAll(event.target.checked)}
                              />
                            </th>
                            <th className="px-3 py-2">Invoice</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Patient</th>
                            <th className="px-3 py-2">Paid</th>
                            <th className="px-3 py-2">Debt</th>
                            <th className="px-3 py-2">Bucket</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const groupedByPatient = (report?.rows.data ?? []).reduce((groups, row) => {
                              const key = row.patientId;
                              if (!groups[key]) {
                                groups[key] = {
                                  patientId: row.patientId,
                                  patientName: row.patientName,
                                  invoices: []
                                };
                              }
                              groups[key].invoices.push(row);
                              return groups;
                            }, {} as Record<string, { patientId: string; patientName: string; invoices: DebtRow[] }>);

                            return Object.values(groupedByPatient).map((patient, patientIndex) => {
                              const allPatientInvoicesSelected = patient.invoices.every(invoice => selectedIds.includes(invoice.id));
                              const somePatientInvoicesSelected = patient.invoices.some(invoice => selectedIds.includes(invoice.id));
                              
                              return (
                                <React.Fragment key={patient.patientId}>
                                  <tr className="border-b-2 border-gray-200 bg-linear-to-r from-slate-50 to-gray-50">
                                    <td colSpan={7} className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={allPatientInvoicesSelected}
                                          ref={(el) => {
                                            if (el) el.indeterminate = somePatientInvoicesSelected && !allPatientInvoicesSelected;
                                          }}
                                          onChange={(event) => togglePatientRows(patient.patientId, event.target.checked)}
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                          {patient.patientId.slice(-4)}
                                        </div>
                                        <div>
                                          <span className="font-semibold text-gray-900">{patient.patientName}</span>
                                          <span className="ml-2 text-sm text-gray-500">ID: {patient.patientId}</span>
                                          <span className="ml-2 rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                                            {patient.invoices.length} invoice{patient.invoices.length > 1 ? 's' : ''}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                  {patient.invoices.map((row, invoiceIndex) => (
                                    <tr key={row.id} className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                                      patient.invoices.length === 1 
                                        ? 'bg-white' 
                                        : 'bg-blue-50/30'
                                    }`}>
                                      <td className="px-4 py-3">
                                        <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={(event) => toggleRow(row.id, event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                                      </td>
                                      <td className="px-4 py-3 font-medium text-gray-900">#{row.invoiceId}</td>
                                      <td className="px-4 py-3 text-gray-700">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(row.invoiceDate))}</td>
                                      <td className="px-4 py-3 text-gray-700">{row.patientName}</td>
                                      <td className="px-4 py-3 text-gray-700">{formatCurrency(row.paidAmount, 'AFN')}</td>
                                      <td className="px-4 py-3 font-semibold text-rose-600">
                                        {formatCurrency(row.debtAmount, 'AFN')}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                          row.agingBucket === '0-30 days' ? 'bg-green-100 text-green-800' :
                                          row.agingBucket === '31-60 days' ? 'bg-yellow-100 text-yellow-800' :
                                          row.agingBucket === '61-90 days' ? 'bg-orange-100 text-orange-800' :
                                          'bg-red-100 text-red-800'
                                        }`}>
                                          {row.agingBucket}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{report?.rows.meta.total ?? 0} open invoices</span>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" disabled={isLoading || activePage <= 1} onClick={() => void refreshDebts(activePage - 1)}>
                          Previous
                        </Button>
                        <span>
                          Page {activePage} of {lastPage}
                        </span>
                        <Button type="button" variant="outline" disabled={isLoading || activePage >= lastPage} onClick={() => void refreshDebts(activePage + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
