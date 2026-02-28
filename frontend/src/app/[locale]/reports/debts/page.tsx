'use client';

import { FormEvent, JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatCurrency,
  parseMoney,
} from '@/lib/currency-utils';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';

type PaginatedRowsResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: {
    currentPage?: number;
    lastPage?: number;
  };
};

type DebtRow = {
  debtId: string;
  debtInput: number;
  invoiceId: string;
  invoiceDate: string;
  netAmountInput: number;
  paidAmount: number;
  patientId: string;
  patientName: string;
  status: string;
};

type SettleFormState = {
  method: 'cash' | 'card' | 'insurance';
  notes: string;
  paymentDate: string;
};

const API_MAX_PER_PAGE = 100;
const client = new AxiosClient();

const toInputDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
};

const parseAmount = (value: unknown): number => parseMoney(value);

const formatDisplayDate = (value: string, locale: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(parsed);
};

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
  method: 'cash',
  notes: '',
  paymentDate: toInputDate(new Date()),
});

const fetchAllDebtRows = async (): Promise<Array<Record<string, unknown>>> => {
  const rows: Array<Record<string, unknown>> = [];
  let page = 1;

  while (true) {
    const response = await client.get<PaginatedRowsResponse>('/api/v1/dental-management/debts', {
      params: {
        filter: {
          status: ['open'],
        },
        include: ['patient'],
        page,
        perPage: API_MAX_PER_PAGE,
        sortBy: 'invoiceDate',
        sortDirection: 'desc',
      },
    });
    const payload = response.data;
    const pageRows = Array.isArray(payload?.data) ? payload.data : [];
    rows.push(...pageRows);

    const currentPage = Number(payload?.meta?.currentPage ?? page);
    const lastPage = Number(payload?.meta?.lastPage ?? currentPage);
    if (pageRows.length === 0 || currentPage >= lastPage) {
      break;
    }

    page += 1;
  }

  return rows;
};

const normalizeDebtRows = (
  rows: Array<Record<string, unknown>>,
  patientFallback: (id: string) => string
): DebtRow[] => {
  return rows
    .map((row): DebtRow | null => {
      const debtId = asText(row.id);
      const invoiceId = asText(row.invoiceId ?? row.invoice_id);
      if (!debtId || !invoiceId) return null;

      const status = asText(row.status || 'open').toLowerCase();
      if (status !== 'open') {
        return null;
      }

      const patient = (row.patient ?? {}) as Record<string, unknown>;
      const patientName = `${asText(patient.firstName)} ${asText(patient.lastName)}`.trim()
        || asText(patient.patientCode)
        || patientFallback(asText(row.patientId ?? row.patient_id) || '-');

      const netAmountInput = parseAmount(row.netAmount ?? row.net_amount);
      const paidAmount = parseAmount(row.paidAmount ?? row.paid_amount);
      const debtInput = parseAmount(row.debtAmount ?? row.debt_amount);

      if (debtInput <= 0) return null;

      return {
        debtId,
        debtInput,
        invoiceDate: asText(row.invoiceDate ?? row.invoice_date),
        invoiceId,
        netAmountInput,
        paidAmount: Number(paidAmount.toFixed(2)),
        patientId: asText(row.patientId ?? row.patient_id),
        patientName,
        status,
      };
    })
    .filter((row): row is DebtRow => row !== null)
    .sort((left, right) => right.invoiceDate.localeCompare(left.invoiceDate));
};

const getSettledNote = (baseNote: string, row: DebtRow): string => {
  const prefix = `Debt settled for invoice #${row.invoiceId}`;
  const note = baseNote.trim();
  return note ? `${prefix} - ${note}` : prefix;
};

