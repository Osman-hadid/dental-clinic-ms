'use client';

import { JSX, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { ListStaffUseCase } from '@/modules/dental-management/application/use-cases/staff/list-staff-use-case';
import { ListTreatmentsUseCase } from '@/modules/dental-management/application/use-cases/treatments/list-treatments-use-case';
import { ListVisitTreatmentsUseCase } from '@/modules/dental-management/application/use-cases/visit-treatments/list-visit-treatments-use-case';
import { ListVisitsUseCase } from '@/modules/dental-management/application/use-cases/visits/list-visits-use-case';
import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import { StaffRepository } from '@/modules/dental-management/infrastructure/repositories/staff-repository';
import { TreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/treatment-repository';
import { VisitTreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/visit-treatment-repository';
import { VisitRepository } from '@/modules/dental-management/infrastructure/repositories/visit-repository';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardCheck, Loader2, Printer, RefreshCcw, Save, ShieldAlert } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_AFN_PER_USD,
  type CurrencyCode,
  convertInputToUsd,
  convertUsdToInput,
  formatCurrency,
  getExchangeRate,
  parseMoney,
} from '@/lib/currency-utils';
import { ListPatientsUseCase } from '@/modules/dental-management/application/use-cases/patients/list-patients-use-case';

type LoadingProtocol = 'delayed' | 'early' | 'immediate';
type ImplantArch = 'maxilla' | 'mandible' | 'both';
type ImagingType = 'cbct' | 'panoramic' | 'none';

type RiskFactorKey =
  | 'smoking'
  | 'periodontitisHistory'
  | 'uncontrolledDiabetes'
  | 'bruxism'
  | 'bisphosphonateUse'
  | 'poorHygiene';

type ImplantPlanningForm = {
  boneHeightMm: string;
  boneWidthMm: string;
  currency: CurrencyCode;
  dentistId: string;
  exchangeRate: string;
  imagingType: ImagingType;
  implantCompanyDate: string;
  implantCompanyId: string;
  implantCompanyName: string;
  implantCompanyNote: string;
  implantCompanyType: string;
  implantArch: ImplantArch;
  implantDiameterMm: string;
  implantLengthMm: string;
  implantPricePerTooth: string;
  implantSystem: string;
  insertionTorqueNcm: string;
  keratinizedTissueMm: string;
  linkedVisitId: string;
  loadingProtocol: LoadingProtocol;
  notes: string;
  paidNowAmount: string;
  patientId: string;
  paymentMethod: 'cash' | 'card' | 'insurance';
  supplierCostPerTooth: string;
  primaryStabilityIsq: string;
  prosthesisType: string;
  riskFactors: RiskFactorKey[];
  surgeryGuideType: 'freehand' | 'pilot' | 'fully-guided';
  treatmentId: string;
  visitDate: string;
};

type ChecklistItem = {
  complete: boolean;
  label: string;
};

type SaveSummary = {
  createdVisit: boolean;
  currency: CurrencyCode;
  exchangeRate: number;
  invoiceId: number;
  paidNowAmount: number;
  paidNowAmountInput: number;
  paymentId?: number;
  supplierRemainingAmountInput: number;
  supplierRemainingAmount: number;
  supplierTotalCostInput: number;
  supplierTotalCost: number;
  remainingDebt: number;
  remainingDebtInput: number;
  savedAt: string;
  treatmentCount: number;
  visitId: number;
};

type ImplantCompanyRecord = {
  companyName: string;
  id: number;
  implantType: string;
  note?: string;
  recordDate?: string;
};

const RISK_FACTOR_LABELS: Record<RiskFactorKey, string> = {
  bisphosphonateUse: 'Bisphosphonate/anti-resorptive history',
  bruxism: 'Bruxism or heavy occlusal load',
  periodontitisHistory: 'History of periodontitis',
  poorHygiene: 'Poor oral hygiene/plaque control',
  smoking: 'Smoker',
  uncontrolledDiabetes: 'Uncontrolled diabetes',
};


const buildDefaultForm = (): ImplantPlanningForm => ({
  boneHeightMm: '',
  boneWidthMm: '',
  currency: 'AFN',
  dentistId: '',
  exchangeRate: '1',
  imagingType: 'cbct',
  implantCompanyDate: new Date().toISOString().slice(0, 10),
  implantCompanyId: '',
  implantCompanyName: '',
  implantCompanyNote: '',
  implantCompanyType: '',
  implantArch: 'maxilla',
  implantDiameterMm: '',
  implantLengthMm: '',
  implantPricePerTooth: '',
  implantSystem: '',
  insertionTorqueNcm: '',
  keratinizedTissueMm: '',
  linkedVisitId: '',
  loadingProtocol: 'delayed',
  notes: '',
  paidNowAmount: '0',
  patientId: '',
  paymentMethod: 'cash',
  primaryStabilityIsq: '',
  prosthesisType: 'Single crown',
  riskFactors: [],
  supplierCostPerTooth: '0',
  surgeryGuideType: 'pilot',
  treatmentId: '',
  visitDate: '',
});

const toNumber = (value: string): number | null => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value).trim();
  return '';
};

const truncate = (value: string, maxLength: number): string => {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

const isToothNumber = (value: string): boolean => /^[0-9]{2}$/.test(value);
const resolveArchFromToothNumber = (toothNumber: string): Exclude<ImplantArch, 'both'> | null => {
  const quadrant = toothNumber.charAt(0);
  if (quadrant === '1' || quadrant === '2') {
    return 'maxilla';
  }
  if (quadrant === '3' || quadrant === '4') {
    return 'mandible';
  }

  return null;
};

const parseToothNumbersFromValue = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(isToothNumber)
    )
  );
};

const parseConditionToken = (value?: string): 'implant' | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'implant' || normalized === 'i') {
    return 'implant';
  }

  return null;
};

