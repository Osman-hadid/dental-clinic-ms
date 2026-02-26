'use client';

import { FormEvent, JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import {
  DEFAULT_AFN_PER_USD,
  formatCurrency,
  formatDualFromUsd,
  getExchangeRate,
  parseMoney,
} from '@/lib/currency-utils';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

type ClinicalExpenseRecord = {
  amountInput: number;
  category: string;
  createdAt?: string;
  currency: 'AFN' | 'USD';
  date: string;
  exchangeRate: number;
  expenseType?: string;
  id: string;
  itemName: string;
  notes: string;
  quantity: number;
  totalCost: number;
  unitCost: number;
  vendor: string;
};

type PaginatedRowsResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: {
    currentPage?: number;
    lastPage?: number;
  };
};

type ClinicalExpenseForm = {
  category: string;
  currency: 'AFN' | 'USD';
  date: string;
  exchangeRate: string;
  itemName: string;
  notes: string;
  quantity: string;
  unitCost: string;
  vendor: string;
};

const categoryOptions = [
  'Dental Accessories',
  'Implants',
  'Chair & Unit',
  'Sterilization',
  'Imaging',
  'Consumables',
  'Other',
];
const categoryColors = ['#0ea5e9', '#14b8a6', '#22c55e', '#f97316', '#f59e0b', '#6366f1', '#a855f7'];

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

const createDefaultForm = (afnPerUsd: number): ClinicalExpenseForm => ({
  category: 'Dental Accessories',
  currency: 'USD',
  date: toInputDate(new Date()),
  exchangeRate: String(afnPerUsd),
  itemName: '',
  notes: '',
  quantity: '1',
  unitCost: '',
  vendor: '',
});

const client = new AxiosClient();
const API_MAX_PER_PAGE = 100;
const parseNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeExpenseRow = (row: Record<string, unknown>): ClinicalExpenseRecord => ({
  amountInput: parseNumber(row.amountInput ?? row.amount_input ?? row.amount),
  category: String(row.category ?? 'Other'),
  createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
  currency: (String(row.currency ?? 'USD').toUpperCase() as 'AFN' | 'USD'),
  date: String(row.expenseDate ?? row.date ?? ''),
  exchangeRate: parseNumber(row.exchangeRate ?? row.exchange_rate ?? 1),
  expenseType: typeof row.expenseType === 'string' ? row.expenseType : undefined,
  id: String(row.id ?? ''),
  itemName: String(row.title ?? row.itemName ?? ''),
  notes: String(row.notes ?? ''),
  quantity: parseNumber(row.quantity) || 1,
  totalCost: parseNumber(row.amount),
  unitCost: parseNumber(row.unitCost) || parseNumber(row.amount),
  vendor: String(row.vendor ?? ''),
});

