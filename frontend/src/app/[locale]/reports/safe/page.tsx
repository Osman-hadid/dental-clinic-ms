'use client';

import { FormEvent, JSX, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
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
import { HandCoins, Trash2, Vault } from 'lucide-react';
import { toast } from 'sonner';

type SafeRow = {
  amountInput: number;
  createdAt: string;
  direction: string;
  entryType: string;
  id: number;
  notes: string;
  pickedByStaffId: number;
  pickedByStaffName: string;
  sourceType?: string;
  transactionDate: string;
};

type SafeReportResponse = {
  ledger: {
    data: SafeRow[];
    meta: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
    };
  };
  summary: {
    balance: number;
    previousBalance: number;
    rangeNet: number;
    totalIn: number;
    totalOut: number;
  };
};

type WorkflowAccessSummary = {
  capabilities: {
    canManageSafeLedger: boolean;
    canViewSafeLedger: boolean;
  };
  user: {
    rightLevel: string;
  };
};

type SafeForm = {
  amount: string;
  direction: 'in' | 'out';
  entryType: string;
  notes: string;
  pickedByStaffId: string;
  transactionDate: string;
};

const client = new AxiosClient();

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } } } })?.response;
  const payload = response?.data?.error;
  const code = payload?.code;

  if (code === 'SAFE_BALANCE_INSUFFICIENT') {
    const currentBalance = Number(payload?.details?.currentBalance ?? 0);
    const requestedAmount = Number(payload?.details?.requestedAmount ?? 0);
    return `Safe balance is not enough. Current: ${formatCurrency(currentBalance, 'AFN')}. Requested: ${formatCurrency(requestedAmount, 'AFN')}.`;
  }

  if (code === 'SAFE_TRANSACTION_READ_ONLY') {
    return payload?.message || 'System generated safe entries cannot be edited or deleted.';
  }

  const validationErrors = (response as { data?: { errors?: Record<string, string[] | string> } })?.data?.errors;
  if (validationErrors) {
    const firstKey = Object.keys(validationErrors)[0];
    const firstValue = validationErrors[firstKey];
    if (Array.isArray(firstValue)) {
      return firstValue[0] || fallback;
    }
    if (typeof firstValue === 'string') {
      return firstValue;
    }
  }

  return payload?.message || fallback;
};

const defaultForm = (): SafeForm => ({
  amount: '',
  direction: 'in',
  entryType: 'deposit',
  notes: '',
  pickedByStaffId: '',
  transactionDate: toInputDate(new Date()),
});

