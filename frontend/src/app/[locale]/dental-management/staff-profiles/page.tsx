'use client';

import { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { useStaffList } from '@/modules/dental-management/presentation/hooks';
import { Coins, HandCoins, ReceiptText, Users } from 'lucide-react';

type PaginatedRowsResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: {
    currentPage?: number;
    lastPage?: number;
  };
};

type SalaryRow = {
  bonusAmount: number;
  deductionAmount: number;
  grossAmount: number;
  id: string;
  netAmount: number;
  notes: string;
  paymentDate: string;
  salaryMonth: string;
  staffId: string;
  status: string;
};

type SafeRow = {
  amount: number;
  direction: string;
  entryType: string;
  id: string;
  notes: string;
  pickedByStaffId: string;
  transactionDate: string;
};

type VisitRow = {
  dentistId: string;
  id: string;
  patientId: string;
  tag: string;
  visitDate: string;
};

type InvoiceRow = {
  id: string;
  invoiceDate: string;
  netAmount: number;
  paidAmount: number;
  status: string;
  visitId: string;
};

type StaffFinancialProfile = {
  billedAmount: number;
  collectionsAmount: number;
  debtAmount: number;
  invoiceRows: InvoiceRow[];
  patientCount: number;
  safeOutAmount: number;
  safeRows: SafeRow[];
  salaryPaidAmount: number;
  salaryPendingAmount: number;
  salaryRows: SalaryRow[];
  staffId: string;
  visitCount: number;
};

const API_MAX_PER_PAGE = 100;
const apiClient = new AxiosClient();

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
};

const parseAmount = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(asText(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);

const formatDate = (value: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed);
};

const formatSalaryMonth = (value: string): string => {
  if (!value) return '-';
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
};