const ClinicalExpensesPage = (): JSX.Element => {
  const tReports = useTranslations('sidebar.reports');
  const tSidebar = useTranslations('sidebar');
  const [afnPerUsd, setAfnPerUsd] = useState(DEFAULT_AFN_PER_USD);
  const [form, setForm] = useState<ClinicalExpenseForm>(() => createDefaultForm(DEFAULT_AFN_PER_USD));
  const [records, setRecords] = useState<ClinicalExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAllExpenses = useCallback(async (): Promise<Array<Record<string, unknown>>> => {
    const rows: Array<Record<string, unknown>> = [];
    let page = 1;

    while (true) {
      const response = await client.get<PaginatedRowsResponse>('/api/v1/dental-management/expenses', {
        params: {
          page,
          perPage: API_MAX_PER_PAGE,
          sortBy: 'expenseDate',
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

  const fetchExpenses = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const allRows = await fetchAllExpenses();
      const rows = Array.isArray(allRows)
        ? allRows
          .map(normalizeExpenseRow)
          .filter((row) => row.expenseType === 'clinical')
        : [];
      setRecords(rows);
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllExpenses]);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    void getExchangeRate(client).then((rate) => {
      setAfnPerUsd(rate);
      setForm((prev) => ({ ...prev, exchangeRate: String(rate) }));
    });
  }, []);

  const summary = useMemo(() => {
    const grouped = new Map<string, number>();
    let total = 0;
    records.forEach((record) => {
      total += record.totalCost;
      const current = grouped.get(record.category) ?? 0;
      grouped.set(record.category, current + record.totalCost);
    });

    const byCategory = Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { byCategory, total };
  }, [records]);

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
  }, [records]);

  const handleCreate = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const quantity = Math.max(0, parseAmount(form.quantity));
    const unitCost = Math.max(0, parseAmount(form.unitCost));
    const totalCost = quantity * unitCost;
    const exchangeRate = Math.max(0.000001, parseAmount(form.exchangeRate) || afnPerUsd);

    if (!form.itemName.trim() || !form.date || quantity <= 0 || unitCost <= 0) {
      return;
    }

    setIsSubmitting(true);
    void client
      .post('/api/v1/dental-management/expenses', {
        amount: totalCost,
        category: form.category,
        currency: form.currency,
        exchangeRate,
        expenseDate: form.date,
        expenseType: 'clinical',
        notes: form.notes.trim() || undefined,
        paymentMethod: 'bank_transfer',
        quantity,
        title: form.itemName.trim(),
        unitCost,
        vendor: form.vendor.trim() || undefined,
      })
      .then(async () => {
        setForm(createDefaultForm(afnPerUsd));
        await fetchExpenses();
        toast.success('Clinical expense saved.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to save clinical expense.'));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const removeRecord = (id: string): void => {
    void client
      .delete(`/api/v1/dental-management/expenses/${id}`)
      .then(async () => {
        await fetchExpenses();
        toast.success('Clinical expense deleted.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to delete clinical expense.'));
      });
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'clinicalExpenses', isCurrent: true, label: tReports('clinicalExpenses') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <Card className="overflow-hidden rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-background to-blue-50">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <ShoppingBag className="size-5 text-cyan-700" />
                  Clinical Buys Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border bg-background/85 p-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="item-name">Item Name</Label>
                    <Input
                      id="item-name"
                      value={form.itemName}
                      onChange={(event) => setForm((prev) => ({ ...prev, itemName: event.target.value }))}
                      placeholder="Implant screw set"
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="buy-date">Date</Label>
                      <Input
                        id="buy-date"
                        type="date"
                        value={form.date}
                        onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="buy-category">Category</Label>
                      <select
                        id="buy-category"
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.category}
                        onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                      >
                        {categoryOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="buy-currency">Currency</Label>
                      <select
                        id="buy-currency"
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.currency}
                        onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value as 'AFN' | 'USD' }))}
                      >
                        <option value="USD">USD ($)</option>
                        <option value="AFN">AFN (Afghani)</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="buy-exchange-rate">Exchange Rate (AFN per 1 USD)</Label>
                      <Input
                        id="buy-exchange-rate"
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={form.exchangeRate}
                        onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        step="1"
                        value={form.quantity}
                        onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="unit-cost">Unit Cost</Label>
                      <Input
                        id="unit-cost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.unitCost}
                        onChange={(event) => setForm((prev) => ({ ...prev, unitCost: event.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="vendor">Vendor</Label>
                    <Input
                      id="vendor"
                      value={form.vendor}
                      onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))}
                      placeholder="Supplier / company"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="buy-notes">Notes</Label>
                    <textarea
                      id="buy-notes"
                      className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.notes}
                      onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Optional note"
                    />
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Add Clinical Expense'}
                  </Button>
                </form>

                <div className="grid gap-3">
                  <div className="rounded-xl border bg-white/90 p-4">
                    <p className="text-xs text-muted-foreground">Total Clinical Buying Cost</p>
                    <p className="text-2xl font-semibold">{formatDualFromUsd(summary.total, afnPerUsd)}</p>
                  </div>
                  <div className="h-64 rounded-2xl border bg-white/90 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={summary.byCategory}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={2}
                        >
                          {summary.byCategory.map((entry, index) => (
                            <Cell key={entry.name} fill={categoryColors[index % categoryColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value), 'USD')} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid gap-2">
                    {summary.byCategory.slice(0, 4).map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between rounded-lg border bg-white/90 px-3 py-2 text-sm">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: categoryColors[index % categoryColors.length] }} />
                          {item.name}
                        </span>
                        <span className="font-semibold">{formatDualFromUsd(item.value, afnPerUsd)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader>
                <CardTitle>Clinical Buying History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Loading clinical expense records...
                  </p>
                ) : sortedRecords.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No clinical buying expenses yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Unit Cost</th>
                          <th className="px-3 py-2">Total</th>
                          <th className="px-3 py-2">Currency</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRecords.map((record) => (
                          <tr key={record.id} className="border-b">
                            <td className="px-3 py-2">{record.date}</td>
                            <td className="px-3 py-2">{record.itemName}</td>
                            <td className="px-3 py-2">{record.category}</td>
                            <td className="px-3 py-2">{record.quantity}</td>
                            <td className="px-3 py-2">{formatDualFromUsd(record.unitCost, afnPerUsd)}</td>
                            <td className="px-3 py-2 font-semibold">{formatDualFromUsd(record.totalCost, afnPerUsd)}</td>
                            <td className="px-3 py-2">
                              {formatCurrency(record.amountInput, record.currency)} ({record.currency})
                            </td>
                            <td className="px-3 py-2">
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeRecord(record.id)}>
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
};

export default ClinicalExpensesPage;