export default function SafePage(): JSX.Element {
  const tSidebar = useTranslations('sidebar');
  const tReports = useTranslations('sidebar.reports');
  const searchParams = useSearchParams();
  const hasAppliedQuery = useRef(false);
  const { entities: staff } = useStaffList(1, 100);
  const range = createDefaultReportRange(90);
  const [form, setForm] = useState<SafeForm>(() => defaultForm());
  const [report, setReport] = useState<SafeReportResponse | null>(null);
  const [startDate, setStartDate] = useState(range.startDate);
  const [endDate, setEndDate] = useState(range.endDate);
  const [direction, setDirection] = useState('all');
  const [focus, setFocus] = useState<'balance' | 'in' | 'out' | null>(null);
  const [entryType, setEntryType] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workflowAccess, setWorkflowAccess] = useState<WorkflowAccessSummary | null>(null);

  useEffect(() => {
    void client.get<WorkflowAccessSummary>('/api/v1/dental-management/workflow/access-summary')
      .then((response) => {
        if (response.success && response.data) {
          setWorkflowAccess(response.data);
        }
      })
      .catch(() => {
        setWorkflowAccess(null);
      });
  }, []);

  const fetchData = useCallback(async (pageNumber: number): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await fetchReport<SafeReportResponse>('/api/v1/dental-management/reports/safe', {
        direction: direction === 'all' ? undefined : direction,
        endDate,
        entryType,
        page: pageNumber,
        perPage: 12,
        search,
        sortBy: 'transactionDate',
        sortDirection: 'desc',
        startDate,
      });
      setReport(data);
      setPage(pageNumber);
    } finally {
      setIsLoading(false);
    }
  }, [direction, endDate, entryType, search, startDate]);

  useEffect(() => {
    void fetchData(1);
  }, [fetchData]);

  useEffect(() => {
    if (hasAppliedQuery.current) {
      return;
    }

    const nextStart = searchParams.get('startDate');
    const nextEnd = searchParams.get('endDate');
    const nextDirection = searchParams.get('direction');
    const nextFocus = searchParams.get('focus');

    if (nextStart) setStartDate(nextStart);
    if (nextEnd) setEndDate(nextEnd);
    if (nextDirection) setDirection(nextDirection);
    if (nextFocus === 'balance' || nextFocus === 'in' || nextFocus === 'out') {
      setFocus(nextFocus);
    }

    hasAppliedQuery.current = true;
  }, [searchParams]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!workflowAccess?.capabilities.canManageSafeLedger) {
      toast.error('Approval access is required to create or edit safe transactions.');
      return;
    }

    const rawAmount = parseMoney(form.amount);
    if (!form.transactionDate || rawAmount <= 0) {
      return;
    }

    setIsSubmitting(true);
    void client
      .post('/api/v1/dental-management/safe-transactions', {
        amount: rawAmount,
        currency: 'AFN',
        direction: form.direction,
        entryType: form.entryType,
        exchangeRate: 1,
        notes: form.notes.trim() || undefined,
        pickedByStaffId: form.pickedByStaffId || undefined,
        sourceType: null,
        transactionDate: form.transactionDate,
      })
      .then(async () => {
        setForm(defaultForm());
        await fetchData(1);
        toast.success('Safe transaction saved.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to save safe transaction.'));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const removeRow = (id: number): void => {
    if (!workflowAccess?.capabilities.canManageSafeLedger) {
      toast.error('Approval access is required to delete safe transactions.');
      return;
    }

    void client
      .delete(`/api/v1/dental-management/safe-transactions/${id}`)
      .then(async () => {
        await fetchData(page);
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
                {workflowAccess && !workflowAccess.capabilities.canManageSafeLedger ? (
                  <div className="lg:col-span-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                    You are viewing the safe ledger with `{workflowAccess.user.rightLevel}` rights. Creating or deleting manual safe entries requires `approval` access.
                  </div>
                ) : null}
                <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border bg-background/85 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Date</Label>
                      <Input type="date" value={form.transactionDate} onChange={(event) => setForm((prev) => ({ ...prev, transactionDate: event.target.value }))} required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Amount</Label>
                      <Input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="0.00" required />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Direction</Label>
                      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.direction} onChange={(event) => setForm((prev) => ({ ...prev, direction: event.target.value as 'in' | 'out' }))}>
                        <option value="in">In</option>
                        <option value="out">Out</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Type</Label>
                      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.entryType} onChange={(event) => setForm((prev) => ({ ...prev, entryType: event.target.value }))}>
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
                    <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.pickedByStaffId} onChange={(event) => setForm((prev) => ({ ...prev, pickedByStaffId: event.target.value }))}>
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
                    <Input value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Optional note" />
                  </div>
                  <Button type="submit" disabled={isSubmitting || !workflowAccess?.capabilities.canManageSafeLedger}>
                    <HandCoins className="mr-2 size-4" />
                    {isSubmitting ? 'Saving...' : 'Save Safe Transaction'}
                  </Button>
                </form>

                <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border bg-background/80 p-4">
                    <p className="text-xs text-muted-foreground">Current Balance</p>
                    <p className="text-2xl font-semibold">{formatCurrency(report?.summary.balance ?? 0, 'AFN')}</p>
                  </div>
                    <div className="rounded-2xl border bg-background/80 p-4">
                      <p className="text-xs text-muted-foreground">Range In</p>
                      <p className="text-2xl font-semibold">{formatCurrency(report?.summary.totalIn ?? 0, 'AFN')}</p>
                    </div>
                    <div className="rounded-2xl border bg-background/80 p-4">
                    <p className="text-xs text-muted-foreground">Range Out</p>
                    <p className="text-2xl font-semibold">{formatCurrency(report?.summary.totalOut ?? 0, 'AFN')}</p>
                  </div>
                </div>
                {focus ? (
                  <div className="rounded-2xl border bg-background/80 p-3 text-xs text-muted-foreground space-y-1">
                    <p>
                      Showing ledger for <span className="font-medium text-foreground">{focus === 'balance' ? 'safe balance' : `safe money ${focus}`}</span> from {startDate} to {endDate}.
                    </p>
                    {startDate === endDate ? (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                        Previous balance before {startDate}: <span className="font-medium text-foreground">{formatCurrency(report?.summary.previousBalance ?? 0, 'AFN')}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

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
                      <Label>Direction</Label>
                      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={direction} onChange={(event) => setDirection(event.target.value)}>
                        <option value="all">All directions</option>
                        <option value="in">In</option>
                        <option value="out">Out</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Entry Type</Label>
                      <Input value={entryType} onChange={(event) => setEntryType(event.target.value)} placeholder="deposit, salary..." />
                    </div>
                    <div className="grid gap-1.5 md:col-span-3">
                      <Label>Search</Label>
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Notes or staff..." />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" onClick={() => void fetchData(1)}>Apply Filters</Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background/80 p-4">
                    <p className="text-xs text-muted-foreground">Range Net</p>
                    <p className="text-2xl font-semibold">{formatCurrency(report?.summary.rangeNet ?? 0, 'AFN')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border">
              <CardHeader>
                <CardTitle>Ledger History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && report === null ? (
                  <LoadingState compact title="Loading safe report" description="Fetching safe transactions and balances." />
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/30 text-left text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Direction</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Picked By</th>
                            <th className="px-3 py-2">Notes</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(report?.ledger.data ?? []).map((row) => (
                            <tr key={row.id} className="border-t">
                              <td className="px-3 py-2">{row.transactionDate}</td>
                              <td className="px-3 py-2">{row.direction}</td>
                              <td className="px-3 py-2">{row.entryType}</td>
                              <td className={`px-3 py-2 font-medium ${row.direction === 'out' ? 'text-rose-600' : 'text-emerald-700'}`}>
                                {formatCurrency(row.amountInput, 'AFN')}
                              </td>
                              <td className="px-3 py-2">{row.pickedByStaffName || '-'}</td>
                              <td className="px-3 py-2">{row.notes || '-'}</td>
                              <td className="px-3 py-2">
                                {row.sourceType ? (
                                  <span className="text-xs text-muted-foreground">System</span>
                                ) : (
                                  <Button type="button" variant="ghost" size="icon" disabled={!workflowAccess?.capabilities.canManageSafeLedger} onClick={() => removeRow(row.id)}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{report?.ledger.meta.total ?? 0} transactions</span>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" disabled={(report?.ledger.meta.currentPage ?? 1) <= 1} onClick={() => void fetchData((report?.ledger.meta.currentPage ?? 1) - 1)}>
                          Previous
                        </Button>
                        <span>
                          Page {report?.ledger.meta.currentPage ?? 1} of {report?.ledger.meta.lastPage ?? 1}
                        </span>
                        <Button type="button" variant="outline" disabled={(report?.ledger.meta.currentPage ?? 1) >= (report?.ledger.meta.lastPage ?? 1)} onClick={() => void fetchData((report?.ledger.meta.currentPage ?? 1) + 1)}>
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
