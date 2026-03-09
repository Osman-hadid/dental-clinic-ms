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
import { useStaffList } from '@/modules/dental-management/presentation/hooks';
import { createDefaultReportRange, fetchReport, toInputDate } from '@/modules/dental-management/presentation/reports/report-client';
import { formatCurrency, parseMoney } from '@/lib/currency-utils';
import { ReceiptText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type SalaryRow = {
  createdAt: string;
  id: number;
  netAmountInput: number;
  paymentDate: string;
  salaryMonth: string;
  staffId: number;
  staffName: string;
  status: string;
};

type SalaryReportResponse = {
  rows: {
    data: SalaryRow[];
    meta: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
    };
  };
  summary: {
    paidTotal: number;
    pendingCount: number;
    totalCount: number;
  };
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

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } } } })?.response;
  const payload = response?.data?.error;
  const code = payload?.code;

  if (code === 'SAFE_BALANCE_INSUFFICIENT') {
    const currentBalance = Number(payload?.details?.currentBalance ?? 0);
    const requestedAmount = Number(payload?.details?.requestedAmount ?? 0);
    return `Safe balance is not enough. Current: ${formatCurrency(currentBalance, 'AFN')}. Requested: ${formatCurrency(requestedAmount, 'AFN')}. Add money to safe or reduce the salary amount.`;
  }

  return payload?.message || fallback;
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

export default function SalariesPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar');
  const tReports = useTranslations('sidebar.reports');
  const { entities: staff } = useStaffList(1, 100);
  const range = createDefaultReportRange(180);
  const [form, setForm] = useState<SalaryForm>(() => defaultForm());
  const [report, setReport] = useState<SalaryReportResponse | null>(null);
  const [startDate, setStartDate] = useState(range.startDate);
  const [endDate, setEndDate] = useState(range.endDate);
  const [staffFilter, setStaffFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const salaryMonthOptions = useMemo(() => buildSalaryMonthOptions(24), []);

  const fetchData = useCallback(async (pageNumber = page): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await fetchReport<SalaryReportResponse>('/api/v1/dental-management/reports/salaries', {
        endDate,
        page: pageNumber,
        perPage: 12,
        search,
        sortBy: 'paymentDate',
        sortDirection: 'desc',
        staffId: staffFilter,
        startDate,
      });
      setReport(data);
      setPage(pageNumber);
    } finally {
      setIsLoading(false);
    }
  }, [endDate, page, search, staffFilter, startDate]);

  useEffect(() => {
    void fetchData(1);
  }, [fetchData]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const grossAmount = parseMoney(form.grossAmount);
    const bonusAmount = parseMoney(form.bonusAmount);
    const deductionAmount = parseMoney(form.deductionAmount);
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
        await fetchData(1);
        toast.success('Salary payment saved.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to save salary payment.'));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const removeRow = (id: number): void => {
    void client
      .delete(`/api/v1/dental-management/salary-payments/${id}`)
      .then(async () => {
        await fetchData(page);
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
                    <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.staffId} onChange={(event) => setForm((prev) => ({ ...prev, staffId: event.target.value }))} required>
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
                      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.salaryMonth} onChange={(event) => setForm((prev) => ({ ...prev, salaryMonth: event.target.value }))} required>
                        {salaryMonthOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Payment Date</Label>
                      <Input type="date" value={form.paymentDate} onChange={(event) => setForm((prev) => ({ ...prev, paymentDate: event.target.value }))} required />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                      <Label>Gross</Label>
                      <Input type="number" min="0" step="0.01" value={form.grossAmount} onChange={(event) => setForm((prev) => ({ ...prev, grossAmount: event.target.value }))} required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Bonus</Label>
                      <Input type="number" min="0" step="0.01" value={form.bonusAmount} onChange={(event) => setForm((prev) => ({ ...prev, bonusAmount: event.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Deduction</Label>
                      <Input type="number" min="0" step="0.01" value={form.deductionAmount} onChange={(event) => setForm((prev) => ({ ...prev, deductionAmount: event.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Status</Label>
                      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as SalaryForm['status'] }))}>
                        <option value="paid">Paid</option>
                        <option value="partial">Partial</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Paid From Safe</Label>
                      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.paidFromSafe ? 'yes' : 'no'} onChange={(event) => setForm((prev) => ({ ...prev, paidFromSafe: event.target.value === 'yes' }))}>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Notes</Label>
                    <Input value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Optional note" />
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Salary Payment'}
                  </Button>
                </form>

                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border bg-background/80 p-4">
                      <p className="text-xs text-muted-foreground">Paid In Range</p>
                      <p className="text-2xl font-semibold">{formatCurrency(report?.summary.paidTotal ?? 0, 'AFN')}</p>
                    </div>
                    <div className="rounded-2xl border bg-background/80 p-4">
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="text-2xl font-semibold">{report?.summary.pendingCount ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-background/80 p-4">
                      <p className="text-xs text-muted-foreground">Total Rows</p>
                      <p className="text-2xl font-semibold">{report?.summary.totalCount ?? 0}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border bg-background/80 p-4 md:grid-cols-4">
                    <div className="grid gap-1.5">
                      <Label>Start Date</Label>
                      <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>End Date</Label>
                      <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Staff</Label>
                      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)}>
                        <option value="">All staff</option>
                        {staff.map((member) => (
                          <option key={member.id} value={String(member.id)}>
                            {member.fullName || `Staff #${member.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Search</Label>
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Month or staff..." />
                    </div>
                    <div className="md:col-span-4">
                      <Button type="button" onClick={() => void fetchData(1)}>Apply Filters</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border">
              <CardHeader>
                <CardTitle>Salary History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && report === null ? (
                  <LoadingState compact title="Loading salary report" description="Fetching salary payments." />
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/30 text-left text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Payment Date</th>
                            <th className="px-3 py-2">Salary Month</th>
                            <th className="px-3 py-2">Staff</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Net Amount</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(report?.rows.data ?? []).map((row) => (
                            <tr key={row.id} className="border-t">
                              <td className="px-3 py-2">{row.paymentDate}</td>
                              <td className="px-3 py-2">{row.salaryMonth}</td>
                              <td className="px-3 py-2">{row.staffName}</td>
                              <td className="px-3 py-2">{row.status}</td>
                              <td className="px-3 py-2 font-medium">{formatCurrency(row.netAmountInput, 'AFN')}</td>
                              <td className="px-3 py-2">
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.id)}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{report?.rows.meta.total ?? 0} rows</span>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" disabled={(report?.rows.meta.currentPage ?? 1) <= 1} onClick={() => void fetchData((report?.rows.meta.currentPage ?? 1) - 1)}>
                          Previous
                        </Button>
                        <span>
                          Page {report?.rows.meta.currentPage ?? 1} of {report?.rows.meta.lastPage ?? 1}
                        </span>
                        <Button type="button" variant="outline" disabled={(report?.rows.meta.currentPage ?? 1) >= (report?.rows.meta.lastPage ?? 1)} onClick={() => void fetchData((report?.rows.meta.currentPage ?? 1) + 1)}>
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
