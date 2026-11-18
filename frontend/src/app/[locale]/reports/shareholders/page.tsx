'use client';

import { JSX, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDebounce } from 'use-debounce';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type CurrencyCode, formatCurrency } from '@/lib/currency-utils';
import { createDefaultReportRange, fetchReport } from '@/modules/dental-management/presentation/reports/report-client';
import { ReportPageIntro } from '@/modules/dental-management/presentation/reports/report-page-intro';

type ShareholderPosition = {
  balanceAmount: number;
  contributedAmount: number;
  currency: CurrencyCode;
  currencySections: Record<CurrencyCode, {
    balanceAmount: number;
    contributedAmount: number;
    distributedAmount: number;
    initialCapital: number;
  }>;
  distributedAmount: number;
  exchangeRate: number;
  fullName: string;
  id: number;
  initialCapital: number;
  initialCapitalInput: number;
  ownershipPercentage: number;
  status: 'active' | 'inactive';
};

type ShareholderTransactionRow = {
  amount: number;
  amountInput: number;
  createdAt: string;
  currency: CurrencyCode;
  exchangeRate: number;
  id: number;
  notes: string;
  shareholderId: number;
  shareholderName: string;
  transactionDate: string;
  transactionType: 'contribution' | 'distribution';
};

type ShareholderReportResponse = {
  ledger: {
    data: ShareholderTransactionRow[];
    meta: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
    };
  };
  positions: ShareholderPosition[];
  summary: {
    activeCount: number;
    currencySections: Record<CurrencyCode, {
      initialCapital: number;
      rangeContribution: number;
      rangeDistribution: number;
      rangeNet: number;
    }>;
    initialCapital: number;
    rangeContribution: number;
    rangeDistribution: number;
    rangeNet: number;
    totalShareholders: number;
  };
};

const emptyCurrencySections = (): ShareholderReportResponse['summary']['currencySections'] => ({
  AFN: {
    initialCapital: 0,
    rangeContribution: 0,
    rangeDistribution: 0,
    rangeNet: 0,
  },
  USD: {
    initialCapital: 0,
    rangeContribution: 0,
    rangeDistribution: 0,
    rangeNet: 0,
  },
});

