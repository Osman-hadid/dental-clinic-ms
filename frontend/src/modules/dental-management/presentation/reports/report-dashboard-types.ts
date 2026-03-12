export type ReportTab = 'audit' | 'clinical' | 'executive' | 'financial' | 'inventory';
export type CsvExportType =
  | 'audit_log'
  | 'clinical_treatment'
  | 'executive_summary'
  | 'financial_daily_safe'
  | 'financial_implant_installment'
  | 'financial_outstanding'
  | 'financial_patient_details'
  | 'financial_shareholder'
  | 'financial_revenue'
  | 'inventory_stock';
export type SnapshotCadence = 'daily' | 'monthly' | 'off' | 'weekly';

export type FilterOptionsResponse = {
  clinicalExpenseCategories: string[];
  dailyExpenseCategories: string[];
  dentists: string[];
  patients: Array<{ id: number | string; name: string }>;
  paymentMethods: string[];
  shareholders: Array<{ id: number; name: string }>;
  staff: Array<{ id: number; name: string }>;
  treatments: string[];
};

export type ExecutiveData = {
  bankBalance: number;
  cashInSafe: number;
  chairUtilizationRate: number;
  dentistProductivity: Array<{ dentist: string; revenue: number; visits: number }>;
  expenseSummary: {
    byCategory: Array<{ amount: number; category: string }>;
    clinical: number;
    daily: number;
    total: number;
  };
  implantPlacementTrend: Array<{ count: number; key: string; label: string; revenue: number }>;
  implantRevenue: number;
  kpis: Record<string, number>;
  newPatientsCount: number;
  profitLoss: number;
  profitLossTrend: Array<{ income: number; key: string; label: string; outcome: number; profit: number }>;
  revenueTrendMonthly: Array<{ amount: number; key: string; label: string }>;
  treatmentAcceptanceRate: number;
  treatmentVolume: Array<{ name: string; revenue: number; sessions: number }>;
};

export type FinancialData = {
  charts: {
    expenseByCategory: Array<{ amount: number; category: string }>;
    paymentMethodMix: Array<{ amount: number; count: number; method: string }>;
    revenueTrend: Array<{ amount: number; key: string; label: string }>;
    safeFlow: Array<{ in: number; key: string; label: string; out: number }>;
  };
  summary: {
    billed: number;
    collectionRate: number;
    expenses: number;
    net: number;
    outstanding: number;
    paid: number;
    safeBalance: number;
    safeIn: number;
    safeOut: number;
    salaryPaid: number;
    shareholderContribution: number;
    shareholderDistribution: number;
    thirdCompanyPaid: number;
    thirdCompanyUnpaid: number;
  };
  tables: {
    implantCompanyRecords: Array<Record<string, unknown>>;
    implantInstallments: Array<Record<string, unknown>>;
    outstandingInvoices: Array<Record<string, unknown>>;
    revenueByDentist: Array<Record<string, unknown>>;
    revenueByPatient: Array<Record<string, unknown>>;
    revenueByPaymentMethod: Array<Record<string, unknown>>;
    revenueByTreatment: Array<Record<string, unknown>>;
    safeLedger: Array<Record<string, unknown>>;
    shareholderLedger: Array<Record<string, unknown>>;
  };
};

export type ClinicalData = {
  charts: {
    appointmentStatusBreakdown: Array<{ count: number; status: string }>;
    dentistProductivity: Array<{ dentist: string; revenue: number; visits: number }>;
    implantPlacementTrend: Array<{ count: number; key: string; label: string; revenue: number }>;
    treatmentVolume: Array<{ name: string; revenue: number; sessions: number }>;
  };
  summary: {
    appointments: number;
    completedAppointments: number;
    implantCases: number;
    patients: number;
    prescriptions: number;
    visitTreatments: number;
    visits: number;
  };
  tables: {
    dentistPerformance: Array<Record<string, unknown>>;
    implantCases: Array<Record<string, unknown>>;
    prescriptions: Array<Record<string, unknown>>;
    treatmentPerformance: Array<Record<string, unknown>>;
  };
};

export type InventoryData = {
  charts: {
    availabilityBreakdown: Array<{ count: number; status: string }>;
    categoryBreakdown: Array<{ category: string; count: number }>;
    usageByTreatment: Array<{ quantityUsed: number; treatmentName: string }>;
  };
  summary: {
    lowStockCount: number;
    outOfStockCount: number;
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
  };
  tables: {
    implantStockRows: Array<Record<string, unknown>>;
    stockRows: Array<Record<string, unknown>>;
    usageRows: Array<Record<string, unknown>>;
  };
};

export type AuditData = {
  financialModifications: Array<{ action: string; afterValue: string; beforeValue: string; changedBy: string; entity: string; timestamp: string }>;
  summary: {
    accessCount: number;
    modificationCount: number;
    snapshotCount: number;
  };
  timeline: Array<{ action: string; changedBy: string; entity: string; timestamp: string; type: string }>;
};

export type SnapshotRecord = {
  capturedAt: string;
  filters: Record<string, unknown>;
  id: number;
  payload: {
    bankBalance?: number;
    cashInSafe?: number;
    kpis?: Record<string, number>;
    profitLoss?: number;
    treatmentAcceptanceRate?: number;
  };
  reason: string;
  reportKey: string;
};

export type SnapshotScheduleResponse = {
  cadence: SnapshotCadence;
  filters: Record<string, unknown>;
  lastRunAt: string | null;
  reportKey: string;
};

export type FiltersState = {
  dentistFilter: string;
  endDate: string;
  granularity: 'day' | 'month' | 'year';
  patientFilter: string;
  paymentMethodFilter: string;
  search: string;
  startDate: string;
  statusFilter: 'all' | 'cancelled' | 'completed' | 'pending';
  treatmentFilter: string;
};

export const pieColors = ['#0f766e', '#f97316', '#2563eb', '#7c3aed', '#16a34a', '#dc2626', '#0ea5e9'];
