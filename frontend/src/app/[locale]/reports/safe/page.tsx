'use client';

import { FormEvent, JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { useStaffList } from '@/modules/dental-management/presentation/hooks';
import {
  DEFAULT_AFN_PER_USD,
  formatCurrency,
  formatDualFromUsd,
  getExchangeRate,
  parseMoney,
  updateExchangeRate,
} from '@/lib/currency-utils';
import { HandCoins, Trash2, Vault } from 'lucide-react';
import { toast } from 'sonner';

type SafeRow = {
  amount: number;
  amountInput: number;
  currency: 'AFN' | 'USD';
  direction: string;
  exchangeRate: number;
  entryType: string;
  id: string;
  notes: string;
  pickedByStaffId: string;
  pickedByStaffName: string;
  transactionDate: string;
};

type SafeForm = {
  amount: string;
  currency: 'AFN' | 'USD';
  direction: 'in' | 'out';
  exchangeRate: string;
  entryType: string;
  notes: string;
  pickedByStaffId: string;
  transactionDate: string;
};

type PaginatedRowsResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: {
    currentPage?: number;
    lastPage?: number;
  };
};

const client = new AxiosClient();
const API_MAX_PER_PAGE = 100;

const toInputDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseAmount = (value: string): number => parseMoney(value);

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } } } })?.response;
  const payload = response?.data?.error;
  const code = payload?.code;

  if (code === 'SAFE_BALANCE_INSUFFICIENT') {
    const currentBalance = Number(payload?.details?.currentBalance ?? 0);
    const requestedAmount = Number(payload?.details?.requestedAmount ?? 0);
    return `Safe balance is not enough. Current: ${formatCurrency(currentBalance, 'USD')}. Requested: ${formatCurrency(requestedAmount, 'USD')}.`;
  }

  return payload?.message || fallback;
};

const defaultForm = (afnPerUsd: number): SafeForm => ({
  amount: '',
  currency: 'USD',
  direction: 'in',
  exchangeRate: String(afnPerUsd),
  entryType: 'deposit',
  notes: '',
  pickedByStaffId: '',
  transactionDate: toInputDate(new Date()),
});

