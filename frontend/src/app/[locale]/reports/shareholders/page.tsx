'use client';

import { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency, parseMoney } from '@/lib/currency-utils';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { fetchAllRows } from '@/modules/common/infrastructure/api/fetch-all-rows';

type ShareholderRow = {
  balanceAmount: number;
  contributedAmount: number;
  distributedAmount: number;
  fullName: string;
  id: string;
  initialCapitalInput: number;
  ownershipPercentage: number;
  status: 'active' | 'inactive';
};

type TransactionRow = {
  amountInput: number;
  id: string;
  notes: string;
  safeTransactionId: string;
  shareholderId: string;
  transactionDate: string;
  transactionType: 'contribution' | 'distribution';
};

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

const parseDate = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value: string): string => {
  const parsed = parseDate(value);
  if (!parsed) return '-';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed);
};

// eslint-disable-next-line react/function-component-definition
export default function ShareholderReportsPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar');
  const tReports = useTranslations('sidebar.reports');
  const defaultStart = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return toInputDate(date);
  }, []);
  const today = useMemo(() => toInputDate(new Date()), []);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [typeFilter, setTypeFilter] = useState<'all' | 'contribution' | 'distribution'>('all');
  const [selectedShareholderId, setSelectedShareholderId] = useState('all');
  const [isLoadingShareholders, setIsLoadingShareholders] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [shareholders, setShareholders] = useState<ShareholderRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const fetchShareholders = useCallback(async (): Promise<void> => {
    setIsLoadingShareholders(true);
    try {
      const shareholderItems = await fetchAllRows(client, '/api/v1/dental-management/shareholders', {
        sortBy: 'fullName',
        sortDirection: 'asc',
      });
      setShareholders(
        shareholderItems.map((row) => ({
          balanceAmount: parseAmount(row.balanceAmount ?? row.balance_amount),
          contributedAmount: parseAmount(row.contributedAmount ?? row.contributed_amount),
          distributedAmount: parseAmount(row.distributedAmount ?? row.distributed_amount),
          fullName: asText(row.fullName ?? row.full_name),
          id: asText(row.id),
          initialCapitalInput: parseAmount(row.initialCapitalInput ?? row.initial_capital_input),
          ownershipPercentage: parseAmount(row.ownershipPercentage ?? row.ownership_percentage),
          status: (asText(row.status) === 'inactive' ? 'inactive' : 'active') as
            | 'active'
            | 'inactive',
        }))
      );
    } catch {
      setShareholders([]);
    } finally {
      setIsLoadingShareholders(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (): Promise<void> => {
    setIsLoadingTransactions(true);
    try {
      const transactionItems = await fetchAllRows(client, '/api/v1/dental-management/shareholder-transactions', {
        sortBy: 'transactionDate',
        sortDirection: 'desc',
        'filter[dateFrom]': startDate,
        'filter[dateTo]': endDate,
        'filter[shareholderId]': selectedShareholderId === 'all' ? '' : selectedShareholderId,
        'filter[transactionType]': typeFilter === 'all' ? '' : typeFilter,
      });
      setTransactions(
        transactionItems.map((row) => ({
          amountInput: parseAmount(row.amountInput ?? row.amount_input ?? row.amount),
          id: asText(row.id),
          notes: asText(row.notes),
          safeTransactionId: asText(row.safeTransactionId ?? row.safe_transaction_id),
          shareholderId: asText(row.shareholderId ?? row.shareholder_id),
          transactionDate: asText(row.transactionDate ?? row.transaction_date),
          transactionType: (asText(row.transactionType ?? row.transaction_type) === 'distribution'
            ? 'distribution'
            : 'contribution') as 'contribution' | 'distribution',
        }))
      );
    } catch {
      setTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [endDate, selectedShareholderId, startDate, typeFilter]);

  useEffect(() => {
    void fetchShareholders();
  }, [fetchShareholders]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const shareholderById = useMemo(
    () => new Map(shareholders.map((row) => [row.id, row])),
    [shareholders]
  );
  const filteredTransactions = transactions;

  const rangeTotals = useMemo(
    () =>
      filteredTransactions.reduce(
        (acc, row) => {
          if (row.transactionType === 'contribution') acc.contribution += row.amountInput;
          else acc.distribution += row.amountInput;
          return acc;
        },
        { contribution: 0, distribution: 0 }
      ),
    [filteredTransactions]
  );
  const isLoading = isLoadingShareholders || isLoadingTransactions;

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
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardTitle>Shareholder Report Filters</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={selectedShareholderId}
                  onChange={(event) => setSelectedShareholderId(event.target.value)}
                >
                  <option value="all">All shareholders</option>
                  {shareholders.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.fullName}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as 'all' | 'contribution' | 'distribution')
                  }
                >
                  <option value="all">All types</option>
                  <option value="contribution">Contribution</option>
                  <option value="distribution">Distribution</option>
                </select>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Total Shareholders</p>
                  <p className="text-lg font-semibold">{shareholders.length}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-lg font-semibold">
                    {shareholders.filter((row) => row.status === 'active').length}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Initial Capital</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(
                      shareholders.reduce((sum, row) => sum + row.initialCapitalInput, 0),
                      'AFN'
                    )}
                  </p>
                </div>
                <div className="rounded-lg border bg-emerald-100/70 p-3 text-emerald-900">
                  <p className="text-xs">Range Contribution</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(rangeTotals.contribution, 'AFN')}
                  </p>
                </div>
                <div className="rounded-lg border bg-rose-100/70 p-3 text-rose-900">
                  <p className="text-xs">Range Distribution</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(rangeTotals.distribution, 'AFN')}
                  </p>
                </div>
                <div className="rounded-lg border bg-indigo-100/70 p-3 text-indigo-900">
                  <p className="text-xs">Range Net</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(rangeTotals.contribution - rangeTotals.distribution, 'AFN')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardTitle>Shareholder Positions</CardTitle>
              </CardHeader>
              <CardContent>
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
                      {shareholders.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="px-3 py-2">{row.fullName}</td>
                          <td className="px-3 py-2">{row.ownershipPercentage.toFixed(2)}%</td>
                          <td className="px-3 py-2">
                            {formatCurrency(row.initialCapitalInput, 'AFN')}
                          </td>
                          <td className="px-3 py-2 text-emerald-700">
                            {formatCurrency(row.contributedAmount, 'AFN')}
                          </td>
                          <td className="px-3 py-2 text-rose-700">
                            {formatCurrency(row.distributedAmount, 'AFN')}
                          </td>
                          <td className="px-3 py-2 font-semibold">
                            {formatCurrency(row.balanceAmount, 'AFN')}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>
                              {row.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardTitle>Transaction Ledger ({filteredTransactions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <LoadingState
                    title="Loading shareholder ledger"
                    description="Collecting balances and transaction history for the selected filters."
                  />
                ) : filteredTransactions.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No transactions for selected filters.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Shareholder</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Safe Tx</th>
                          <th className="px-3 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((row) => (
                          <tr key={row.id} className="border-b">
                            <td className="px-3 py-2">{formatDate(row.transactionDate)}</td>
                            <td className="px-3 py-2">
                              {shareholderById.get(row.shareholderId)?.fullName ||
                                `Shareholder #${row.shareholderId}`}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  row.transactionType === 'contribution' ? 'secondary' : 'outline'
                                }
                              >
                                {row.transactionType}
                              </Badge>
                            </td>
                            <td
                              className={`px-3 py-2 font-semibold ${row.transactionType === 'contribution' ? 'text-emerald-700' : 'text-rose-700'}`}
                            >
                              {formatCurrency(row.amountInput, 'AFN')}
                            </td>
                            <td className="px-3 py-2">{row.safeTransactionId || '-'}</td>
                            <td className="px-3 py-2">{row.notes || '-'}</td>
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