const fetchAllRows = async (
  endpoint: string,
  params: Record<string, unknown>
): Promise<Array<Record<string, unknown>>> => {
  const rows: Array<Record<string, unknown>> = [];
  let page = 1;

  while (true) {
    const response = await apiClient.get<PaginatedRowsResponse>(endpoint, {
      params: {
        ...params,
        page,
        perPage: API_MAX_PER_PAGE,
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

// eslint-disable-next-line react/function-component-definition
export default function StaffProfilesPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar');
  const { entities: staff, isFetching: isLoadingStaff } = useStaffList(1, 100);
  const typedStaff = staff as Staff[];

  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([]);
  const [safeRows, setSafeRows] = useState<SafeRow[]>([]);
  const [visitRows, setVisitRows] = useState<VisitRow[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isLoadingFinance, setIsLoadingFinance] = useState(false);

  const fetchFinanceData = useCallback(async (): Promise<void> => {
    setIsLoadingFinance(true);
    try {
      const [salaryItems, safeItems, visitItems, invoiceItems] = await Promise.all([
        fetchAllRows('/api/v1/dental-management/salary-payments', {
          include: ['staff'],
          sortBy: 'paymentDate',
          sortDirection: 'desc',
        }),
        fetchAllRows('/api/v1/dental-management/safe-transactions', {
          include: ['pickedByStaff'],
          sortBy: 'transactionDate',
          sortDirection: 'desc',
        }),
        fetchAllRows('/api/v1/dental-management/visits', {
          include: ['patient', 'dentist'],
          sortBy: 'visitDate',
          sortDirection: 'desc',
        }),
        fetchAllRows('/api/v1/dental-management/invoices', {
          include: ['visit', 'payments'],
          sortBy: 'invoiceDate',
          sortDirection: 'desc',
        }),
      ]);

      setSalaryRows(
        salaryItems.map((row) => ({
          bonusAmount: parseAmount(row.bonusAmount ?? row.bonus_amount),
          deductionAmount: parseAmount(row.deductionAmount ?? row.deduction_amount),
          grossAmount: parseAmount(row.grossAmount ?? row.gross_amount),
          id: asText(row.id),
          netAmount: parseAmount(row.netAmount ?? row.net_amount),
          notes: asText(row.notes),
          paymentDate: asText(row.paymentDate ?? row.payment_date),
          salaryMonth: asText(row.salaryMonth ?? row.salary_month),
          staffId: asText(row.staffId ?? row.staff_id),
          status: asText(row.status),
        }))
      );
      setSafeRows(
        safeItems.map((row) => ({
          amount: parseAmount(row.amount),
          direction: asText(row.direction),
          entryType: asText(row.entryType ?? row.entry_type),
          id: asText(row.id),
          notes: asText(row.notes),
          pickedByStaffId: asText(row.pickedByStaffId ?? row.picked_by_staff_id),
          transactionDate: asText(row.transactionDate ?? row.transaction_date),
        }))
      );
      setVisitRows(
        visitItems.map((row) => ({
          dentistId: asText(row.dentistId ?? row.dentist_id),
          id: asText(row.id),
          patientId: asText(row.patientId ?? row.patient_id),
          tag: asText(row.tag),
          visitDate: asText(row.visitDate ?? row.visit_date),
        }))
      );
      setInvoiceRows(
        invoiceItems.map((row) => {
          const netAmount = parseAmount(row.netAmount ?? row.net_amount);
          const payments = Array.isArray(row.payments) ? row.payments : [];
          const paidFromPayments = payments.reduce((sum, payment) => {
            if (!payment || typeof payment !== 'object') return sum;
            return sum + parseAmount((payment as Record<string, unknown>).amount);
          }, 0);
          const status = asText(row.status).toLowerCase();
          const paidAmount = status === 'paid' && paidFromPayments <= 0 && netAmount > 0
            ? netAmount
            : paidFromPayments;

          return {
            id: asText(row.id),
            invoiceDate: asText(row.invoiceDate ?? row.invoice_date),
            netAmount,
            paidAmount,
            status,
            visitId: asText(row.visitId ?? row.visit_id),
          };
        })
      );
    } finally {
      setIsLoadingFinance(false);
    }
  }, []);

  useEffect(() => {
    void fetchFinanceData();
  }, [fetchFinanceData]);

  useEffect(() => {
    if (!selectedStaffId && typedStaff.length > 0) {
      setSelectedStaffId(String(typedStaff[0].id));
    }
  }, [selectedStaffId, typedStaff]);

  const profilesByStaffId = useMemo(() => {
    const visitDentistByVisitId = new Map<string, string>();
    visitRows.forEach((visit) => {
      visitDentistByVisitId.set(visit.id, visit.dentistId);
    });

    const profileMap = new Map<string, StaffFinancialProfile>();

    const getProfile = (staffId: string): StaffFinancialProfile => {
      const existing = profileMap.get(staffId);
      if (existing) return existing;

      const created: StaffFinancialProfile = {
        billedAmount: 0,
        collectionsAmount: 0,
        debtAmount: 0,
        invoiceRows: [],
        patientCount: 0,
        safeOutAmount: 0,
        safeRows: [],
        salaryPaidAmount: 0,
        salaryPendingAmount: 0,
        salaryRows: [],
        staffId,
        visitCount: 0,
      };
      profileMap.set(staffId, created);
      return created;
    };

    const uniquePatientsByStaff = new Map<string, Set<string>>();
    visitRows.forEach((visit) => {
      if (!visit.dentistId) return;
      const profile = getProfile(visit.dentistId);
      profile.visitCount += 1;

      const set = uniquePatientsByStaff.get(visit.dentistId) ?? new Set<string>();
      if (visit.patientId) {
        set.add(visit.patientId);
      }
      uniquePatientsByStaff.set(visit.dentistId, set);
    });

    salaryRows.forEach((salary) => {
      if (!salary.staffId) return;
      const profile = getProfile(salary.staffId);
      profile.salaryRows.push(salary);
      if (salary.status === 'paid' || salary.status === 'partial') {
        profile.salaryPaidAmount += salary.netAmount;
      } else {
        profile.salaryPendingAmount += salary.netAmount;
      }
    });

    safeRows.forEach((row) => {
      if (!row.pickedByStaffId || row.direction !== 'out') return;
      const profile = getProfile(row.pickedByStaffId);
      profile.safeRows.push(row);
      profile.safeOutAmount += row.amount;
    });

    invoiceRows.forEach((invoice) => {
      const dentistId = visitDentistByVisitId.get(invoice.visitId);
      if (!dentistId) return;
      const profile = getProfile(dentistId);
      profile.invoiceRows.push(invoice);
      profile.billedAmount += invoice.netAmount;
      profile.collectionsAmount += invoice.paidAmount;
      profile.debtAmount += Math.max(0, invoice.netAmount - invoice.paidAmount);
    });

    for (const [staffId, patients] of uniquePatientsByStaff.entries()) {
      const profile = getProfile(staffId);
      profile.patientCount = patients.size;
    }

    return profileMap;
  }, [invoiceRows, safeRows, salaryRows, visitRows]);

  const selectedStaff = useMemo(
    () => typedStaff.find((row) => String(row.id) === selectedStaffId) ?? null,
    [selectedStaffId, typedStaff]
  );
  const selectedProfile = useMemo(
    () => profilesByStaffId.get(selectedStaffId),
    [profilesByStaffId, selectedStaffId]
  );

  const totalCollections = useMemo(() => {
    let total = 0;
    profilesByStaffId.forEach((profile) => {
      total += profile.collectionsAmount;
    });
    return total;
  }, [profilesByStaffId]);

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('dentalManagement.title') },
          { id: 'staffProfiles', isCurrent: true, label: tSidebar('dentalManagement.staffProfiles') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <div className="grid gap-3 md:grid-cols-3">
              <Card className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-background">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Staff</p>
                  <p className="text-2xl font-semibold">{typedStaff.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-background">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Staff Collections</p>
                  <p className="text-2xl font-semibold">{formatCurrency(totalCollections)}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-background">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Data Status</p>
                  <p className="text-2xl font-semibold">
                    {(isLoadingStaff || isLoadingFinance) ? 'Loading...' : 'Ready'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Users className="size-5 text-primary" />
                  Staff Profiles
                </CardTitle>
                <CardDescription>
                  Select any staff member to view full profile, salary history, and payment performance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {typedStaff.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No staff records available.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {typedStaff.map((member) => {
                      const profile = profilesByStaffId.get(String(member.id));
                      const isActive = String(member.id) === selectedStaffId;
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            setSelectedStaffId(String(member.id));
                          }}
                          className={`rounded-xl border p-4 text-left transition ${
                            isActive
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                              : 'border-border/70 hover:border-primary/50 hover:bg-accent/20'
                          }`}
                        >
                          <p className="font-semibold">{member.fullName || `Staff #${member.id}`}</p>
                          <p className="text-xs text-muted-foreground capitalize">{member.role || '-'}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Collections: {formatCurrency(profile?.collectionsAmount ?? 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Salaries Paid: {formatCurrency(profile?.salaryPaidAmount ?? 0)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedStaff && selectedProfile ? (
              <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                <Card className="rounded-2xl border">
                  <CardHeader>
                    <CardTitle>{selectedStaff.fullName || `Staff #${selectedStaff.id}`}</CardTitle>
                    <CardDescription>Profile and financial snapshot</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Role:</strong> {selectedStaff.role || '-'}</p>
                    <p><strong>Specialization:</strong> {selectedStaff.specialization || '-'}</p>
                    <p><strong>Contact:</strong> {selectedStaff.contactNumber || '-'}</p>
                    <p><strong>Email:</strong> {selectedStaff.email || '-'}</p>
                    <p><strong>Hire Date:</strong> {formatDate(selectedStaff.hireDate)}</p>
                    <p><strong>Remarks:</strong> {selectedStaff.remarks || '-'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Patients Served</p>
                        <p className="font-semibold">{selectedProfile.patientCount}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Total Visits</p>
                        <p className="font-semibold">{selectedProfile.visitCount}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Collected</p>
                        <p className="font-semibold">{formatCurrency(selectedProfile.collectionsAmount)}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className="font-semibold">{formatCurrency(selectedProfile.debtAmount)}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Salary Paid</p>
                        <p className="font-semibold">{formatCurrency(selectedProfile.salaryPaidAmount)}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Safe Picked</p>
                        <p className="font-semibold">{formatCurrency(selectedProfile.safeOutAmount)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border">
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-2">
                      <Coins className="size-5 text-emerald-600" />
                      Salary History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedProfile.salaryRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No salary records yet.</p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto rounded-md border">
                        <table className="min-w-full text-xs">
                          <thead className="bg-muted/30">
                            <tr>
                              <th className="px-2 py-2 text-left">Month</th>
                              <th className="px-2 py-2 text-left">Date</th>
                              <th className="px-2 py-2 text-left">Status</th>
                              <th className="px-2 py-2 text-right">Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedProfile.salaryRows.map((row) => (
                              <tr key={row.id} className="border-t">
                                <td className="px-2 py-2">{formatSalaryMonth(row.salaryMonth)}</td>
                                <td className="px-2 py-2">{formatDate(row.paymentDate)}</td>
                                <td className="px-2 py-2 capitalize">{row.status || '-'}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(row.netAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border">
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-2">
                      <ReceiptText className="size-5 text-blue-600" />
                      Invoice Payments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedProfile.invoiceRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No invoice payment data for this staff yet.</p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto rounded-md border">
                        <table className="min-w-full text-xs">
                          <thead className="bg-muted/30">
                            <tr>
                              <th className="px-2 py-2 text-left">Invoice</th>
                              <th className="px-2 py-2 text-left">Date</th>
                              <th className="px-2 py-2 text-right">Net</th>
                              <th className="px-2 py-2 text-right">Paid</th>
                              <th className="px-2 py-2 text-right">Debt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedProfile.invoiceRows.map((row) => (
                              <tr key={row.id} className="border-t">
                                <td className="px-2 py-2">#{row.id}</td>
                                <td className="px-2 py-2">{formatDate(row.invoiceDate)}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(row.netAmount)}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(row.paidAmount)}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(Math.max(0, row.netAmount - row.paidAmount))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border">
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-2">
                      <HandCoins className="size-5 text-orange-600" />
                      Safe Pickups
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedProfile.safeRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No safe pickup entries for this staff.</p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto rounded-md border">
                        <table className="min-w-full text-xs">
                          <thead className="bg-muted/30">
                            <tr>
                              <th className="px-2 py-2 text-left">Date</th>
                              <th className="px-2 py-2 text-left">Type</th>
                              <th className="px-2 py-2 text-right">Amount</th>
                              <th className="px-2 py-2 text-left">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedProfile.safeRows.map((row) => (
                              <tr key={row.id} className="border-t">
                                <td className="px-2 py-2">{formatDate(row.transactionDate)}</td>
                                <td className="px-2 py-2 capitalize">{row.entryType.replaceAll('_', ' ')}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(row.amount)}</td>
                                <td className="px-2 py-2">{row.notes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