// eslint-disable-next-line react/function-component-definition
export default function SafePage(): JSX.Element {
  const tSidebar = useTranslations('sidebar');
  const tReports = useTranslations('sidebar.reports');
  const { entities: staff } = useStaffList(1, 100);
  const [afnPerUsd, setAfnPerUsd] = useState(DEFAULT_AFN_PER_USD);
  const [form, setForm] = useState<SafeForm>(() => defaultForm(DEFAULT_AFN_PER_USD));
  const [rows, setRows] = useState<SafeRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);

  const fetchAllSafeRows = useCallback(async (): Promise<Array<Record<string, unknown>>> => {
    const rows: Array<Record<string, unknown>> = [];
    let page = 1;

    while (true) {
      const response = await client.get<PaginatedRowsResponse>('/api/v1/dental-management/safe-transactions', {
        params: {
          include: ['pickedByStaff'],
          page,
          perPage: API_MAX_PER_PAGE,
          sortBy: 'transactionDate',
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
  }, []);

  const fetchData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [allRows, balanceResponse] = await Promise.all([
        fetchAllSafeRows(),
        client.get<{ afnPerUsd?: number; balance?: number; totalIn?: number; totalOut?: number }>('/api/v1/dental-management/safe-transactions/balance'),
      ]);

      const list = Array.isArray(allRows) ? allRows : [];
      setRows(list.map((row) => ({
        amount: Number(row.amount ?? 0),
        amountInput: Number(row.amountInput ?? row.amount_input ?? row.amount ?? 0),
        currency: (String(row.currency ?? 'USD').toUpperCase() as 'AFN' | 'USD'),
        direction: String(row.direction ?? ''),
        exchangeRate: Number(row.exchangeRate ?? row.exchange_rate ?? 1),
        entryType: String(row.entryType ?? row.entry_type ?? ''),
        id: String(row.id ?? ''),
        notes: String(row.notes ?? ''),
        pickedByStaffId: String(row.pickedByStaffId ?? row.picked_by_staff_id ?? ''),
        pickedByStaffName: (() => {
          const pickedBy = row.pickedByStaff as Record<string, unknown> | undefined;
          if (!pickedBy) return '';
          const fullName = [String(pickedBy.firstName ?? ''), String(pickedBy.lastName ?? '')]
            .filter(Boolean)
            .join(' ')
            .trim();
          return fullName || String(pickedBy.fullName ?? '');
        })(),
        transactionDate: String(row.transactionDate ?? row.transaction_date ?? ''),
      })));
      setBalance(Number(balanceResponse.data?.balance ?? 0));
      setTotalIn(Number(balanceResponse.data?.totalIn ?? 0));
      setTotalOut(Number(balanceResponse.data?.totalOut ?? 0));
      const rate = Number(balanceResponse.data?.afnPerUsd ?? afnPerUsd);
      if (Number.isFinite(rate) && rate > 0) {
        setAfnPerUsd(rate);
        setForm((prev) => ({ ...prev, exchangeRate: String(rate) }));
      }
    } finally {
      setIsLoading(false);
    }
  }, [afnPerUsd, fetchAllSafeRows]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    void getExchangeRate(client).then((rate) => {
      setAfnPerUsd(rate);
      setForm((prev) => ({ ...prev, exchangeRate: String(rate) }));
    });
  }, []);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [rows]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const rawAmount = parseAmount(form.amount);
    if (!form.transactionDate || rawAmount <= 0) {
      return;
    }
    const exchangeRate = Math.max(0.000001, parseAmount(form.exchangeRate) || afnPerUsd);

    setIsSubmitting(true);
    void client
      .post('/api/v1/dental-management/safe-transactions', {
        amount: rawAmount,
        currency: form.currency,
        direction: form.direction,
        exchangeRate,
        entryType: form.entryType,
        notes: form.notes.trim() || undefined,
        pickedByStaffId: form.pickedByStaffId || undefined,
        sourceType: null,
        transactionDate: form.transactionDate,
      })
      .then(async () => {
        setForm(defaultForm(afnPerUsd));
        await fetchData();
        toast.success('Safe transaction saved.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to save safe transaction.'));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleSaveExchangeRate = (): void => {
    const rate = parseAmount(form.exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error('Please enter a valid exchange rate.');
      return;
    }

    setIsSavingRate(true);
    void updateExchangeRate(client, rate)
      .then((savedRate) => {
        setAfnPerUsd(savedRate);
        setForm((prev) => ({ ...prev, exchangeRate: String(savedRate) }));
        toast.success('Exchange rate updated.');
      })
      .catch(() => {
        toast.error('Failed to update exchange rate.');
      })
      .finally(() => {
        setIsSavingRate(false);
      });
  };

  const removeRow = (id: string): void => {
    void client
      .delete(`/api/v1/dental-management/safe-transactions/${id}`)
      .then(async () => {
        await fetchData();
        toast.success('Safe transaction deleted.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to delete safe transaction.'));
      });
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'safe', isCurrent: true, label: tReports('safe') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <Card className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-background to-cyan-50">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Vault className="size-5 text-emerald-700" />
                  Safe Ledger
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border bg-background/85 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={form.transactionDate}
                        onChange={(event) => setForm((prev) => ({ ...prev, transactionDate: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Currency</Label>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={form.currency}
                      onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value as 'AFN' | 'USD' }))}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="AFN">AFN (Afghani)</option>
                    </select>
                    {form.amount ? (
                      <p className="text-xs text-muted-foreground">
                        {form.currency === 'USD'
                          ? `Equivalent: ${formatCurrency((parseAmount(form.amount) || 0) * (parseAmount(form.exchangeRate) || afnPerUsd), 'AFN')}`
                          : `Equivalent: ${formatCurrency((parseAmount(form.amount) || 0) / Math.max(parseAmount(form.exchangeRate) || afnPerUsd, 0.000001), 'USD')}`}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-2">
                    <div className="grid gap-1.5">
                      <Label>Exchange Rate (AFN per 1 USD)</Label>
                      <Input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={form.exchangeRate}
                        onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))}
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveExchangeRate}
                      disabled={isSavingRate}
                    >
                      {isSavingRate ? 'Saving...' : 'Save Rate'}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Direction</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.direction}
                        onChange={(event) => setForm((prev) => ({ ...prev, direction: event.target.value as 'in' | 'out' }))}
                      >
                        <option value="in">In</option>
                        <option value="out">Out</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Type</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.entryType}
                        onChange={(event) => setForm((prev) => ({ ...prev, entryType: event.target.value }))}
                      >
                        <option value="deposit">Deposit</option>
                        <option value="withdrawal">Withdrawal</option>
                        <option value="adjustment">Adjustment</option>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Picked by staff (optional)</Label>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={form.pickedByStaffId}
                      onChange={(event) => setForm((prev) => ({ ...prev, pickedByStaffId: event.target.value }))}
                    >
                      <option value="">Not selected</option>
                      {staff.map((member) => (
                        <option key={member.id} value={String(member.id)}>
                          {member.fullName || `Staff #${member.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Notes</Label>
                    <textarea
                      className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.notes}
                      onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Optional note"
                    />
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Add Safe Transaction'}
                  </Button>
                </form>

                <div className="grid gap-3">
                  <div className="rounded-2xl border bg-white/90 p-4">
                    <p className="text-xs text-muted-foreground">Current Safe Balance</p>
                    <p className="text-3xl font-semibold">{formatDualFromUsd(balance, afnPerUsd)}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-emerald-100/70 p-3 text-emerald-900">
                      <p className="text-xs">Total In</p>
                      <p className="text-lg font-semibold">{formatDualFromUsd(totalIn, afnPerUsd)}</p>
                    </div>
                    <div className="rounded-xl border bg-orange-100/70 p-3 text-orange-900">
                      <p className="text-xs">Total Out</p>
                      <p className="text-lg font-semibold">{formatDualFromUsd(totalOut, afnPerUsd)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white/90 p-3 text-sm text-muted-foreground">
                    Safe outflow tracks who picked money (when selected) and appears in reports. Conversion rate: 1 USD = {afnPerUsd} AFN.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <HandCoins className="size-5 text-primary" />
                  Safe Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Loading safe entries...</p>
                ) : sortedRows.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No safe transactions yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Direction</th>
                          <th className="px-3 py-2">Picked By</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Currency</th>
                          <th className="px-3 py-2">Notes</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRows.map((row) => (
                          <tr key={row.id} className="border-b">
                            <td className="px-3 py-2">{row.transactionDate}</td>
                            <td className="px-3 py-2 capitalize">{row.entryType.replace('_', ' ')}</td>
                            <td className="px-3 py-2 uppercase">{row.direction}</td>
                            <td className="px-3 py-2">{row.pickedByStaffName || '-'}</td>
                            <td className="px-3 py-2 font-semibold">{formatDualFromUsd(row.amount, afnPerUsd)}</td>
                            <td className="px-3 py-2">
                              {formatCurrency(row.amountInput, row.currency)} ({row.currency})
                            </td>
                            <td className="px-3 py-2">{row.notes || '-'}</td>
                            <td className="px-3 py-2">
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(row.id)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
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