const parseConditionFromNotes = (value?: string): 'implant' | null => {
  if (!value) {
    return null;
  }

  const match = value.match(/\[condition:([a-z]+)\]/i);
  if (!match) {
    return null;
  }

  return parseConditionToken(match[1]);
};

const parseToothNumberFromNotes = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  const match = value.match(/\[tooth:([0-9]{2})\]/i);
  return match?.[1] ?? null;
};

const parseToothConditionMapFromNotes = (value?: string): Record<string, 'implant'> => {
  if (!value) {
    return {};
  }

  const match = value.match(/\[chart:([^\]]+)\]/i);
  if (!match) {
    return {};
  }

  const result: Record<string, 'implant'> = {};
  const pairs = match[1].split(',');
  for (const pair of pairs) {
    const [toothRaw, conditionRaw] = pair.split('=').map((item) => item?.trim() ?? '');
    const condition = parseConditionToken(conditionRaw);
    if (isToothNumber(toothRaw) && condition === 'implant') {
      result[toothRaw] = 'implant';
    }
  }

  return result;
};

const inferConditionFromText = (value?: string): 'implant' | null => {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase().includes('implant') ? 'implant' : null;
};

const extractImplantTeeth = (visitTreatments: VisitTreatment[]): string[] => {
  const implantTeeth = new Set<string>();

  visitTreatments.forEach((item) => {
    const mapFromChart = parseToothConditionMapFromNotes(item.notes);
    Object.keys(mapFromChart).forEach((toothNumber) => {
      implantTeeth.add(toothNumber);
    });

    if (Object.keys(mapFromChart).length > 0) {
      return;
    }

    const inferredCondition = parseConditionFromNotes(item.notes) ?? inferConditionFromText(item.notes);
    if (inferredCondition !== 'implant') {
      return;
    }

    parseToothNumbersFromValue(item.toothNumber).forEach((toothNumber) => {
      implantTeeth.add(toothNumber);
    });

    const toothFromNotes = parseToothNumberFromNotes(item.notes);
    if (toothFromNotes) {
      implantTeeth.add(toothFromNotes);
    }
  });

  return Array.from(implantTeeth).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
};

const getRiskLevel = (score: number): { label: string; tone: 'default' | 'secondary' | 'destructive' } => {
  if (score >= 6) return { label: 'High risk', tone: 'destructive' };
  if (score >= 3) return { label: 'Moderate risk', tone: 'secondary' };
  return { label: 'Low risk', tone: 'default' };
};

