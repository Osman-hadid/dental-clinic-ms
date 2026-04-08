'use client';

import { FormEvent, JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DEFAULT_AFN_PER_USD,
  type CurrencyCode,
  formatCurrency,
  getExchangeRate,
  parseMoney,
} from '@/lib/currency-utils';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { fetchAllRows } from '@/modules/common/infrastructure/api/fetch-all-rows';
import { PencilLine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type ShareholderRow = {
  address: string;
  balanceAmount: number;
  contactNumber: string;
  contributedAmount: number;
  distributedAmount: number;
  email: string;
  fullName: string;
  initialCapital: number;
  id: string;
  initialCapitalInput: number;
  joinedDate: string;
  notes: string;
  ownershipPercentage: number;
  status: 'active' | 'inactive';
  currency: CurrencyCode;
  exchangeRate: number;
};

type TransactionRow = {
  amount: number;
  amountInput: number;
  id: string;
  notes: string;
  safeTransactionId: string;
  shareholderId: string;
  transactionDate: string;
  transactionType: 'contribution' | 'distribution';
  currency: CurrencyCode;
  exchangeRate: number;
};

type ShareholderMoneySections = Record<CurrencyCode, {
  balanceAmount: number;
  contributedAmount: number;
  distributedAmount: number;
  initialCapital: number;
}>;

const emptyMoneySections = (): ShareholderMoneySections => ({
  AFN: {
    balanceAmount: 0,
    contributedAmount: 0,
    distributedAmount: 0,
    initialCapital: 0,
  },
  USD: {
    balanceAmount: 0,
    contributedAmount: 0,
    distributedAmount: 0,
    initialCapital: 0,
  },
});

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

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  const payload = (
    error as {
      response?: {
        data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } };
      };
    }
  )?.response?.data?.error;
  if (!payload) return fallback;
  if (payload.code === 'SAFE_BALANCE_INSUFFICIENT') {
    const currency = String(payload.details?.currency ?? 'AFN') === 'USD' ? 'USD' : 'AFN';
    const currentBalance = Number(payload.details?.currentBalance ?? 0);
    const requestedAmount = Number(payload.details?.requestedAmount ?? 0);
    return `Safe balance is not enough. Current: ${formatCurrency(currentBalance, currency)}. Requested: ${formatCurrency(requestedAmount, currency)}.`;
  }
  return payload.message || fallback;
};

const formatDate = (value: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed);
};