const ShareholderReportsPage = (): JSX.Element => {
  const tSidebar = useTranslations('sidebar');
  const tReports = useTranslations('sidebar.reports');
  const range = createDefaultReportRange(90);
  const [startDate, setStartDate] = useState(range.startDate);
  const [endDate, setEndDate] = useState(range.endDate);
  const [typeFilter, setTypeFilter] = useState<'all' | 'contribution' | 'distribution'>('all');
  const [selectedShareholderId, setSelectedShareholderId] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 350);
  const [report, setReport] = useState<ShareholderReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const currencySections = report?.summary.currencySections ?? emptyCurrencySections();

  const renderOriginalMoney = (amountInput: number, currency: CurrencyCode, amountAfn: number): JSX.Element => (
    <div>{formatCurrency(amountInput, currency)}</div>
  );

  const renderCurrencyPair = (
    sections: ShareholderPosition['currencySections'],
    field: keyof ShareholderPosition['currencySections']['AFN'],
  ): JSX.Element => (
    <div className="space-y-1 text-xs">
      <div className="font-medium text-foreground">{formatCurrency(sections.AFN[field], 'AFN')}</div>
      <div className="font-medium text-foreground">{formatCurrency(sections.USD[field], 'USD')}</div>
    </div>
  );

  const fetchShareholderReport = useCallback(async (pageNumber = 1): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await fetchReport<ShareholderReportResponse>('/api/v1/dental-management/reports/shareholders', {
        endDate,
        page: pageNumber,
        perPage: 12,
        search: debouncedSearch,
        shareholderId: selectedShareholderId === 'all' ? '' : selectedShareholderId,
        sortBy: 'transactionDate',
        sortDirection: 'desc',
        startDate,
        transactionType: typeFilter,
      });
      setReport(data);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, endDate, selectedShareholderId, startDate, typeFilter]);

  useEffect(() => {
    void fetchShareholderReport(1);
  }, [fetchShareholderReport]);

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'shareholders', isCurrent: true, label: tReports('shareholders') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <ReportPageIntro title="Shareholder report" description="Review each shareholder's ownership, contributions, distributions, and balance for a selected period." />
            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardTitle>Choose what to review</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Label className="grid gap-1.5 text-xs text-muted-foreground">From<Input aria-label="From date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Label>
                <Label className="grid gap-1.5 text-xs text-muted-foreground">To<Input aria-label="To date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Label>
                <select aria-label="Shareholder" className="h-9 rounded-md border bg-background px-3 text-sm" value={selectedShareholderId} onChange={(event) => setSelectedShareholderId(event.target.value)}>
                  <option value="all">All shareholders</option>
                  {(report?.positions ?? []).map((row) => (
                    <option key={row.id} value={String(row.id)}>{row.fullName}</option>
                  ))}
                </select>
                <select aria-label="Transaction type" className="h-9 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | 'contribution' | 'distribution')}>
                  <option value="all">All types</option>
                  <option value="contribution">Contribution</option>
                  <option value="distribution">Distribution</option>
                </select>
                <Input aria-label="Search shareholders or notes" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Shareholder or note..." />
                <div className="flex items-center md:col-span-5">
                  <p className="text-xs text-muted-foreground">Results update automatically as you change filters.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                  <CardTitle>At a glance</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 xl:grid-cols-[1fr_1fr_1.1fr]">
                {(['AFN', 'USD'] as CurrencyCode[]).map((currency) => (
                  <div key={currency} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">{currency} Summary</p>
                    <div className="mt-3 grid gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Starting capital</p>
                        <p className="text-lg font-semibold">{formatCurrency(currencySections[currency].initialCapital, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Contributions this period</p>
                        <p className="text-lg font-semibold text-emerald-700">{formatCurrency(currencySections[currency].rangeContribution, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Distributions this period</p>
                        <p className="text-lg font-semibold text-rose-700">{formatCurrency(currencySections[currency].rangeDistribution, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Net change this period</p>
                        <p className="text-lg font-semibold text-indigo-700">{formatCurrency(currencySections[currency].rangeNet, currency)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Total Shareholders</p>
                  <p className="text-lg font-semibold">{report?.summary.totalShareholders ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-lg font-semibold">{report?.summary.activeCount ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Starting capital (AFN equivalent)</p>
                  <p className="text-lg font-semibold">{formatCurrency(report?.summary.initialCapital ?? 0, 'AFN')}</p>
                </div>
                <div className="rounded-lg border bg-emerald-100/70 p-3 text-emerald-900">
                  <p className="text-xs">Contributions (AFN equivalent)</p>
                  <p className="text-lg font-semibold">{formatCurrency(report?.summary.rangeContribution ?? 0, 'AFN')}</p>
                </div>
                <div className="rounded-lg border bg-rose-100/70 p-3 text-rose-900">
                  <p className="text-xs">Distributions (AFN equivalent)</p>
                  <p className="text-lg font-semibold">{formatCurrency(report?.summary.rangeDistribution ?? 0, 'AFN')}</p>
                </div>
                <div className="rounded-lg border bg-indigo-100/70 p-3 text-indigo-900">
                  <p className="text-xs">Net change (AFN equivalent)</p>
                  <p className="text-lg font-semibold">{formatCurrency(report?.summary.rangeNet ?? 0, 'AFN')}</p>
                </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardTitle>Ownership and balances</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && report === null ? (
                  <LoadingState compact title="Loading shareholder report" description="Fetching positions and ledger." />
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Ownership</th>
                          <th className="px-3 py-2">Initial</th>
                          <th className="px-3 py-2">Contributed</th>
                          <th className="px-3 py-2">Distributed</th>
                          <th className="px-3 py-2">Balance</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report?.positions ?? []).map((row) => (
                          <tr key={row.id} className="border-b">
                            <td className="px-3 py-2">{row.fullName}</td>
                            <td className="px-3 py-2">{row.ownershipPercentage.toFixed(2)}%</td>
                            <td className="px-3 py-2">{renderOriginalMoney(row.initialCapitalInput, row.currency, row.initialCapital)}</td>
                            <td className="px-3 py-2 text-emerald-700">{renderCurrencyPair(row.currencySections, 'contributedAmount')}</td>
                            <td className="px-3 py-2 text-rose-700">{renderCurrencyPair(row.currencySections, 'distributedAmount')}</td>
                            <td className="px-3 py-2 font-semibold">{renderCurrencyPair(row.currencySections, 'balanceAmount')}</td>
                            <td className="px-3 py-2">
                              <Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>{row.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardTitle>Contribution and distribution history ({report?.ledger.meta.total ?? 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Shareholder</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report?.ledger.data ?? []).map((row) => (
                          <tr key={row.id} className="border-b">
                            <td className="px-3 py-2">{row.transactionDate}</td>
                            <td className="px-3 py-2">{row.shareholderName}</td>
                            <td className="px-3 py-2">{row.transactionType}</td>
                            <td className={`px-3 py-2 font-medium ${row.transactionType === 'distribution' ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {renderOriginalMoney(row.amountInput, row.currency, row.amount)}
                            </td>
                            <td className="px-3 py-2">{row.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{report?.ledger.meta.total ?? 0} transactions</span>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" disabled={(report?.ledger.meta.currentPage ?? 1) <= 1} onClick={() => void fetchShareholderReport((report?.ledger.meta.currentPage ?? 1) - 1)}>
                        Previous
                      </Button>
                      <span>
                        Page {report?.ledger.meta.currentPage ?? 1} of {report?.ledger.meta.lastPage ?? 1}
                      </span>
                      <Button type="button" variant="outline" disabled={(report?.ledger.meta.currentPage ?? 1) >= (report?.ledger.meta.lastPage ?? 1)} onClick={() => void fetchShareholderReport((report?.ledger.meta.currentPage ?? 1) + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShareholderReportsPage;
