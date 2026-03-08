'use client';

import { FormEvent, JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { fetchAllRows } from '@/modules/common/infrastructure/api/fetch-all-rows';
import { useStaffList } from '@/modules/dental-management/presentation/hooks';
import {
  formatCurrency,
  parseMoney,
} from '@/lib/currency-utils';
import { ReceiptText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type SalaryRow = {
  currency: 'AFN';
  id: string;
  netAmount: number;
  netAmountInput: number;
  paymentDate: string;
  salaryMonth: string;
  staffId: string;
  staffName: string;
  status: string;
};

type SalaryForm = {
  bonusAmount: string;
  deductionAmount: string;
  grossAmount: string;
  notes: string;
  paidFromSafe: boolean;
  paymentDate: string;
  salaryMonth: string;
  staffId: string;
  status: 'paid' | 'partial' | 'pending';
};

const client = new AxiosClient();
const API_MAX_PER_PAGE = 100;

const toInputDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toMonthValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const buildSalaryMonthOptions = (monthsBack: number): Array<{ label: string; value: string }> => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  const options: Array<{ label: string; value: string }> = [];

  for (let index = 0; index < monthsBack; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    options.push({
      label: formatter.format(date),
      value: toMonthValue(date),
    });
  }

  return options;
};

const parseAmount = (value: string): number => parseMoney(value);

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } } } })?.response;
  const payload = response?.data?.error;
  const code = payload?.code;

  if (code === 'SAFE_BALANCE_INSUFFICIENT') {
    const currentBalance = Number(payload?.details?.currentBalance ?? 0);
    const requestedAmount = Number(payload?.details?.requestedAmount ?? 0);
    return `Safe balance is not enough. Current: ${formatCurrency(currentBalance, 'AFN')}. Requested: ${formatCurrency(requestedAmount, 'AFN')}. Add money to safe or reduce the salary amount.`;
  }

  if (payload?.message) {
    return payload.message;
  }

  return fallback;
};

const defaultForm = (): SalaryForm => ({
  bonusAmount: '0',
  deductionAmount: '0',
  grossAmount: '',
  notes: '',
  paidFromSafe: true,
  paymentDate: toInputDate(new Date()),
  salaryMonth: toMonthValue(new Date()),
  staffId: '',
  status: 'paid',
});