// eslint-disable-next-line react/function-component-definition
export default function ShareholdersPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar');
  const tDental = useTranslations('sidebar.dentalManagement');
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingShareholder, setIsSavingShareholder] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [shareholders, setShareholders] = useState<ShareholderRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [selectedShareholderId, setSelectedShareholderId] = useState('');
  const [editingShareholderId, setEditingShareholderId] = useState('');
  const [editingTransactionId, setEditingTransactionId] = useState('');
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [ownershipPercentage, setOwnershipPercentage] = useState('0');
  const [initialCapital, setInitialCapital] = useState('0');
  const [joinedDate, setJoinedDate] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [shareholderNotes, setShareholderNotes] = useState('');
  const [shareholderCurrency, setShareholderCurrency] = useState<CurrencyCode>('AFN');
  const [shareholderExchangeRate, setShareholderExchangeRate] = useState('1');
  const [transactionType, setTransactionType] = useState<'contribution' | 'distribution'>(
    'contribution'
  );
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(toInputDate(new Date()));
  const [transactionNotes, setTransactionNotes] = useState('');
  const [transactionCurrency, setTransactionCurrency] = useState<CurrencyCode>('AFN');
  const [transactionExchangeRate, setTransactionExchangeRate] = useState('1');
  const [defaultExchangeRate, setDefaultExchangeRate] = useState(DEFAULT_AFN_PER_USD);
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  useEffect(() => {
    void getExchangeRate(client)
      .then((rate) => setDefaultExchangeRate(rate))
      .catch(() => {
        setDefaultExchangeRate(DEFAULT_AFN_PER_USD);
      });
  }, []);

  const fetchData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [shareholderItems, transactionItems] = await Promise.all([
        fetchAllRows(client, '/api/v1/dental-management/shareholders', {
          sortBy: 'fullName',
          sortDirection: 'asc',
        }),
        fetchAllRows(client, '/api/v1/dental-management/shareholder-transactions', {
          include: ['shareholder'],
          sortBy: 'transactionDate',
          sortDirection: 'desc',
        }),
      ]);

      const shareholderRows = shareholderItems.map((row) => ({
        address: asText(row.address),
        balanceAmount: parseAmount(row.balanceAmount ?? row.balance_amount),
        contactNumber: asText(row.contactNumber ?? row.contact_number),
        contributedAmount: parseAmount(row.contributedAmount ?? row.contributed_amount),
        distributedAmount: parseAmount(row.distributedAmount ?? row.distributed_amount),
        email: asText(row.email),
        fullName: asText(row.fullName ?? row.full_name),
        currency: (asText(row.currency).toUpperCase() === 'USD' ? 'USD' : 'AFN') as CurrencyCode,
        exchangeRate: parseAmount(row.exchangeRate ?? row.exchange_rate) || DEFAULT_AFN_PER_USD,
        id: asText(row.id),
        initialCapital: parseAmount(row.initialCapital ?? row.initial_capital),
        initialCapitalInput: parseAmount(row.initialCapitalInput ?? row.initial_capital_input),
        joinedDate: asText(row.joinedDate ?? row.joined_date),
        notes: asText(row.notes),
        ownershipPercentage: parseAmount(row.ownershipPercentage ?? row.ownership_percentage),
        status: (asText(row.status) === 'inactive' ? 'inactive' : 'active') as
          | 'active'
          | 'inactive',
      }));
      const transactionRows = transactionItems.map((row) => ({
        amount: parseAmount(row.amount),
        amountInput: parseAmount(row.amountInput ?? row.amount_input ?? row.amount),
        currency: (asText(row.currency).toUpperCase() === 'USD' ? 'USD' : 'AFN') as CurrencyCode,
        exchangeRate: parseAmount(row.exchangeRate ?? row.exchange_rate) || DEFAULT_AFN_PER_USD,
        id: asText(row.id),
        notes: asText(row.notes),
        safeTransactionId: asText(row.safeTransactionId ?? row.safe_transaction_id),
        shareholderId: asText(row.shareholderId ?? row.shareholder_id),
        transactionDate: asText(row.transactionDate ?? row.transaction_date),
        transactionType: (asText(row.transactionType ?? row.transaction_type) === 'distribution'
          ? 'distribution'
          : 'contribution') as 'contribution' | 'distribution',
      }));

      setShareholders(shareholderRows);
      setTransactions(transactionRows);
      if (shareholderRows.length === 0) {
        setSelectedShareholderId('');
      } else if (!shareholderRows.some((row) => row.id === selectedShareholderId)) {
        setSelectedShareholderId(shareholderRows[0].id);
      }
    } catch (error: unknown) {
      setShareholders([]);
      setTransactions([]);
      toast.error(extractApiErrorMessage(error, 'Failed to load shareholders data.'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedShareholderId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const shareholderById = useMemo(() => {
    const map = new Map<string, ShareholderRow>();
    shareholders.forEach((row) => map.set(row.id, row));
    return map;
  }, [shareholders]);

  const selectedShareholder = useMemo(
    () => shareholderById.get(selectedShareholderId) ?? null,
    [selectedShareholderId, shareholderById]
  );

  const filteredTransactions = useMemo(
    () =>
      transactions
        .filter((row) => (showAllTransactions ? true : row.shareholderId === selectedShareholderId))
        .sort((left, right) => {
          if (left.transactionDate !== right.transactionDate)
            return right.transactionDate.localeCompare(left.transactionDate);
          return right.id.localeCompare(left.id, undefined, { numeric: true, sensitivity: 'base' });
        }),
    [selectedShareholderId, showAllTransactions, transactions]
  );

  const summary = useMemo(
    () => ({
      active: shareholders.filter((row) => row.status === 'active').length,
      ownership: shareholders.reduce((sum, row) => sum + row.ownershipPercentage, 0),
      total: shareholders.length,
      totalBalance: shareholders.reduce((sum, row) => sum + row.balanceAmount, 0),
      totalContributed: shareholders.reduce((sum, row) => sum + row.contributedAmount, 0),
      totalDistributed: shareholders.reduce((sum, row) => sum + row.distributedAmount, 0),
      totalInitial: shareholders.reduce((sum, row) => sum + row.initialCapital, 0),
    }),
    [shareholders]
  );

  const shareholderMoneySectionsById = useMemo(() => {
    const map = new Map<string, ShareholderMoneySections>();

    shareholders.forEach((row) => {
      const sections = emptyMoneySections();
      sections[row.currency].initialCapital = row.initialCapitalInput;
      sections[row.currency].balanceAmount = row.initialCapitalInput;
      map.set(row.id, sections);
    });

    transactions.forEach((row) => {
      const sections = map.get(row.shareholderId) ?? emptyMoneySections();
      if (!map.has(row.shareholderId)) {
        map.set(row.shareholderId, sections);
      }

      if (row.transactionType === 'distribution') {
        sections[row.currency].distributedAmount += row.amountInput;
        sections[row.currency].balanceAmount -= row.amountInput;
      } else {
        sections[row.currency].contributedAmount += row.amountInput;
        sections[row.currency].balanceAmount += row.amountInput;
      }
    });

    return map;
  }, [shareholders, transactions]);

  const currencySummary = useMemo(() => {
    const totals = emptyMoneySections();

    shareholders.forEach((row) => {
      totals[row.currency].initialCapital += row.initialCapitalInput;
      totals[row.currency].balanceAmount += row.initialCapitalInput;
    });

    transactions.forEach((row) => {
      if (row.transactionType === 'distribution') {
        totals[row.currency].distributedAmount += row.amountInput;
        totals[row.currency].balanceAmount -= row.amountInput;
      } else {
        totals[row.currency].contributedAmount += row.amountInput;
        totals[row.currency].balanceAmount += row.amountInput;
      }
    });

    return totals;
  }, [shareholders, transactions]);

  const renderOriginalMoney = (amountInput: number, currency: CurrencyCode, amountAfn: number): JSX.Element => (
    <div>{formatCurrency(amountInput, currency)}</div>
  );

  const renderCurrencyPair = (
    sections: ShareholderMoneySections,
    field: keyof ShareholderMoneySections['AFN']
  ): JSX.Element => (
    <div className="space-y-1 text-xs">
      <div className="font-medium text-foreground">{formatCurrency(sections.AFN[field], 'AFN')}</div>
      <div className="font-medium text-foreground">{formatCurrency(sections.USD[field], 'USD')}</div>
    </div>
  );

  const resetShareholderForm = (): void => {
    setEditingShareholderId('');
    setFullName('');
    setContactNumber('');
    setEmail('');
    setAddress('');
    setOwnershipPercentage('0');
    setInitialCapital('0');
    setJoinedDate('');
    setStatus('active');
    setShareholderNotes('');
    setShareholderCurrency('AFN');
    setShareholderExchangeRate('1');
  };

  const resetTransactionForm = (): void => {
    setEditingTransactionId('');
    setTransactionType('contribution');
    setTransactionAmount('');
    setTransactionDate(toInputDate(new Date()));
    setTransactionNotes('');
    setTransactionCurrency('AFN');
    setTransactionExchangeRate('1');
  };

  const shareholderResolvedExchangeRate = shareholderCurrency === 'USD'
    ? Math.max(parseAmount(shareholderExchangeRate) || defaultExchangeRate, DEFAULT_AFN_PER_USD)
    : 1;
  const transactionResolvedExchangeRate = transactionCurrency === 'USD'
    ? Math.max(parseAmount(transactionExchangeRate) || defaultExchangeRate, DEFAULT_AFN_PER_USD)
    : 1;

  const submitShareholder = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsedShare = parseAmount(ownershipPercentage);
    const parsedCapital = parseAmount(initialCapital);
    if (fullName.trim() === '' || parsedShare < 0 || parsedShare > 100 || parsedCapital < 0) {
      toast.error('Please provide valid shareholder data.');
      return;
    }

    setIsSavingShareholder(true);
    const payload = {
      address: address.trim() || undefined,
      contactNumber: contactNumber.trim() || undefined,
      currency: shareholderCurrency,
      email: email.trim() || undefined,
      exchangeRate: shareholderResolvedExchangeRate,
      fullName: fullName.trim(),
      initialCapital: parsedCapital,
      joinedDate: joinedDate || undefined,
      notes: shareholderNotes.trim() || undefined,
      ownershipPercentage: parsedShare,
      status,
    };
    const request = editingShareholderId
      ? client.put(`/api/v1/dental-management/shareholders/${editingShareholderId}`, payload)
      : client.post('/api/v1/dental-management/shareholders', payload);
    void request
      .then(async () => {
        resetShareholderForm();
        await fetchData();
        toast.success(editingShareholderId ? 'Shareholder updated.' : 'Shareholder created.');
      })
      .catch((error: unknown) =>
        toast.error(extractApiErrorMessage(error, 'Failed to save shareholder.'))
      )
      .finally(() => setIsSavingShareholder(false));
  };

  const submitTransaction = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsedAmount = parseAmount(transactionAmount);
    if (!selectedShareholderId || parsedAmount <= 0 || !transactionDate) {
      toast.error('Please select a shareholder and valid amount.');
      return;
    }

    setIsSavingTransaction(true);
    const payload = {
      amount: parsedAmount,
      currency: transactionCurrency,
      exchangeRate: transactionResolvedExchangeRate,
      notes: transactionNotes.trim() || undefined,
      shareholderId: Number(selectedShareholderId),
      transactionDate,
      transactionType,
    };
    const request = editingTransactionId
      ? client.put(
          `/api/v1/dental-management/shareholder-transactions/${editingTransactionId}`,
          payload
        )
      : client.post('/api/v1/dental-management/shareholder-transactions', payload);
    void request
      .then(async () => {
        resetTransactionForm();
        await fetchData();
        toast.success(
          editingTransactionId
            ? 'Shareholder transaction updated.'
            : 'Shareholder transaction saved.'
        );
      })
      .catch((error: unknown) =>
        toast.error(extractApiErrorMessage(error, 'Failed to save shareholder transaction.'))
      )
      .finally(() => setIsSavingTransaction(false));
  };

  const startEditShareholder = (row: ShareholderRow): void => {
    setEditingShareholderId(row.id);
    setSelectedShareholderId(row.id);
    setFullName(row.fullName);
    setContactNumber(row.contactNumber);
    setEmail(row.email);
    setAddress(row.address);
    setOwnershipPercentage(String(row.ownershipPercentage));
    setInitialCapital(String(row.initialCapitalInput));
    setJoinedDate(row.joinedDate);
    setStatus(row.status);
    setShareholderNotes(row.notes);
    setShareholderCurrency(row.currency);
    setShareholderExchangeRate(
      String(row.currency === 'USD' ? row.exchangeRate : 1)
    );
  };

  const startEditTransaction = (row: TransactionRow): void => {
    setEditingTransactionId(row.id);
    setSelectedShareholderId(row.shareholderId);
    setTransactionType(row.transactionType);
    setTransactionAmount(String(row.amountInput));
    setTransactionDate(row.transactionDate);
    setTransactionNotes(row.notes);
    setTransactionCurrency(row.currency);
    setTransactionExchangeRate(
      String(row.currency === 'USD' ? row.exchangeRate : 1)
    );
  };

  const removeShareholder = (id: string): void => {
    if (!window.confirm('Delete this shareholder?')) return;
    void client
      .delete(`/api/v1/dental-management/shareholders/${id}`)
      .then(async () => {
        await fetchData();
        toast.success('Shareholder deleted.');
      })
      .catch((error: unknown) =>
        toast.error(extractApiErrorMessage(error, 'Failed to delete shareholder.'))
      );
  };

  const removeTransaction = (id: string): void => {
    if (!window.confirm('Delete this shareholder transaction?')) return;
    void client
      .delete(`/api/v1/dental-management/shareholder-transactions/${id}`)
      .then(async () => {
        await fetchData();
        toast.success('Shareholder transaction deleted.');
      })
      .catch((error: unknown) =>
        toast.error(extractApiErrorMessage(error, 'Failed to delete shareholder transaction.'))
      );
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('dentalManagement.title') },
          { id: 'shareholders', isCurrent: true, label: tDental('shareholders') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardTitle>Shareholder Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 xl:grid-cols-[1fr_1fr_1.1fr]">
                {(['AFN', 'USD'] as CurrencyCode[]).map((currency) => (
                  <div key={currency} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">{currency} Summary</p>
                    <div className="mt-3 grid gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Initial Capital</p>
                        <p className="text-lg font-semibold">{formatCurrency(currencySummary[currency].initialCapital, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Contributed</p>
                        <p className="text-lg font-semibold text-emerald-700">{formatCurrency(currencySummary[currency].contributedAmount, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Distributed</p>
                        <p className="text-lg font-semibold text-rose-700">{formatCurrency(currencySummary[currency].distributedAmount, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Net Position</p>
                        <p className="text-lg font-semibold text-indigo-700">{formatCurrency(currencySummary[currency].balanceAmount, currency)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Shareholders</p>
                    <p className="text-lg font-semibold">{summary.total}</p>
                    <p className="text-xs text-muted-foreground">Active: {summary.active}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Ownership</p>
                    <p className="text-lg font-semibold">{summary.ownership.toFixed(2)}%</p>
                    <Badge variant={summary.ownership > 100 ? 'destructive' : 'secondary'}>
                      {summary.ownership > 100 ? 'Over 100%' : 'OK'}
                    </Badge>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">AFN Base Initial Capital</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(summary.totalInitial, 'AFN')}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-emerald-100/70 p-3 text-emerald-900">
                    <p className="text-xs">AFN Base Contributed</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(summary.totalContributed, 'AFN')}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-rose-100/70 p-3 text-rose-900">
                    <p className="text-xs">AFN Base Distributed</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(summary.totalDistributed, 'AFN')}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-indigo-100/70 p-3 text-indigo-900">
                    <p className="text-xs">AFN Base Net Position</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(summary.totalBalance, 'AFN')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-2xl border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {editingShareholderId ? 'Edit Shareholder' : 'Add Shareholder'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-3" onSubmit={submitShareholder}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>Full Name</Label>
                        <Input
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          required
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Contact Number</Label>
                        <Input
                          value={contactNumber}
                          onChange={(event) => setContactNumber(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Joined Date</Label>
                        <Input
                          type="date"
                          value={joinedDate}
                          onChange={(event) => setJoinedDate(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Address</Label>
                      <Input value={address} onChange={(event) => setAddress(event.target.value)} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="grid gap-1.5">
                        <Label>Ownership %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={ownershipPercentage}
                          onChange={(event) => setOwnershipPercentage(event.target.value)}
                          required
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Initial Capital</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={initialCapital}
                          onChange={(event) => setInitialCapital(event.target.value)}
                          required
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Status</Label>
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={status}
                          onChange={(event) =>
                            setStatus(event.target.value as 'active' | 'inactive')
                          }
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>Currency</Label>
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={shareholderCurrency}
                          onChange={(event) => {
                            const nextCurrency = event.target.value as CurrencyCode;
                            setShareholderCurrency(nextCurrency);
                            setShareholderExchangeRate(
                              nextCurrency === 'USD' ? String(defaultExchangeRate) : '1'
                            );
                          }}
                        >
                          <option value="AFN">AFN</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Exchange Rate</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={shareholderExchangeRate}
                          onChange={(event) => setShareholderExchangeRate(event.target.value)}
                          disabled={shareholderCurrency === 'AFN'}
                          placeholder="AFN per 1 USD"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-dashed bg-slate-50/80 p-3 text-xs text-muted-foreground">
                      This shareholder record is tracked only inside the selected currency section.
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Notes</Label>
                      <textarea
                        className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
                        value={shareholderNotes}
                        onChange={(event) => setShareholderNotes(event.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={isSavingShareholder}>
                        {isSavingShareholder
                          ? 'Saving...'
                          : editingShareholderId
                            ? 'Update Shareholder'
                            : 'Create Shareholder'}
                      </Button>
                      {editingShareholderId ? (
                        <Button type="button" variant="outline" onClick={resetShareholderForm}>
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {editingTransactionId ? 'Edit Transaction' : 'Add Transaction'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-3" onSubmit={submitTransaction}>
                    <div className="grid gap-1.5">
                      <Label>Shareholder</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={selectedShareholderId}
                        onChange={(event) => setSelectedShareholderId(event.target.value)}
                        required
                      >
                        <option value="">Select shareholder</option>
                        {shareholders.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>Type</Label>
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={transactionType}
                          onChange={(event) =>
                            setTransactionType(
                              event.target.value as 'contribution' | 'distribution'
                            )
                          }
                        >
                          <option value="contribution">Contribution</option>
                          <option value="distribution">Distribution</option>
                        </select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={transactionDate}
                          onChange={(event) => setTransactionDate(event.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={transactionAmount}
                        onChange={(event) => setTransactionAmount(event.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>Currency</Label>
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={transactionCurrency}
                          onChange={(event) => {
                            const nextCurrency = event.target.value as CurrencyCode;
                            setTransactionCurrency(nextCurrency);
                            setTransactionExchangeRate(
                              nextCurrency === 'USD' ? String(defaultExchangeRate) : '1'
                            );
                          }}
                        >
                          <option value="AFN">AFN</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Exchange Rate</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={transactionExchangeRate}
                          onChange={(event) => setTransactionExchangeRate(event.target.value)}
                          disabled={transactionCurrency === 'AFN'}
                          placeholder="AFN per 1 USD"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-dashed bg-slate-50/80 p-3 text-xs text-muted-foreground">
                      This transaction affects only the selected currency section.
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Notes</Label>
                      <textarea
                        className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
                        value={transactionNotes}
                        onChange={(event) => setTransactionNotes(event.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={isSavingTransaction || shareholders.length === 0}
                      >
                        {isSavingTransaction
                          ? 'Saving...'
                          : editingTransactionId
                            ? 'Update Transaction'
                            : 'Add Transaction'}
                      </Button>
                      {editingTransactionId ? (
                        <Button type="button" variant="outline" onClick={resetTransactionForm}>
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardTitle>Shareholders</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Loading shareholders...
                  </p>
                ) : shareholders.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No shareholders yet.
                  </p>
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
                          <th className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shareholders.map((row) => (
                          <tr
                            key={row.id}
                            className={`cursor-pointer border-b ${selectedShareholderId === row.id ? 'bg-amber-50/60' : ''}`}
                            onClick={() => {
                              setSelectedShareholderId(row.id);
                              setShowAllTransactions(false);
                            }}
                          >
                            <td className="px-3 py-2">
                              <p className="font-medium">{row.fullName}</p>
                              <p className="text-xs text-muted-foreground">
                                {row.contactNumber || row.email || '-'}
                              </p>
                            </td>
                            <td className="px-3 py-2">{row.ownershipPercentage.toFixed(2)}%</td>
                            <td className="px-3 py-2">
                              {renderOriginalMoney(row.initialCapitalInput, row.currency, row.initialCapital)}
                            </td>
                            <td className="px-3 py-2 text-emerald-700">
                              {renderCurrencyPair(shareholderMoneySectionsById.get(row.id) ?? emptyMoneySections(), 'contributedAmount')}
                            </td>
                            <td className="px-3 py-2 text-rose-700">
                              {renderCurrencyPair(shareholderMoneySectionsById.get(row.id) ?? emptyMoneySections(), 'distributedAmount')}
                            </td>
                            <td className="px-3 py-2 font-semibold">
                              {renderCurrencyPair(shareholderMoneySectionsById.get(row.id) ?? emptyMoneySections(), 'balanceAmount')}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>
                                {row.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    startEditShareholder(row);
                                  }}
                                >
                                  <PencilLine className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeShareholder(row.id);
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
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
                <CardTitle>Shareholder Transactions</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={showAllTransactions ? 'secondary' : 'outline'}
                    onClick={() => setShowAllTransactions(true)}
                  >
                    Show All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!showAllTransactions ? 'secondary' : 'outline'}
                    onClick={() => setShowAllTransactions(false)}
                  >
                    Selected Only
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Loading transactions...
                  </p>
                ) : filteredTransactions.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No shareholder transactions found.
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
                          <th className="px-3 py-2">Actions</th>
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
                              {renderOriginalMoney(row.amountInput, row.currency, row.amount)}
                            </td>
                            <td className="px-3 py-2">{row.safeTransactionId || '-'}</td>
                            <td className="px-3 py-2">{row.notes || '-'}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditTransaction(row)}
                                >
                                  <PencilLine className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeTransaction(row.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!showAllTransactions && selectedShareholder ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Selected: {selectedShareholder.fullName} | Joined:{' '}
                    {formatDate(selectedShareholder.joinedDate)} | Original balance:{' '}
                    {formatCurrency((shareholderMoneySectionsById.get(selectedShareholder.id) ?? emptyMoneySections()).AFN.balanceAmount, 'AFN')} / {' '}
                    {formatCurrency((shareholderMoneySectionsById.get(selectedShareholder.id) ?? emptyMoneySections()).USD.balanceAmount, 'USD')}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

