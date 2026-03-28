'use client';

import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, parseMoney } from '@/lib/currency-utils';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { fetchReport, toInputDate } from '@/modules/dental-management/presentation/reports/report-client';
import { AlertTriangle, ShieldCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';

type CollectorRow = {
  cashAmount: number;
  collector: string;
  paymentsCount: number;
  totalAmount: number;
};

type CloseRow = {
  closedAt: string;
  closedBy: string;
  closingDate: string;
  countedBalance: number;
  discrepancyAmount: number;
  expectedBalance: number;
  notes: string;
  openDebtCount: number;
  openDebtTotal: number;
  overdueDebtCount: number;
  paymentTotal: number;
};

type DebtWatchRow = {
  agingBucket: string;
  agingDays: number;
  debtAmount: number;
  invoiceDate: string;
  invoiceId: string;
  patientName: string;
  status: string;
};

type FinancialControlResponse = {
  closeHistory: CloseRow[];
  closingDate: string;
  collectors: CollectorRow[];
  currentClose: CloseRow | null;
  debtWatchlist: DebtWatchRow[];
  summary: {
    cashPaymentTotal: number;
    expectedBalance: number;
    nonCashPaymentTotal: number;
    openDebtCount: number;
    openDebtTotal: number;
    overdueDebtCount: number;
    paymentTotal: number;
    safeInTotal: number;
    safeOutTotal: number;
  };
};

type WorkflowAccessSummary = {
  capabilities: {
    canCloseFinancialDay: boolean;
    canViewFinancialControl: boolean;
  };
  user: {
    rightLevel: string;
    roles: string[];
  };
};

const client = new AxiosClient();

const defaultCountedValue = (amount: number): string => amount > 0 ? amount.toFixed(2) : '';

export default function FinancialControlPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar');
  const [closingDate, setClosingDate] = useState(() => toInputDate(new Date()));
  const [report, setReport] = useState<FinancialControlResponse | null>(null);
  const [countedBalance, setCountedBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  const fetchDashboard = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await fetchReport<FinancialControlResponse>('/api/v1/dental-management/reports/financial-control', {
        closingDate,
      });
      setReport(data);
    } finally {
      setIsLoading(false);
    }
  }, [closingDate]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!report) {
      return;
    }

    if (report.currentClose) {
      setCountedBalance(defaultCountedValue(report.currentClose.countedBalance));
      setNotes(report.currentClose.notes || '');
      return;
    }

    setCountedBalance(defaultCountedValue(report.summary.expectedBalance));
    setNotes('');
  }, [report]);

  const parsedCountedBalance = useMemo(() => parseMoney(countedBalance), [countedBalance]);
  const expectedBalance = report?.summary.expectedBalance ?? 0;
  const discrepancyPreview = useMemo(
    () => Number((parsedCountedBalance - expectedBalance).toFixed(2)),
    [expectedBalance, parsedCountedBalance],
  );

  const handleSave = (): void => {
    if (!workflowAccess?.capabilities.canCloseFinancialDay) {
      toast.error('Approval access is required to save day close.');
      return;
    }

    if (!closingDate) {
      toast.error('Choose a closing date first.');
      return;
    }

    if (parsedCountedBalance < 0) {
      toast.error('Counted balance must be zero or higher.');
      return;
    }

    setIsSaving(true);
    void client
      .post('/api/v1/dental-management/reports/financial-control/close-day', {
        closingDate,
        countedBalance: parsedCountedBalance,
        notes: notes.trim() || undefined,
      })
      .then((response) => {
        if (!response.success || !response.data) {
          toast.error(response.error?.message || 'Failed to save day close.');
          return;
        }

        setReport(response.data as FinancialControlResponse);
        toast.success('Day close saved successfully.');
      })
      .catch(() => {
        toast.error('Failed to save day close.');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'financialControl', isCurrent: true, label: 'Financial Control' },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <Card className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-background to-cyan-50">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <ShieldCheck className="size-5 text-emerald-700" />
                  Daily Close And Reconciliation
                </CardTitle>
                <CardDescription>
                  Lock in the day&apos;s expected safe balance, compare it with the counted cash, and keep discrepancy history visible.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  {workflowAccess && !workflowAccess.capabilities.canCloseFinancialDay ? (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                      This page is visible with `{workflowAccess.user.rightLevel}` rights, but only `approval` users can save or update the day close.
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="grid gap-1.5">
                      <Label>Closing Date</Label>
                      <Input type="date" value={closingDate} onChange={(event) => setClosingDate(event.target.value)} />
                    </div>
                    <Button type="button" variant="outline" onClick={() => void fetchDashboard()} disabled={isLoading}>
                      {isLoading ? 'Refreshing...' : 'Refresh Snapshot'}
                    </Button>
                  </div>

                  {isLoading && report === null ? (
                    <LoadingState compact title="Loading financial control" description="Preparing close-of-day data." />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border bg-background/85 p-4">
                        <p className="text-xs text-muted-foreground">Expected Safe Balance</p>
                        <p className="mt-2 text-2xl font-semibold">{formatCurrency(report?.summary.expectedBalance ?? 0, 'AFN')}</p>
                      </div>
                      <div className="rounded-2xl border bg-background/85 p-4">
                        <p className="text-xs text-muted-foreground">Payments Received</p>
                        <p className="mt-2 text-2xl font-semibold">{formatCurrency(report?.summary.paymentTotal ?? 0, 'AFN')}</p>
                        <p className="text-xs text-muted-foreground">
                          Cash {formatCurrency(report?.summary.cashPaymentTotal ?? 0, 'AFN')} / Non-cash {formatCurrency(report?.summary.nonCashPaymentTotal ?? 0, 'AFN')}
                        </p>
                      </div>
                      <div className="rounded-2xl border bg-background/85 p-4">
                        <p className="text-xs text-muted-foreground">Safe Movement</p>
                        <p className="mt-2 text-2xl font-semibold">{formatCurrency((report?.summary.safeInTotal ?? 0) - (report?.summary.safeOutTotal ?? 0), 'AFN')}</p>
                        <p className="text-xs text-muted-foreground">
                          In {formatCurrency(report?.summary.safeInTotal ?? 0, 'AFN')} / Out {formatCurrency(report?.summary.safeOutTotal ?? 0, 'AFN')}
                        </p>
                      </div>
                      <div className="rounded-2xl border bg-background/85 p-4">
                        <p className="text-xs text-muted-foreground">Open Debt Snapshot</p>
                        <p className="mt-2 text-2xl font-semibold">{formatCurrency(report?.summary.openDebtTotal ?? 0, 'AFN')}</p>
                        <p className="text-xs text-muted-foreground">
                          {report?.summary.openDebtCount ?? 0} open / {report?.summary.overdueDebtCount ?? 0} overdue
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border bg-background/90 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Cashier Reconciliation</p>
                    <p className="text-xs text-muted-foreground">
                      Enter the amount physically counted at day end and save the reconciliation result.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="grid gap-1.5">
                      <Label>Counted Balance</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={countedBalance}
                        onChange={(event) => setCountedBalance(event.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className={`rounded-2xl border p-4 ${discrepancyPreview === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`mt-0.5 size-4 ${discrepancyPreview === 0 ? 'text-emerald-700' : 'text-amber-700'}`} />
                        <div>
                          <p className="text-sm font-semibold">
                            Difference {formatCurrency(discrepancyPreview, 'AFN')}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Compared against expected safe balance {formatCurrency(expectedBalance, 'AFN')}.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label>Notes</Label>
                      <Input
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Explain shortages, overage, or unusual movement"
                      />
                    </div>

                    <Button type="button" onClick={handleSave} disabled={isSaving || !workflowAccess?.capabilities.canCloseFinancialDay}>
                      <Wallet className="mr-2 size-4" />
                      {isSaving ? 'Saving...' : (report?.currentClose ? 'Update Day Close' : 'Save Day Close')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-3xl border">
                <CardHeader>
                  <CardTitle>Collector Performance</CardTitle>
                  <CardDescription>Who collected payments on the selected day and how much came in.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30 text-left text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Collector</th>
                          <th className="px-3 py-2">Payments</th>
                          <th className="px-3 py-2">Cash</th>
                          <th className="px-3 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report?.collectors ?? []).length > 0 ? (report?.collectors ?? []).map((row, index) => (
                          <tr key={`${row.collector}-${index}`} className="border-t">
                            <td className="px-3 py-2">{row.collector}</td>
                            <td className="px-3 py-2">{row.paymentsCount}</td>
                            <td className="px-3 py-2">{formatCurrency(row.cashAmount, 'AFN')}</td>
                            <td className="px-3 py-2">{formatCurrency(row.totalAmount, 'AFN')}</td>
                          </tr>
                        )) : (
                          <tr className="border-t">
                            <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No payments were collected on this date.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border">
                <CardHeader>
                  <CardTitle>Debt Watchlist</CardTitle>
                  <CardDescription>Oldest unpaid invoices so the team can follow up before balances age further.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30 text-left text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Patient</th>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Bucket</th>
                          <th className="px-3 py-2">Debt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report?.debtWatchlist ?? []).length > 0 ? (report?.debtWatchlist ?? []).map((row, index) => (
                          <tr key={`${row.invoiceId}-${index}`} className="border-t">
                            <td className="px-3 py-2">{row.patientName}</td>
                            <td className="px-3 py-2">#{row.invoiceId}</td>
                            <td className="px-3 py-2">{row.agingBucket}</td>
                            <td className="px-3 py-2">{formatCurrency(row.debtAmount, 'AFN')}</td>
                          </tr>
                        )) : (
                          <tr className="border-t">
                            <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No open debt rows were found for this close date.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-3xl border">
              <CardHeader>
                <CardTitle>Discrepancy Log</CardTitle>
                <CardDescription>Recent close history with expected vs counted balance and who signed the close.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-2xl border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/30 text-left text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Expected</th>
                        <th className="px-3 py-2">Counted</th>
                        <th className="px-3 py-2">Difference</th>
                        <th className="px-3 py-2">Closed By</th>
                        <th className="px-3 py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report?.closeHistory ?? []).length > 0 ? (report?.closeHistory ?? []).map((row, index) => (
                        <tr key={`${row.closingDate}-${index}`} className="border-t">
                          <td className="px-3 py-2">{row.closingDate}</td>
                          <td className="px-3 py-2">{formatCurrency(row.expectedBalance, 'AFN')}</td>
                          <td className="px-3 py-2">{formatCurrency(row.countedBalance, 'AFN')}</td>
                          <td className={`px-3 py-2 font-medium ${row.discrepancyAmount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {formatCurrency(row.discrepancyAmount, 'AFN')}
                          </td>
                          <td className="px-3 py-2">{row.closedBy || '-'}</td>
                          <td className="px-3 py-2">{row.notes || '-'}</td>
                        </tr>
                      )) : (
                        <tr className="border-t">
                          <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No close history has been saved yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