// eslint-disable-next-line react/function-component-definition
export default function SalariesPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar');
  const tReports = useTranslations('sidebar.reports');
  const { entities: staff } = useStaffList(1, 100);
  const [form, setForm] = useState<SalaryForm>(() => defaultForm());
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const salaryMonthOptions = useMemo(() => buildSalaryMonthOptions(24), []);

  const fetchAllSalaryRows = useCallback(async (): Promise<Array<Record<string, unknown>>> => {
    return fetchAllRows(
      client,
      '/api/v1/dental-management/salary-payments',
      {
        include: ['staff'],
        sortBy: 'paymentDate',
        sortDirection: 'desc',
      },
      API_MAX_PER_PAGE
    );
  }, []);

  const fetchData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const items = await fetchAllSalaryRows();
      setRows(items.map((row) => {
        const staffRow = row.staff as Record<string, unknown> | undefined;
        const staffName = staffRow
          ? [String(staffRow.firstName ?? ''), String(staffRow.lastName ?? '')].filter(Boolean).join(' ')
          : '';
        return {
          currency: 'AFN',
          id: String(row.id ?? ''),
          netAmount: Number(row.netAmount ?? row.net_amount ?? 0),
          netAmountInput: Number(row.netAmountInput ?? row.net_amount_input ?? row.netAmount ?? row.net_amount ?? 0),
          paymentDate: String(row.paymentDate ?? row.payment_date ?? ''),
          salaryMonth: String(row.salaryMonth ?? row.salary_month ?? ''),
          staffId: String(row.staffId ?? row.staff_id ?? ''),
          staffName: staffName || String(staffRow?.fullName ?? staffRow?.name ?? ''),
          status: String(row.status ?? ''),
        };
      }));
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllSalaryRows]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const totals = useMemo(() => {
    const paid = rows
      .filter((row) => row.status === 'paid' || row.status === 'partial')
      .reduce((sum, row) => sum + row.netAmount, 0);

    return {
      paid,
      pendingCount: rows.filter((row) => row.status === 'pending').length,
      totalCount: rows.length,
    };
  }, [rows]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const grossAmount = parseAmount(form.grossAmount);
    const bonusAmount = parseAmount(form.bonusAmount);
    const deductionAmount = parseAmount(form.deductionAmount);
    if (!form.staffId || grossAmount <= 0 || !form.salaryMonth || !form.paymentDate) {
      return;
    }

    const netAmount = Math.max(0, grossAmount + bonusAmount - deductionAmount);

    setIsSubmitting(true);
    void client
      .post('/api/v1/dental-management/salary-payments', {
        bonusAmount,
        currency: 'AFN',
        deductionAmount,
        exchangeRate: 1,
        grossAmount,
        netAmount,
        notes: form.notes.trim() || undefined,
        paidFromSafe: form.paidFromSafe,
        paymentDate: form.paymentDate,
        salaryMonth: form.salaryMonth,
        staffId: Number(form.staffId),
        status: form.status,
      })
      .then(async () => {
        setForm(defaultForm());
        await fetchData();
        toast.success('Salary payment saved.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to save salary payment.'));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const removeRow = (id: string): void => {
    void client
      .delete(`/api/v1/dental-management/salary-payments/${id}`)
      .then(async () => {
        await fetchData();
        toast.success('Salary payment deleted.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to delete salary payment.'));
      });
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'salaries', isCurrent: true, label: tReports('salaries') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <Card className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-background to-blue-50">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <ReceiptText className="size-5 text-violet-700" />
                  Salaries Register
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
                <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border bg-background/85 p-4">
                  <div className="grid gap-1.5">
                    <Label>Staff</Label>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={form.staffId}
                      onChange={(event) => setForm((prev) => ({ ...prev, staffId: event.target.value }))}
                      required
                    >
                      <option value="">Select staff</option>
                      {staff.map((member) => (
                        <option key={member.id} value={String(member.id)}>
                          {member.fullName || `Staff #${member.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Salary Month</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.salaryMonth}
                        onChange={(event) => setForm((prev) => ({ ...prev, salaryMonth: event.target.value }))}
                        required
                      >
                        {salaryMonthOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Payment Date</Label>
                      <Input
                        type="date"
                        value={form.paymentDate}
                        onChange={(event) => setForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                      <Label>Gross</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.grossAmount}
                        onChange={(event) => setForm((prev) => ({ ...prev, grossAmount: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Bonus</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.bonusAmount}
                        onChange={(event) => setForm((prev) => ({ ...prev, bonusAmount: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Deduction</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.deductionAmount}
                        onChange={(event) => setForm((prev) => ({ ...prev, deductionAmount: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Status</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.status}
                        onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as SalaryForm['status'] }))}
                      >
                        <option value="paid">Paid</option>
                        <option value="partial">Partial</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Paid from safe</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.paidFromSafe ? 'yes' : 'no'}
                        onChange={(event) => setForm((prev) => ({ ...prev, paidFromSafe: event.target.value === 'yes' }))}
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
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
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Salary Entry'}</Button>
                </form>

                <div className="grid gap-3">
                  <div className="rounded-2xl border bg-white/90 p-4">
                    <p className="text-xs text-muted-foreground">Paid Salaries</p>
                    <p className="text-2xl font-semibold">{formatCurrency(totals.paid, 'AFN')}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-violet-100/70 p-3 text-violet-900">
                      <p className="text-xs">Total Rows</p>
                      <p className="text-lg font-semibold">{totals.totalCount}</p>
                    </div>
                    <div className="rounded-xl border bg-orange-100/70 p-3 text-orange-900">
                      <p className="text-xs">Pending</p>
                      <p className="text-lg font-semibold">{totals.pendingCount}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader>
                <CardTitle>Salaries Table</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <LoadingState
                    title="Loading salaries"
                    description="Fetching salary rows and recalculating payment totals."
                  />
                ) : rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No salary records yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2">Month</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Staff</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Net</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id} className="border-b">
                            <td className="px-3 py-2">{row.salaryMonth}</td>
                            <td className="px-3 py-2">{row.paymentDate}</td>
                            <td className="px-3 py-2">{row.staffName || `Staff #${row.staffId}`}</td>
                            <td className="px-3 py-2 capitalize">{row.status}</td>
                            <td className="px-3 py-2 font-semibold">{formatCurrency(row.netAmountInput, 'AFN')}</td>
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