// eslint-disable-next-line react/function-component-definition
export default function ImplantsPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ImplantPlanningForm>(() => buildDefaultForm());
  const [defaultExchangeRate, setDefaultExchangeRate] = useState(DEFAULT_AFN_PER_USD);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(null);
  const [selectedTeethByPatient, setSelectedTeethByPatient] = useState<Record<string, string[]>>({});
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchDebounced, setPatientSearchDebounced] = useState('');
  const patientTasksQueryKey = useMemo(() => ['patient-session-tasks', form.patientId], [form.patientId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPatientSearchDebounced(patientSearch.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [patientSearch]);

  useEffect(() => {
    const client = new AxiosClient();

    void getExchangeRate(client)
      .then((rate) => {
        setDefaultExchangeRate(rate);
        setForm((prev) => (
          prev.currency === 'USD' && (parseMoney(prev.exchangeRate) <= 0 || prev.exchangeRate === '1')
            ? { ...prev, exchangeRate: String(rate) }
            : prev
        ));
      })
      .catch(() => {
        setDefaultExchangeRate(DEFAULT_AFN_PER_USD);
      });
  }, []);

  const {
    data: patientPages,
    fetchNextPage,
    hasNextPage,
    isFetching: isLoadingPatients,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryFn: async ({ pageParam = 1 }) => {
      const patientRepository = new PatientRepository();
      const listPatientsUseCase = new ListPatientsUseCase(patientRepository);
      const response = await listPatientsUseCase.execute(
        patientSearchDebounced,
        ['patientCode', 'firstName', 'lastName', 'contactNumber'],
        [],
        {},
        pageParam,
        50
      );
      if (response.error || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch patients');
      }
      return response.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.meta.currentPage < lastPage.meta.lastPage ? lastPage.meta.currentPage + 1 : undefined,
    queryKey: ['implant-patient-options', patientSearchDebounced],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    initialPageParam: 1,
  });
  const { data: allStaff = [], isFetching: isLoadingStaff } = useQuery<Staff[]>({
    queryFn: async () => {
      const staffRepository = new StaffRepository();
      const listStaffUseCase = new ListStaffUseCase(staffRepository);
      const all: Staff[] = [];
      let currentPage = 1;
      let lastPage = 1;

      do {
        const response = await listStaffUseCase.execute('', [], [], {}, currentPage, 100);
        if (response.error || !response.data) {
          throw new Error(response.error?.message || 'Failed to fetch staff');
        }

        all.push(...response.data.data);
        lastPage = response.data.meta?.lastPage ?? currentPage;
        currentPage += 1;
      } while (currentPage <= lastPage);

      return all;
    },
    queryKey: ['implant-staff-options'],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
  const { data: allTreatments = [], isFetching: isLoadingTreatments } = useQuery<Treatment[]>({
    queryFn: async () => {
      const treatmentRepository = new TreatmentRepository();
      const listTreatmentsUseCase = new ListTreatmentsUseCase(treatmentRepository);
      const all: Treatment[] = [];
      let currentPage = 1;
      let lastPage = 1;

      do {
        const response = await listTreatmentsUseCase.execute('', [], [], {}, currentPage, 100);
        if (response.error || !response.data) {
          throw new Error(response.error?.message || 'Failed to fetch treatments');
        }

        all.push(...response.data.data);
        lastPage = response.data.meta?.lastPage ?? currentPage;
        currentPage += 1;
      } while (currentPage <= lastPage);

      return all;
    },
    queryKey: ['implant-treatment-options'],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
  const { data: implantCompanies = [], isFetching: isLoadingImplantCompanies } = useQuery<ImplantCompanyRecord[]>({
    queryFn: async () => {
      const client = new AxiosClient();
      const response = await client.get<ImplantCompanyRecord[]>(
        '/api/v1/dental-management/implant-companies'
      );

      if (!response.success || !response.data) {
        return [];
      }

      return response.data;
    },
    queryKey: ['implant-company-options'],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
  const { data: patientVisits = [], isFetching: isLoadingPatientVisits } = useQuery<Visit[]>({
    enabled: Boolean(form.patientId),
    queryFn: async () => {
      if (!form.patientId) {
        return [];
      }

      const visitRepository = new VisitRepository();
      const listVisitsUseCase = new ListVisitsUseCase(visitRepository);
      const all: Visit[] = [];
      let currentPage = 1;
      let lastPage = 1;

      do {
        const response = await listVisitsUseCase.execute(
          '',
          [],
          ['dentist'],
          { patientId: [form.patientId] },
          currentPage,
          100
        );
        if (response.error || !response.data) {
          throw new Error(response.error?.message || 'Failed to fetch visits');
        }

        all.push(...response.data.data);
        lastPage = response.data.meta?.lastPage ?? currentPage;
        currentPage += 1;
      } while (currentPage <= lastPage);

      return all;
    },
    queryKey: ['implant-patient-visits', form.patientId],
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });
  const { data: implantTeethFromChart = [], isFetching: isLoadingImplantTeeth } = useQuery<string[]>({
    enabled: Boolean(form.patientId),
    queryFn: async () => {
      if (!form.patientId) {
        return [];
      }

      try {
        const visitRepository = new VisitRepository();
        const listVisitsUseCase = new ListVisitsUseCase(visitRepository);
        const allVisits: Visit[] = [];
        let visitPage = 1;
        let lastVisitPage = 1;

        do {
          const visitResponse = await listVisitsUseCase.execute(
            '',
            [],
            [],
            { patientId: [form.patientId] },
            visitPage,
            100
          );
          if (visitResponse.error || !visitResponse.data) {
            return [];
          }

          allVisits.push(...visitResponse.data.data);
          lastVisitPage = visitResponse.data.meta?.lastPage ?? visitPage;
          visitPage += 1;
        } while (visitPage <= lastVisitPage);

        if (allVisits.length === 0) {
          return [];
        }

        const resolveVisitTimestamp = (visit: Visit): number => {
          const visitDateTimestamp = Date.parse(visit.visitDate ?? '');
          if (!Number.isNaN(visitDateTimestamp)) {
            return visitDateTimestamp;
          }

          const createdAtTimestamp = Date.parse(visit.createdAt ?? '');
          if (!Number.isNaN(createdAtTimestamp)) {
            return createdAtTimestamp;
          }

          return 0;
        };

        const latestVisit = allVisits.reduce((current, visit) => {
          return resolveVisitTimestamp(visit) > resolveVisitTimestamp(current) ? visit : current;
        });
        const latestVisitId = String(latestVisit.id);
        const visitTreatmentRepository = new VisitTreatmentRepository();
        const listVisitTreatmentsUseCase = new ListVisitTreatmentsUseCase(visitTreatmentRepository);
        const allVisitTreatments: VisitTreatment[] = [];
        let visitTreatmentPage = 1;
        let lastVisitTreatmentPage = 1;

        do {
          const visitTreatmentResponse = await listVisitTreatmentsUseCase.execute(
            '',
            [],
            [],
            { visitId: [latestVisitId] },
            visitTreatmentPage,
            100
          );

          if (visitTreatmentResponse.error || !visitTreatmentResponse.data) {
            break;
          }

          allVisitTreatments.push(...visitTreatmentResponse.data.data);
          lastVisitTreatmentPage = visitTreatmentResponse.data.meta?.lastPage ?? visitTreatmentPage;
          visitTreatmentPage += 1;
        } while (visitTreatmentPage <= lastVisitTreatmentPage);

        return extractImplantTeeth(allVisitTreatments);
      } catch {
        return [];
      }
    },
    queryKey: ['implant-teeth-from-chart', form.patientId],
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });

  const setField = <K extends keyof ImplantPlanningForm>(key: K, value: ImplantPlanningForm[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleRiskFactor = (riskFactor: RiskFactorKey): void => {
    setForm((prev) => {
      const hasRiskFactor = prev.riskFactors.includes(riskFactor);
      const riskFactors = hasRiskFactor
        ? prev.riskFactors.filter((item) => item !== riskFactor)
        : [...prev.riskFactors, riskFactor];

      return { ...prev, riskFactors };
    });
  };

  const selectedImplantTeeth = useMemo(() => {
    if (!form.patientId) {
      return [];
    }

    const selectedTeeth = selectedTeethByPatient[form.patientId];
    const source = selectedTeeth ?? implantTeethFromChart;
    return source.filter((toothNumber) => implantTeethFromChart.includes(toothNumber));
  }, [form.patientId, implantTeethFromChart, selectedTeethByPatient]);
  const inferredImplantArch = useMemo<ImplantArch | null>(() => {
    let hasMandible = false;
    let hasMaxilla = false;

    selectedImplantTeeth.forEach((toothNumber) => {
      const arch = resolveArchFromToothNumber(toothNumber);
      if (arch === 'maxilla') {
        hasMaxilla = true;
      } else if (arch === 'mandible') {
        hasMandible = true;
      }
    });

    if (hasMaxilla && hasMandible) {
      return 'both';
    }
    if (hasMaxilla) {
      return 'maxilla';
    }
    if (hasMandible) {
      return 'mandible';
    }

    return null;
  }, [selectedImplantTeeth]);

  const toggleImplantTooth = (toothNumber: string): void => {
    if (!form.patientId) {
      return;
    }

    setSelectedTeethByPatient((prev) => {
      const current = prev[form.patientId] ?? implantTeethFromChart;
      const next = current.includes(toothNumber)
        ? current.filter((value) => value !== toothNumber)
        : [...current, toothNumber].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

      return {
        ...prev,
        [form.patientId]: next,
      };
    });
  };

  const setAllImplantTeeth = (): void => {
    if (!form.patientId) {
      return;
    }

    setSelectedTeethByPatient((prev) => ({
      ...prev,
      [form.patientId]: [...implantTeethFromChart],
    }));
  };

  const clearImplantTeeth = (): void => {
    if (!form.patientId) {
      return;
    }

    setSelectedTeethByPatient((prev) => ({
      ...prev,
      [form.patientId]: [],
    }));
  };

  const fetchCsrfClient = async (): Promise<AxiosClient> => {
    const client = new AxiosClient();
    await client.get('/sanctum/csrf-cookie');
    return client;
  };


  const checklist = useMemo<ChecklistItem[]>(() => {
    const hasSite = Boolean(form.patientId && selectedImplantTeeth.length > 0);
    const hasImaging = form.imagingType !== 'none';
    const hasBoneMeasurements = Boolean(toNumber(form.boneHeightMm) && toNumber(form.boneWidthMm));
    const hasImplantSpecs = Boolean(toNumber(form.implantDiameterMm) && toNumber(form.implantLengthMm));
    const hasLoadingPlan = Boolean(form.loadingProtocol.trim());
    const hasStabilityMetrics = Boolean(toNumber(form.insertionTorqueNcm) || toNumber(form.primaryStabilityIsq));

    return [
      { complete: hasSite, label: 'Patient and implant site identified' },
      { complete: hasImaging, label: 'Imaging modality documented' },
      { complete: hasBoneMeasurements, label: 'Bone dimensions documented' },
      { complete: hasImplantSpecs, label: 'Implant dimensions selected' },
      { complete: hasLoadingPlan, label: 'Loading protocol selected' },
      { complete: hasStabilityMetrics, label: 'Primary stability metric recorded' },
    ];
  }, [
    form.boneHeightMm,
    form.boneWidthMm,
    form.implantDiameterMm,
    form.implantLengthMm,
    form.imagingType,
    form.insertionTorqueNcm,
    form.loadingProtocol,
    form.patientId,
    form.primaryStabilityIsq,
    selectedImplantTeeth.length,
  ]);

  const resolvedExchangeRate = form.currency === 'USD'
    ? Math.max(parseMoney(form.exchangeRate) || defaultExchangeRate, DEFAULT_AFN_PER_USD)
    : 1;
  const implantPricePerToothInput = Math.max(0, toNumber(form.implantPricePerTooth) ?? 0);
  const totalSelectedImplantsPaymentInput = implantPricePerToothInput * selectedImplantTeeth.length;
  const invoiceNetAmount = convertInputToUsd(totalSelectedImplantsPaymentInput, form.currency, resolvedExchangeRate);
  const requestedPaidNowAmountInput = Math.max(0, toNumber(form.paidNowAmount) ?? 0);
  const paidNowAmountInput = Math.min(totalSelectedImplantsPaymentInput, requestedPaidNowAmountInput);
  const paidNowAmount = convertInputToUsd(paidNowAmountInput, form.currency, resolvedExchangeRate);
  const remainingDebtAmountInput = Math.max(0, totalSelectedImplantsPaymentInput - paidNowAmountInput);
  const remainingDebtAmount = Math.max(0, invoiceNetAmount - paidNowAmount);
  const effectiveInvoiceStatus = remainingDebtAmount <= 0 ? 'paid' : paidNowAmount > 0 ? 'partially_paid' : 'unpaid';
  const supplierCostPerToothInput = Math.max(0, toNumber(form.supplierCostPerTooth) ?? 0);
  const totalSupplierCostInput = supplierCostPerToothInput * selectedImplantTeeth.length;
  const totalSupplierCost = convertInputToUsd(totalSupplierCostInput, form.currency, resolvedExchangeRate);
  const supplierRemainingAmount = totalSupplierCost;
  const supplierRemainingAmountInput = totalSupplierCostInput;

  const formatSelectedAmount = (amountInput: number): string => {
    const amountAfn = convertInputToUsd(amountInput, form.currency, resolvedExchangeRate);

    if (form.currency === 'USD') {
      return `${formatCurrency(amountInput, 'USD')} (${formatCurrency(amountAfn, 'AFN')})`;
    }

    return formatCurrency(amountInput, 'AFN');
  };

  const formatSavedAmount = (
    amountAfn: number,
    amountInput: number,
    currency: CurrencyCode,
    exchangeRate: number
  ): string => {
    if (currency === 'USD') {
      const resolvedInput = amountInput > 0 ? amountInput : convertUsdToInput(amountAfn, currency, exchangeRate);
      return `${formatCurrency(resolvedInput, 'USD')} (${formatCurrency(amountAfn, 'AFN')})`;
    }

    return formatCurrency(amountInput > 0 ? amountInput : amountAfn, 'AFN');
  };

  const allPatients = useMemo(
    () => (patientPages?.pages ?? []).flatMap((page) => page.data),
    [patientPages]
  );

  const selectedPatient = useMemo(
    () => allPatients.find((patient) => String(patient.id) === form.patientId),
    [allPatients, form.patientId]
  );
  const selectedLinkedVisit = useMemo(
    () => patientVisits.find((visit) => String(visit.id) === form.linkedVisitId),
    [form.linkedVisitId, patientVisits]
  );

  const patientOptions = useMemo(() => {
    const uniquePatients = new Map<string, Patient>();
    allPatients.forEach((patient) => {
      uniquePatients.set(String(patient.id), patient);
    });

    return Array.from(uniquePatients.values())
      .map((patient) => ({
        id: String(patient.id),
        label: `${patient.firstName} ${patient.lastName} (${patient.patientCode})`.trim(),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
  }, [allPatients]);
  const implantCompanyOptions = useMemo(
    () => implantCompanies
      .map((company) => ({
        id: String(company.id),
        label: `${company.companyName} — ${company.implantType}${company.recordDate ? ` (${company.recordDate})` : ''}`,
        record: company,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })),
    [implantCompanies]
  );
  const dentistOptions = useMemo(
    () => allStaff
      .map((staff) => ({
        id: String(staff.id),
        label: `${staff.fullName} (${staff.role})`,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })),
    [allStaff]
  );
  const treatmentOptions = useMemo(
    () => allTreatments
      .map((treatment) => ({
        id: String(treatment.id),
        label: treatment.name,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })),
    [allTreatments]
  );
  const visitOptions = useMemo(
    () => patientVisits
      .map((visit) => {
        const tag = asText(visit.tag) || `Visit #${visit.id}`;
        const visitDate = asText(visit.visitDate);
        return {
          id: String(visit.id),
          label: `${tag} (${visitDate || 'no date'})`,
        };
      })
      .sort((left, right) => right.label.localeCompare(left.label, undefined, { sensitivity: 'base' })),
    [patientVisits]
  );

  useEffect(() => {
    if (form.treatmentId || treatmentOptions.length === 0) {
      return;
    }

    const preferred = treatmentOptions.find((option) => option.label.toLowerCase().includes('implant'));
    setForm((prev) => ({ ...prev, treatmentId: preferred?.id ?? treatmentOptions[0].id }));
  }, [form.treatmentId, treatmentOptions]);

  useEffect(() => {
    if (!inferredImplantArch || form.implantArch === inferredImplantArch) {
      return;
    }

    setField('implantArch', inferredImplantArch);
  }, [form.implantArch, inferredImplantArch]);

  useEffect(() => {
    if (!selectedLinkedVisit || form.dentistId) {
      return;
    }

    const dentistId = asText(selectedLinkedVisit.dentistId);
    if (!dentistId) {
      return;
    }

    setForm((prev) => ({ ...prev, dentistId }));
  }, [form.dentistId, selectedLinkedVisit]);

  const warnings = useMemo<string[]>(() => {
    const values: string[] = [];
    const torque = toNumber(form.insertionTorqueNcm);
    const isq = toNumber(form.primaryStabilityIsq);
    const boneWidth = toNumber(form.boneWidthMm);
    const implantDiameter = toNumber(form.implantDiameterMm);

    if (form.imagingType !== 'cbct') {
      values.push('CBCT is recommended before implant placement for 3D site assessment.');
    }

    if (form.loadingProtocol === 'immediate' && ((torque !== null && torque < 30) || (isq !== null && isq < 65))) {
      values.push('Immediate loading selected with low stability markers (torque < 30 Ncm or ISQ < 65).');
    }

    if (boneWidth !== null && implantDiameter !== null && boneWidth < implantDiameter + 2) {
      values.push('Bone width appears limited for selected implant diameter. Recheck plan or grafting need.');
    }

    if (form.riskFactors.length >= 3) {
      values.push('Multiple systemic/local risk factors detected. Consider staged protocol and tighter maintenance.');
    }

    return values;
  }, [
    form.boneWidthMm,
    form.implantDiameterMm,
    form.imagingType,
    form.insertionTorqueNcm,
    form.loadingProtocol,
    form.primaryStabilityIsq,
    form.riskFactors.length,
  ]);

  const riskScore = useMemo(() => {
    let score = form.riskFactors.length;

    const torque = toNumber(form.insertionTorqueNcm);
    const isq = toNumber(form.primaryStabilityIsq);
    const boneHeight = toNumber(form.boneHeightMm);
    const boneWidth = toNumber(form.boneWidthMm);

    if (form.imagingType === 'none') score += 2;
    if (boneHeight !== null && boneHeight < 8) score += 2;
    if (boneWidth !== null && boneWidth < 6) score += 1;
    if (form.loadingProtocol === 'immediate' && torque !== null && torque < 30) score += 2;
    if (form.loadingProtocol === 'immediate' && isq !== null && isq < 65) score += 2;

    return score;
  }, [
    form.boneHeightMm,
    form.boneWidthMm,
    form.imagingType,
    form.insertionTorqueNcm,
    form.loadingProtocol,
    form.primaryStabilityIsq,
    form.riskFactors.length,
  ]);

  const riskLevel = getRiskLevel(riskScore);
  const completedCount = checklist.filter((item) => item.complete).length;

  const handleSaveToRecords = async (): Promise<void> => {
    if (!form.patientId) {
      toast.error('Select a patient first.');
      return;
    }

    if (!form.treatmentId) {
      toast.error('Select an implant treatment type first.');
      return;
    }

    if (selectedImplantTeeth.length === 0) {
      toast.error('Select at least one implant tooth.');
      return;
    }

    if (implantPricePerToothInput <= 0) {
      toast.error('Implant price per tooth must be greater than zero.');
      return;
    }

    if (!form.linkedVisitId && !form.dentistId) {
      toast.error('Select a dentist or choose an existing visit.');
      return;
    }

    if (requestedPaidNowAmountInput > totalSelectedImplantsPaymentInput) {
      toast.error('Paid amount cannot exceed net invoice amount.');
      return;
    }

    setIsSavingPlan(true);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const recordDate = form.visitDate || today;
      const planningClient = await fetchCsrfClient();
      const planningResponse = await planningClient.post<SaveSummary>(
        '/api/v1/dental-management/implant-planning',
        {
          currency: form.currency,
          dentistId: form.dentistId ? Number(form.dentistId) : undefined,
          exchangeRate: resolvedExchangeRate,
          implantArch: form.implantArch,
          implantCompanyDate: form.implantCompanyDate || recordDate,
          implantCompanyId: form.implantCompanyId ? Number(form.implantCompanyId) : undefined,
          implantCompanyName: form.implantCompanyName.trim() || undefined,
          implantCompanyNote: form.implantCompanyNote.trim() || undefined,
          implantCompanyType: form.implantCompanyType.trim() || undefined,
          implantDiameterMm: form.implantDiameterMm,
          implantLengthMm: form.implantLengthMm,
          implantPricePerTooth: implantPricePerToothInput,
          implantSystem: form.implantSystem.trim() || undefined,
          implantTeeth: selectedImplantTeeth,
          linkedVisitId: form.linkedVisitId ? Number(form.linkedVisitId) : undefined,
          loadingProtocol: form.loadingProtocol,
          notes: form.notes.trim() || undefined,
          paidNowAmount: paidNowAmountInput,
          patientId: Number(form.patientId),
          paymentMethod: form.paymentMethod,
          supplierCostPerTooth: supplierCostPerToothInput,
          treatmentId: Number(form.treatmentId),
          visitDate: recordDate,
        }
      );

      if (!planningResponse.success || !planningResponse.data) {
        toast.error(planningResponse.error?.message || 'Failed to save implant planning data.');
        return;
      }

      setSaveSummary(planningResponse.data);
      await queryClient.invalidateQueries({ queryKey: patientTasksQueryKey });
      await queryClient.invalidateQueries({ queryKey: ['implant-company-options'] });
      await queryClient.invalidateQueries({ queryKey: ['implant-patient-visits', form.patientId] });
      toast.success('Implant planning data saved to patient records and billing.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'implants', isCurrent: true, label: tSidebar('implants') },
        ]}
      />

      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-6">
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-primary" />
                Implant Planning Sheet
              </CardTitle>
              <CardDescription>
                Standardized fields based on common implant planning guidance (risk assessment, imaging,
                stability, and loading protocol).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Patient and Site</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Input
                      placeholder="Search patient (name, code, phone)"
                      value={patientSearch}
                      onChange={(event) => setPatientSearch(event.target.value)}
                    />
                    <Select
                      value={form.patientId || undefined}
                      onValueChange={(value) => {
                        setForm((prev) => ({
                          ...prev,
                          linkedVisitId: '',
                          patientId: value,
                        }));
                      }}
                      disabled={isLoadingPatients || patientOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={isLoadingPatients ? 'Loading patients...' : 'Select patient'}
                        />
                      </SelectTrigger>
                      <SelectContent
                        onScroll={(event) => {
                          const target = event.currentTarget;
                          const isNearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
                          if (isNearBottom && hasNextPage && !isFetchingNextPage) {
                            void fetchNextPage();
                          }
                        }}
                      >
                        {patientOptions.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.label}
                          </SelectItem>
                        ))}
                        {hasNextPage ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground space-y-2">
                            <p>{isFetchingNextPage ? 'Loading more patients...' : 'Scroll to load more patients.'}</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isFetchingNextPage}
                              onClick={() => {
                                void fetchNextPage();
                              }}
                            >
                              {isFetchingNextPage ? (
                                <Loader2 className="me-2 size-4 animate-spin" />
                              ) : null}
                              Load more
                            </Button>
                          </div>
                        ) : null}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Type to search by name, code, or phone. Scroll to load more.
                    </p>
                  </div>
                  <Input
                    placeholder="Patient ID / File Number"
                    value={selectedPatient?.patientCode ?? ''}
                    readOnly
                  />
                  <Select
                    value={form.linkedVisitId || undefined}
                    onValueChange={(value) => {
                      setField('linkedVisitId', value);
                    }}
                    disabled={!form.patientId || isLoadingPatientVisits}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingPatientVisits ? 'Loading visits...' : 'Use existing visit (optional)'} />
                    </SelectTrigger>
                    <SelectContent>
                      {visitOptions.map((visit) => (
                        <SelectItem key={visit.id} value={visit.id}>
                          {visit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={form.visitDate}
                    onChange={(event) => {
                      setField('visitDate', event.target.value);
                    }}
                  />
                  <Select
                    value={form.dentistId || undefined}
                    onValueChange={(value) => {
                      setField('dentistId', value);
                    }}
                    disabled={isLoadingStaff || dentistOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingStaff ? 'Loading dentists...' : 'Select dentist'} />
                    </SelectTrigger>
                    <SelectContent>
                      {dentistOptions.map((dentist) => (
                        <SelectItem key={dentist.id} value={dentist.id}>
                          {dentist.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={form.treatmentId || undefined}
                    onValueChange={(value) => {
                      setField('treatmentId', value);
                    }}
                    disabled={isLoadingTreatments || treatmentOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingTreatments ? 'Loading treatments...' : 'Select implant treatment'} />
                    </SelectTrigger>
                    <SelectContent>
                      {treatmentOptions.map((treatment) => (
                        <SelectItem key={treatment.id} value={treatment.id}>
                          {treatment.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Implant teeth from chart"
                    value={implantTeethFromChart.join(', ')}
                    readOnly
                  />
                  {form.patientId && !isLoadingImplantTeeth && implantTeethFromChart.length === 0 ? (
                    <p className="text-xs text-muted-foreground md:col-span-3">
                      No implant tooth data found in the treatment chart for this patient.
                    </p>
                  ) : null}
                  <select
                    value={form.implantArch}
                    onChange={(event) => {
                      setField('implantArch', event.target.value as ImplantArch);
                    }}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="maxilla">Maxilla</option>
                    <option value="mandible">Mandible</option>
                    <option value="both">Both</option>
                  </select>
                  <select
                    value={form.imagingType}
                    onChange={(event) => {
                      setField('imagingType', event.target.value as ImagingType);
                    }}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="cbct">CBCT</option>
                    <option value="panoramic">Panoramic</option>
                    <option value="none">No imaging</option>
                  </select>
                </div>
              </section>

              {implantTeethFromChart.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Implant Teeth Selection</h3>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={setAllImplantTeeth}>
                        Select all
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={clearImplantTeeth}>
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    {implantTeethFromChart.map((toothNumber) => (
                      <label
                        key={toothNumber}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={selectedImplantTeeth.includes(toothNumber)}
                          onChange={() => {
                            toggleImplantTooth(toothNumber);
                          }}
                        />
                        <span>Tooth {toothNumber}</span>
                      </label>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Patient Payment</h3>
                <div className="grid gap-3 md:grid-cols-4">
                  <select
                    value={form.currency}
                    onChange={(event) => {
                      const nextCurrency = event.target.value as CurrencyCode;
                      const nextExchangeRate = nextCurrency === 'USD' ? defaultExchangeRate : 1;
                      const convertValue = (value: string): string => {
                        const amountInput = Math.max(0, toNumber(value) ?? 0);
                        if (amountInput <= 0) {
                          return value.trim() === '' ? '' : '0';
                        }

                        const amountAfn = convertInputToUsd(amountInput, form.currency, resolvedExchangeRate);
                        const nextAmount = convertUsdToInput(amountAfn, nextCurrency, nextExchangeRate);
                        return nextAmount.toFixed(2);
                      };

                      setForm((prev) => ({
                        ...prev,
                        currency: nextCurrency,
                        exchangeRate: String(nextExchangeRate),
                        implantPricePerTooth: convertValue(prev.implantPricePerTooth),
                        paidNowAmount: convertValue(prev.paidNowAmount),
                        supplierCostPerTooth: convertValue(prev.supplierCostPerTooth),
                      }));
                    }}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="AFN">AFN</option>
                    <option value="USD">USD</option>
                  </select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="AFN per 1 USD"
                    value={form.exchangeRate}
                    onChange={(event) => {
                      setField('exchangeRate', event.target.value);
                    }}
                    disabled={form.currency === 'AFN'}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Patient price per implant"
                    value={form.implantPricePerTooth}
                    onChange={(event) => {
                      setField('implantPricePerTooth', event.target.value);
                    }}
                  />
                  <Input
                    placeholder="Selected implant teeth"
                    value={selectedImplantTeeth.join(', ')}
                    readOnly
                  />
                  <Input
                    placeholder="Total invoice amount"
                    value={formatSelectedAmount(totalSelectedImplantsPaymentInput)}
                    readOnly
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Patient paid now"
                    value={form.paidNowAmount}
                    onChange={(event) => {
                      setField('paidNowAmount', event.target.value);
                    }}
                  />
                  <select
                    value={form.paymentMethod}
                    onChange={(event) => {
                      setField('paymentMethod', event.target.value as ImplantPlanningForm['paymentMethod']);
                    }}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="insurance">Insurance</option>
                  </select>
                  <Input
                    placeholder="Patient remaining debt"
                    value={formatSelectedAmount(remainingDebtAmountInput)}
                    readOnly
                  />
                  <Input
                    placeholder="Invoice status"
                    value={effectiveInvoiceStatus}
                    readOnly
                  />
                </div>
                <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                  Reports stay in AFN. This plan will be recorded as{' '}
                  <span className="font-semibold text-foreground">{formatCurrency(invoiceNetAmount, 'AFN')}</span>
                  {form.currency === 'USD' ? ` at ${resolvedExchangeRate} AFN per 1 USD.` : '.'}
                </div>
                <p className="text-xs text-muted-foreground">
                  When saved, patient paid amount is recorded as payment and moves into safe automatically.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Third-Party Company Cost</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Company cost per implant"
                    value={form.supplierCostPerTooth}
                    onChange={(event) => {
                      setField('supplierCostPerTooth', event.target.value);
                    }}
                  />
                  <Input
                    placeholder="Total company cost"
                    value={formatSelectedAmount(totalSupplierCostInput)}
                    readOnly
                  />
                  <Input
                    placeholder="Company remaining payable"
                    value={formatSelectedAmount(supplierRemainingAmountInput)}
                    readOnly
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    value={form.implantCompanyId || undefined}
                    onValueChange={(value) => {
                      const selected = implantCompanyOptions.find((option) => option.id === value);
                      if (!selected) {
                        setForm((prev) => ({
                          ...prev,
                          implantCompanyId: value,
                        }));
                        return;
                      }

                      setForm((prev) => ({
                        ...prev,
                        implantCompanyDate: selected.record.recordDate || prev.implantCompanyDate,
                        implantCompanyId: value,
                        implantCompanyName: selected.record.companyName,
                        implantCompanyNote: selected.record.note ?? '',
                        implantCompanyType: selected.record.implantType,
                      }));
                    }}
                    disabled={isLoadingImplantCompanies || implantCompanyOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={isLoadingImplantCompanies ? 'Loading companies...' : 'Select saved company (optional)'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {implantCompanyOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Company name"
                    value={form.implantCompanyName}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((prev) => ({
                        ...prev,
                        implantCompanyId: prev.implantCompanyId && prev.implantCompanyName !== value ? '' : prev.implantCompanyId,
                        implantCompanyName: value,
                      }));
                    }}
                  />
                  <Input
                    placeholder="Implant type"
                    value={form.implantCompanyType}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((prev) => ({
                        ...prev,
                        implantCompanyId: prev.implantCompanyId && prev.implantCompanyType !== value ? '' : prev.implantCompanyId,
                        implantCompanyType: value,
                      }));
                    }}
                  />
                  <Input
                    type="date"
                    value={form.implantCompanyDate}
                    onChange={(event) => {
                      setField('implantCompanyDate', event.target.value);
                    }}
                  />
                  <Input
                    className="md:col-span-2"
                    placeholder="Company note"
                    value={form.implantCompanyNote}
                    onChange={(event) => {
                      setField('implantCompanyNote', event.target.value);
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Company payment is handled in the implants in-process page when status changes to in purchase.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Diagnostics and Measurements</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Bone Height (mm)"
                    value={form.boneHeightMm}
                    onChange={(event) => {
                      setField('boneHeightMm', event.target.value);
                    }}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Bone Width (mm)"
                    value={form.boneWidthMm}
                    onChange={(event) => {
                      setField('boneWidthMm', event.target.value);
                    }}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Keratinized Tissue (mm)"
                    value={form.keratinizedTissueMm}
                    onChange={(event) => {
                      setField('keratinizedTissueMm', event.target.value);
                    }}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Implant and Prosthetic Plan</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Implant System / Brand"
                    value={form.implantSystem}
                    onChange={(event) => {
                      setField('implantSystem', event.target.value);
                    }}
                  />
                  <Input
                    placeholder="Prosthesis Type (single crown, bridge...)"
                    value={form.prosthesisType}
                    onChange={(event) => {
                      setField('prosthesisType', event.target.value);
                    }}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Diameter (mm)"
                    value={form.implantDiameterMm}
                    onChange={(event) => {
                      setField('implantDiameterMm', event.target.value);
                    }}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Length (mm)"
                    value={form.implantLengthMm}
                    onChange={(event) => {
                      setField('implantLengthMm', event.target.value);
                    }}
                  />
                  <select
                    value={form.surgeryGuideType}
                    onChange={(event) => {
                      setField('surgeryGuideType', event.target.value as ImplantPlanningForm['surgeryGuideType']);
                    }}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="freehand">Freehand</option>
                    <option value="pilot">Pilot guided</option>
                    <option value="fully-guided">Fully guided</option>
                  </select>
                  <select
                    value={form.loadingProtocol}
                    onChange={(event) => {
                      setField('loadingProtocol', event.target.value as LoadingProtocol);
                    }}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="delayed">Delayed loading</option>
                    <option value="early">Early loading</option>
                    <option value="immediate">Immediate loading</option>
                  </select>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Primary Stability</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="Insertion Torque (Ncm)"
                    value={form.insertionTorqueNcm}
                    onChange={(event) => {
                      setField('insertionTorqueNcm', event.target.value);
                    }}
                  />
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="ISQ"
                    value={form.primaryStabilityIsq}
                    onChange={(event) => {
                      setField('primaryStabilityIsq', event.target.value);
                    }}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Risk Factors</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(RISK_FACTOR_LABELS).map(([key, label]) => {
                    const riskFactor = key as RiskFactorKey;
                    const checked = form.riskFactors.includes(riskFactor);

                    return (
                      <label
                        key={riskFactor}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={checked}
                          onChange={() => {
                            toggleRiskFactor(riskFactor);
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Clinical Notes</h3>
                <textarea
                  value={form.notes}
                  onChange={(event) => {
                    setField('notes', event.target.value);
                  }}
                  placeholder="Include grafting plan, occlusion notes, consent points, and maintenance interval..."
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </section>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={isSavingPlan}
                  onClick={() => {
                    void handleSaveToRecords();
                  }}
                >
                  {isSavingPlan ? <Loader2 className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}
                  Save to records
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSavingPlan}
                  onClick={() => {
                    setForm(buildDefaultForm());
                  }}
                >
                  <RefreshCcw className="me-2 size-4" />
                  Reset
                </Button>
                <Button
                  type="button"
                  disabled={isSavingPlan}
                  onClick={() => {
                    window.print();
                  }}
                >
                  <Printer className="me-2 size-4" />
                  Print
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Implant Case Readiness</CardTitle>
                <CardDescription>
                  Completion progress for the minimum implant documentation set.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-sm font-medium">Checklist Completion</span>
                  <Badge variant="secondary">
                    {completedCount}/{checklist.length}
                  </Badge>
                </div>
                {checklist.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <span className="text-sm">{item.label}</span>
                    <Badge variant={item.complete ? 'default' : 'outline'}>
                      {item.complete ? 'Done' : 'Missing'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {saveSummary ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Latest Save Summary</CardTitle>
                  <CardDescription>
                    Persisted to patient clinical and billing records.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    Saved at: <span className="font-medium">{new Date(saveSummary.savedAt).toLocaleString()}</span>
                  </p>
                  <p>
                    Visit #{saveSummary.visitId}{' '}
                    <span className="text-muted-foreground">
                      ({saveSummary.createdVisit ? 'newly created' : 'existing'})
                    </span>
                  </p>
                  <p>Visit treatments saved: {saveSummary.treatmentCount}</p>
                  <p>Invoice #{saveSummary.invoiceId}</p>
                  <p>
                    Paid now:{' '}
                    {formatSavedAmount(
                      saveSummary.paidNowAmount,
                      saveSummary.paidNowAmountInput,
                      saveSummary.currency,
                      saveSummary.exchangeRate
                    )}
                  </p>
                  <p>
                    Remaining debt:{' '}
                    {formatSavedAmount(
                      saveSummary.remainingDebt,
                      saveSummary.remainingDebtInput,
                      saveSummary.currency,
                      saveSummary.exchangeRate
                    )}
                  </p>
                  {saveSummary.paymentId ? <p>Payment #{saveSummary.paymentId}</p> : null}
                  <p>
                    Third-company total:{' '}
                    {formatSavedAmount(
                      saveSummary.supplierTotalCost,
                      saveSummary.supplierTotalCostInput,
                      saveSummary.currency,
                      saveSummary.exchangeRate
                    )}
                  </p>
                  <p>
                    Third-company unpaid:{' '}
                    {formatSavedAmount(
                      saveSummary.supplierRemainingAmount,
                      saveSummary.supplierRemainingAmountInput,
                      saveSummary.currency,
                      saveSummary.exchangeRate
                    )}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="size-4 text-amber-500" />
                  Risk Review
                </CardTitle>
                <CardDescription>
                  Quick warning checks for immediate loading and documentation gaps.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-sm font-medium">Risk Level</span>
                  <Badge variant={riskLevel.tone}>{riskLevel.label}</Badge>
                </div>
                <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                  Calculated score: <span className="font-semibold text-foreground">{riskScore}</span>
                </div>
                {warnings.length > 0 ? (
                  <ul className="space-y-2">
                    {warnings.map((warning) => (
                      <li
                        key={warning}
                        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    No major warning flags from quick checks.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