// eslint-disable-next-line react/function-component-definition
export default function DebtsPage(): JSX.Element {
  const locale = useLocale();
  const tDebts = useTranslations('app.debtsPage');
  const tSidebar = useTranslations('sidebar');
  const tReports = useTranslations('sidebar.reports');
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState<SettleFormState>(() => createDefaultForm());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshDebts = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const debtRows = await fetchAllDebtRows();
      const normalizedRows = normalizeDebtRows(debtRows, (id) => tDebts('patientFallback', { id }));
      setRows(normalizedRows);
      const normalizedIds = new Set(normalizedRows.map((row) => row.debtId));
      setSelectedIds((previous) => previous.filter((id) => normalizedIds.has(id)));
    } finally {
      setIsLoading(false);
    }
  }, [tDebts]);

  useEffect(() => {
    void refreshDebts();
  }, [refreshDebts]);

  const selectedRows = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return rows.filter((row) => selectedSet.has(row.debtId));
  }, [rows, selectedIds]);

  const summary = useMemo(() => {
    const totalDebt = Number(rows.reduce((sum, row) => sum + row.debtInput, 0).toFixed(2));
    const selectedDebt = Number(selectedRows.reduce((sum, row) => sum + row.debtInput, 0).toFixed(2));
    return {
      count: rows.length,
      selectedCount: selectedRows.length,
      selectedDebt,
      totalDebt,
    };
  }, [rows, selectedRows]);

  const toggleSelectAll = (checked: boolean): void => {
    if (checked) {
      setSelectedIds(rows.map((row) => row.debtId));
      return;
    }
    setSelectedIds([]);
  };

  const toggleRow = (id: string, checked: boolean): void => {
    setSelectedIds((previous) => {
      if (checked) {
        return previous.includes(id) ? previous : [...previous, id];
      }
      return previous.filter((item) => item !== id);
    });
  };

  const handleSettleSelected = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (selectedRows.length === 0) {
      toast.error(tDebts('selectAtLeastOne'));
      return;
    }

    setIsSubmitting(true);

    void Promise.allSettled(
      selectedRows.map(async (row) => {
        await client.post(`/api/v1/dental-management/debts/${row.debtId}/settle`, {
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
          await refreshDebts();
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
            <Card className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 via-background to-amber-50">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Wallet className="size-5 text-rose-500" />
                  {tDebts('title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <form onSubmit={handleSettleSelected} className="grid gap-3 rounded-2xl border bg-background/90 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="debt-date">{tDebts('paymentDate')}</Label>
                      <Input
                        id="debt-date"
                        type="date"
                        value={form.paymentDate}
                        onChange={(event) => setForm((previous) => ({ ...previous, paymentDate: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="debt-method">{tDebts('paymentMethod')}</Label>
                      <select
                        id="debt-method"
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.method}
                        onChange={(event) => setForm((previous) => ({ ...previous, method: event.target.value as SettleFormState['method'] }))}
                      >
                        <option value="cash">{tDebts('methods.cash')}</option>
                        <option value="card">{tDebts('methods.card')}</option>
                        <option value="insurance">{tDebts('methods.insurance')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="debt-notes">{tDebts('notes')}</Label>
                    <Input
                      id="debt-notes"
                      value={form.notes}
                      onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
                      placeholder={tDebts('notesPlaceholder')}
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting || summary.selectedCount === 0}>
                    {isSubmitting
                      ? tDebts('saving')
                      : tDebts('settleSelected', { count: summary.selectedCount })}
                  </Button>
                </form>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-xl border bg-white/85 p-3">
                    <p className="text-xs text-muted-foreground">{tDebts('outstandingDebt')}</p>
                    <p className="text-lg font-semibold">{formatCurrency(summary.totalDebt, 'AFN')}</p>
                    <p className="text-xs text-muted-foreground">{tDebts('openInvoices', { count: summary.count })}</p>
                  </div>
                  <div className="rounded-xl border bg-white/85 p-3">
                    <p className="text-xs text-muted-foreground">{tDebts('selectedDebt')}</p>
                    <p className="text-lg font-semibold">{formatCurrency(summary.selectedDebt, 'AFN')}</p>
                    <p className="text-xs text-muted-foreground">{tDebts('selectedCount', { count: summary.selectedCount })}</p>
                  </div>
                  <div className="rounded-xl border bg-white/85 p-3 text-xs text-muted-foreground">
                    {tDebts('helpText')}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{tDebts('outstandingDebtsTable')}</CardTitle>
                <Button type="button" variant="outline" onClick={() => void refreshDebts()} disabled={isLoading}>
                  {isLoading ? tDebts('refreshing') : tDebts('refresh')}
                </Button>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    {isLoading ? tDebts('loading') : tDebts('noDebts')}
                  </p>
                ) : (
                  <div className="overflow-auto rounded-xl border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30 text-left">
                        <tr className="border-b">
                          <th className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={summary.selectedCount > 0 && summary.selectedCount === rows.length}
                              onChange={(event) => toggleSelectAll(event.target.checked)}
                              aria-label={tDebts('ariaSelectAll')}
                            />
                          </th>
                          <th className="px-3 py-2">{tDebts('columns.invoice')}</th>
                          <th className="px-3 py-2">{tDebts('columns.patient')}</th>
                          <th className="px-3 py-2">{tDebts('columns.date')}</th>
                          <th className="px-3 py-2">{tDebts('columns.status')}</th>
                          <th className="px-3 py-2">{tDebts('columns.net')}</th>
                          <th className="px-3 py-2">{tDebts('columns.paid')}</th>
                          <th className="px-3 py-2">{tDebts('columns.debt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const checked = selectedIds.includes(row.debtId);
                          return (
                            <tr key={row.debtId} className="border-b last:border-0">
                              <td className="px-3 py-2 align-top">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => toggleRow(row.debtId, event.target.checked)}
                                  aria-label={tDebts('ariaSelectInvoice', { invoiceId: row.invoiceId })}
                                />
                              </td>
                              <td className="px-3 py-2 align-top font-medium">#{row.invoiceId}</td>
                              <td className="px-3 py-2 align-top">
                                <p>{row.patientName}</p>
                                <p className="text-xs text-muted-foreground">{tDebts('patientIdLabel', { id: row.patientId || '-' })}</p>
                              </td>
                              <td className="px-3 py-2 align-top">{formatDisplayDate(row.invoiceDate, locale)}</td>
                              <td className="px-3 py-2 align-top">{row.status || tDebts('openStatus')}</td>
                              <td className="px-3 py-2 align-top">
                                {formatCurrency(row.netAmountInput, 'AFN')}
                              </td>
                              <td className="px-3 py-2 align-top">{formatCurrency(row.paidAmount, 'AFN')}</td>
                              <td className="px-3 py-2 align-top font-semibold text-rose-600">
                                {formatCurrency(row.debtInput, 'AFN')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
