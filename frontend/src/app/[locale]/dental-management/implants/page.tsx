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
import { CreateInvoiceUseCase } from '@/modules/dental-management/application/use-cases/invoices/create-invoice-use-case';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { CreatePaymentUseCase } from '@/modules/dental-management/application/use-cases/payments/create-payment-use-case';
import { ListStaffUseCase } from '@/modules/dental-management/application/use-cases/staff/list-staff-use-case';
import { ListTreatmentsUseCase } from '@/modules/dental-management/application/use-cases/treatments/list-treatments-use-case';
import { CreateVisitTreatmentUseCase } from '@/modules/dental-management/application/use-cases/visit-treatments/create-visit-treatment-use-case';
import { ListVisitTreatmentsUseCase } from '@/modules/dental-management/application/use-cases/visit-treatments/list-visit-treatments-use-case';
import { CreateVisitUseCase } from '@/modules/dental-management/application/use-cases/visits/create-visit-use-case';
import { ListVisitsUseCase } from '@/modules/dental-management/application/use-cases/visits/list-visits-use-case';
import { type Invoice } from '@/modules/dental-management/domain/entities/Invoice';
import { type Payment } from '@/modules/dental-management/domain/entities/Payment';
import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { InvoiceRepository } from '@/modules/dental-management/infrastructure/repositories/invoice-repository';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import { PaymentRepository } from '@/modules/dental-management/infrastructure/repositories/payment-repository';
import { StaffRepository } from '@/modules/dental-management/infrastructure/repositories/staff-repository';
import { TreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/treatment-repository';
import { VisitTreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/visit-treatment-repository';
import { VisitRepository } from '@/modules/dental-management/infrastructure/repositories/visit-repository';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardCheck, Loader2, Printer, RefreshCcw, Save, ShieldAlert } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ListPatientsUseCase } from '@/modules/dental-management/application/use-cases/patients/list-patients-use-case';

type LoadingProtocol = 'delayed' | 'early' | 'immediate';
type ImplantArch = 'maxilla' | 'mandible';
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
  dentistId: string;
  imagingType: ImagingType;
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
  supplierPaidNowAmount: string;
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
  invoiceId: number;
  paidNowAmount: number;
  paymentId?: number;
  supplierPaidNowAmount: number;
  supplierSafeTransactionId?: number;
  remainingDebt: number;
  savedAt: string;
  treatmentCount: number;
  visitId: number;
};

type SessionTaskStatus = 'pending' | 'in_progress' | 'done';
type SessionTaskMark = 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'purple';
type ImplantAvailabilityStatus = 'not_available' | 'in_purchase' | 'available';
type SessionTask = {
  id: number;
  mark: SessionTaskMark;
  notes?: string;
  patientId: number;
  status: SessionTaskStatus;
  title: string;
};

const RISK_FACTOR_LABELS: Record<RiskFactorKey, string> = {
  bisphosphonateUse: 'Bisphosphonate/anti-resorptive history',
  bruxism: 'Bruxism or heavy occlusal load',
  periodontitisHistory: 'History of periodontitis',
  poorHygiene: 'Poor oral hygiene/plaque control',
  smoking: 'Smoker',
  uncontrolledDiabetes: 'Uncontrolled diabetes',
};

const IMPLANT_TASK_MARKER = 'implant_tooth';
const AVAILABILITY_TO_TASK_STATUS: Record<ImplantAvailabilityStatus, SessionTaskStatus> = {
  available: 'done',
  in_purchase: 'in_progress',
  not_available: 'pending',
};
const AVAILABILITY_TO_TASK_MARK: Record<ImplantAvailabilityStatus, SessionTaskMark> = {
  available: 'green',
  in_purchase: 'yellow',
  not_available: 'red',
};

const DEFAULT_FORM: ImplantPlanningForm = {
  boneHeightMm: '',
  boneWidthMm: '',
  dentistId: '',
  imagingType: 'cbct',
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
  supplierPaidNowAmount: '0',
  surgeryGuideType: 'pilot',
  treatmentId: '',
  visitDate: '',
};

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

const extractImplantToothFromTask = (task: Pick<SessionTask, 'notes' | 'title'>): string | null => {
  const notesMatch = task.notes?.match(/\[implant_tooth:([0-9]{2})\]/i);
  if (notesMatch?.[1]) {
    return notesMatch[1];
  }

  const titleMatch = task.title.match(/([0-9]{2})/);
  return titleMatch?.[1] ?? null;
};

const buildImplantTaskTitle = (toothNumber: string): string => `Implant Tooth ${toothNumber}`;
const buildImplantTaskNotes = (toothNumber: string): string => `[${IMPLANT_TASK_MARKER}:${toothNumber}]`;
const buildImplantTaskPayload = (
  toothNumber: string,
  availability: ImplantAvailabilityStatus
): Pick<SessionTask, 'mark' | 'notes' | 'status' | 'title'> => ({
  mark: AVAILABILITY_TO_TASK_MARK[availability],
  notes: buildImplantTaskNotes(toothNumber),
  status: AVAILABILITY_TO_TASK_STATUS[availability],
  title: buildImplantTaskTitle(toothNumber),
});

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    currency: 'AFN',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(value);
};

const isToothNumber = (value: string): boolean => /^[0-9]{2}$/.test(value);

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
  const [form, setForm] = useState<ImplantPlanningForm>(DEFAULT_FORM);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(null);
  const [selectedTeethByPatient, setSelectedTeethByPatient] = useState<Record<string, string[]>>({});
  const patientTasksQueryKey = useMemo(() => ['patient-session-tasks', form.patientId], [form.patientId]);
  const { data: allPatients = [], isFetching: isLoadingPatients } = useQuery<Patient[]>({
    queryFn: async () => {
      const patientRepository = new PatientRepository();
      const listPatientsUseCase = new ListPatientsUseCase(patientRepository);
      const all: Patient[] = [];
      let currentPage = 1;
      let lastPage = 1;

      do {
        const response = await listPatientsUseCase.execute('', [], [], {}, currentPage, 100);
        if (response.error || !response.data) {
          throw new Error(response.error?.message || 'Failed to fetch patients');
        }

        all.push(...response.data.data);
        lastPage = response.data.meta?.lastPage ?? currentPage;
        currentPage += 1;
      } while (currentPage <= lastPage);

      return all;
    },
    queryKey: ['implant-patient-options'],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
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
  const { data: patientSessionTasks = [] } = useQuery<SessionTask[]>({
    enabled: Boolean(form.patientId),
    queryFn: async () => {
      if (!form.patientId) {
        return [];
      }

      const client = new AxiosClient();
      const response = await client.get<SessionTask[]>(
        `/api/v1/dental-management/patients/${form.patientId}/session-tasks`
      );

      if (!response.success || !response.data) {
        return [];
      }

      return response.data;
    },
    queryKey: patientTasksQueryKey,
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
        const allVisitIds: string[] = [];
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

          visitResponse.data.data.forEach((visit) => {
            allVisitIds.push(String(visit.id));
          });
          lastVisitPage = visitResponse.data.meta?.lastPage ?? visitPage;
          visitPage += 1;
        } while (visitPage <= lastVisitPage);

        if (allVisitIds.length === 0) {
          return [];
        }

        const visitTreatmentRepository = new VisitTreatmentRepository();
        const listVisitTreatmentsUseCase = new ListVisitTreatmentsUseCase(visitTreatmentRepository);
        const allVisitTreatments: VisitTreatment[] = [];
        const chunkSize = 30;

        for (let index = 0; index < allVisitIds.length; index += chunkSize) {
          const visitIdChunk = allVisitIds.slice(index, index + chunkSize);
          let visitTreatmentPage = 1;
          let lastVisitTreatmentPage = 1;

          do {
            const visitTreatmentResponse = await listVisitTreatmentsUseCase.execute(
              '',
              [],
              [],
              { visitId: visitIdChunk },
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
        }

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

  const implantTasksByTooth = useMemo<Record<string, SessionTask>>(() => {
    const byTooth: Record<string, SessionTask> = {};
    patientSessionTasks.forEach((task) => {
      const toothNumber = extractImplantToothFromTask(task);
      if (!toothNumber) {
        return;
      }

      const notes = task.notes ?? '';
      if (!notes.includes(IMPLANT_TASK_MARKER) && !task.title.toLowerCase().includes('implant tooth')) {
        return;
      }

      byTooth[toothNumber] = task;
    });

    return byTooth;
  }, [patientSessionTasks]);

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

  const implantPricePerTooth = toNumber(form.implantPricePerTooth) ?? 0;
  const totalSelectedImplantsPayment = implantPricePerTooth * selectedImplantTeeth.length;
  const invoiceNetAmount = totalSelectedImplantsPayment;
  const requestedPaidNowAmount = Math.max(0, toNumber(form.paidNowAmount) ?? 0);
  const paidNowAmount = Math.min(invoiceNetAmount, requestedPaidNowAmount);
  const remainingDebtAmount = Math.max(0, invoiceNetAmount - paidNowAmount);
  const effectiveInvoiceStatus = remainingDebtAmount <= 0 ? 'paid' : paidNowAmount > 0 ? 'partially_paid' : 'unpaid';
  const supplierCostPerTooth = Math.max(0, toNumber(form.supplierCostPerTooth) ?? 0);
  const totalSupplierCost = supplierCostPerTooth * selectedImplantTeeth.length;
  const requestedSupplierPaidNowAmount = Math.max(0, toNumber(form.supplierPaidNowAmount) ?? 0);
  const supplierPaidNowAmount = Math.min(totalSupplierCost, requestedSupplierPaidNowAmount);
  const supplierRemainingAmount = Math.max(0, totalSupplierCost - supplierPaidNowAmount);

  const selectedPatient = useMemo(
    () => allPatients.find((patient) => String(patient.id) === form.patientId),
    [allPatients, form.patientId]
  );
  const selectedLinkedVisit = useMemo(
    () => patientVisits.find((visit) => String(visit.id) === form.linkedVisitId),
    [form.linkedVisitId, patientVisits]
  );

  const patientOptions = useMemo(
    () => allPatients
      .map((patient) => ({
        id: String(patient.id),
        label: `${patient.firstName} ${patient.lastName} (${patient.patientCode})`.trim(),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })),
    [allPatients]
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

    if (implantPricePerTooth <= 0) {
      toast.error('Implant price per tooth must be greater than zero.');
      return;
    }

    if (!form.linkedVisitId && !form.dentistId) {
      toast.error('Select a dentist or choose an existing visit.');
      return;
    }

    if (requestedPaidNowAmount > invoiceNetAmount) {
      toast.error('Paid amount cannot exceed net invoice amount.');
      return;
    }

    if (requestedSupplierPaidNowAmount > totalSupplierCost) {
      toast.error('Third-party paid amount cannot exceed total third-party cost.');
      return;
    }

    setIsSavingPlan(true);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const recordDate = form.visitDate || today;

      const visitRepository = new VisitRepository();
      const visitTreatmentRepository = new VisitTreatmentRepository();
      const invoiceRepository = new InvoiceRepository();
      const paymentRepository = new PaymentRepository();

      const createVisitUseCase = new CreateVisitUseCase(visitRepository);
      const createVisitTreatmentUseCase = new CreateVisitTreatmentUseCase(visitTreatmentRepository);
      const createInvoiceUseCase = new CreateInvoiceUseCase(invoiceRepository);
      const createPaymentUseCase = new CreatePaymentUseCase(paymentRepository);

      let visitId = Number(form.linkedVisitId);
      const hasExistingVisit = Number.isFinite(visitId) && visitId > 0;
      let dentistId = Number(form.dentistId);

      if (hasExistingVisit) {
        const linkedVisitDentist = Number(selectedLinkedVisit?.dentistId);
        if (Number.isFinite(linkedVisitDentist) && linkedVisitDentist > 0) {
          dentistId = linkedVisitDentist;
        }
      }

      if (!hasExistingVisit) {
        if (!Number.isFinite(dentistId) || dentistId <= 0) {
          toast.error('A valid dentist is required to create a new implant visit.');
          return;
        }

        const patientCodeTagPart = (selectedPatient?.patientCode ?? form.patientId).replace(/\s+/g, '-');
        const generatedTag = truncate(`implant-${patientCodeTagPart}-${recordDate.replace(/-/g, '')}`, 100);
        const diagnosisNotes = truncate(
          [form.notes.trim(), '[implant-planning-sheet]'].filter(Boolean).join(' | '),
          255
        );

        const visitResponse = await createVisitUseCase.execute({
          appointmentId: undefined,
          createdBy: undefined,
          deletedBy: undefined,
          dentistId: String(dentistId),
          diagnosisNotes: diagnosisNotes || undefined,
          invoices: undefined,
          nextVisitDate: undefined,
          patientId: form.patientId,
          tag: generatedTag,
          updatedBy: undefined,
          visitDate: recordDate,
          visitTreatments: undefined,
        });

        if (!visitResponse.success || !visitResponse.data) {
          toast.error(visitResponse.error?.message || 'Failed to create visit record.');
          return;
        }

        visitId = Number(visitResponse.data.id);
      }

      if (!Number.isFinite(visitId) || visitId <= 0) {
        toast.error('Unable to resolve visit for implant record.');
        return;
      }

      if (!Number.isFinite(dentistId) || dentistId <= 0) {
        toast.error('Unable to resolve dentist for implant record.');
        return;
      }

      const treatmentId = Number(form.treatmentId);
      if (!Number.isFinite(treatmentId) || treatmentId <= 0) {
        toast.error('Invalid treatment selected.');
        return;
      }

      for (const toothNumber of selectedImplantTeeth) {
        const noteParts = [
          '[condition:implant]',
          `[tooth:${toothNumber}]`,
          `[patientPrice:${implantPricePerTooth.toFixed(2)}]`,
          `[supplierCost:${supplierCostPerTooth.toFixed(2)}]`,
          `[diameter:${asText(form.implantDiameterMm) || '-'}]`,
          `[length:${asText(form.implantLengthMm) || '-'}]`,
          `[arch:${form.implantArch}]`,
          `[protocol:${form.loadingProtocol}]`,
          form.notes.trim(),
        ];
        const treatmentNote = truncate(noteParts.filter(Boolean).join(' '), 255);

        const visitTreatmentResponse = await createVisitTreatmentUseCase.execute({
          createdBy: undefined,
          deletedBy: undefined,
          dentistId: String(dentistId),
          material: truncate(form.implantSystem.trim(), 255) || undefined,
          notes: treatmentNote || undefined,
          price: implantPricePerTooth.toFixed(2),
          toothId: undefined,
          toothNumber,
          treatmentId: String(treatmentId),
          updatedBy: undefined,
          visitId: String(visitId),
        });

        if (!visitTreatmentResponse.success) {
          toast.error(visitTreatmentResponse.error?.message || `Failed to save implant tooth ${toothNumber}.`);
          return;
        }
      }

      const invoiceResponse = await createInvoiceUseCase.execute({
        createdBy: undefined,
        currency: 'AFN',
        deletedBy: undefined,
        discount: '0.00',
        exchangeRate: 1,
        invoiceDate: recordDate,
        netAmount: invoiceNetAmount.toFixed(2),
        notes: truncate(form.notes.trim(), 255) || undefined,
        patientId: Number(form.patientId),
        payments: undefined,
        paymentType: form.paymentMethod,
        sourceVisitIds: [visitId],
        status: effectiveInvoiceStatus,
        totalAmount: totalSelectedImplantsPayment.toFixed(2),
        updatedBy: undefined,
        visitId,
      } as Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>);

      if (!invoiceResponse.success || !invoiceResponse.data) {
        toast.error(invoiceResponse.error?.message || 'Implant records saved, but invoice creation failed.');
        return;
      }

      const createdInvoiceId = Number(invoiceResponse.data.id);
      let createdPaymentId: number | undefined;
      let supplierSafeTransactionId: number | undefined;

      if (paidNowAmount > 0 && Number.isFinite(createdInvoiceId) && createdInvoiceId > 0) {
        const paymentResponse = await createPaymentUseCase.execute({
          amount: paidNowAmount.toFixed(2),
          createdBy: undefined,
          currency: 'AFN',
          deletedBy: undefined,
          exchangeRate: 1,
          invoiceId: String(createdInvoiceId),
          method: form.paymentMethod,
          notes: 'Initial payment from implant planning flow.',
          paymentDate: recordDate,
          updatedBy: undefined,
        } as Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>);

        if (!paymentResponse.success) {
          toast.error('Implant and invoice saved, but payment save failed.');
        } else {
          createdPaymentId = Number(paymentResponse.data?.id);
        }
      }

      if (supplierPaidNowAmount > 0) {
        try {
          const safeClient = await fetchCsrfClient();
          const supplierSafeResponse = await safeClient.post<{ id: number }>(
            '/api/v1/dental-management/safe-transactions',
            {
              amount: supplierPaidNowAmount,
              currency: 'AFN',
              direction: 'out',
              entryType: 'expense',
              exchangeRate: 1,
              notes: truncate(
                `Implant supplier payment for teeth [${selectedImplantTeeth.join(', ')}] from implant planning.`,
                255
              ),
              sourceId: Number.isFinite(visitId) ? visitId : undefined,
              sourceType: 'implant_supplier',
              transactionDate: recordDate,
            }
          );

          if (!supplierSafeResponse.success) {
            toast.error('Implant saved, but third-party payment was not recorded in safe.');
          } else {
            supplierSafeTransactionId = Number(supplierSafeResponse.data?.id);
          }
        } catch {
          toast.error('Implant saved, but third-party payment was not recorded in safe.');
        }
      }

      if (form.patientId) {
        try {
          const taskClient = await fetchCsrfClient();

          for (const toothNumber of selectedImplantTeeth) {
            const existingTask = implantTasksByTooth[toothNumber];
            if (existingTask) {
              continue;
            }

            const taskResponse = await taskClient.post<SessionTask>(
              `/api/v1/dental-management/patients/${form.patientId}/session-tasks`,
              buildImplantTaskPayload(toothNumber, 'not_available')
            );

            if (!taskResponse.success) {
              toast.error(`Implant saved, but tooth ${toothNumber} lifecycle card could not be created.`);
            }
          }

          await queryClient.invalidateQueries({ queryKey: patientTasksQueryKey });
        } catch {
          toast.error('Implant saved, but lifecycle cards could not be synced.');
        }
      }

      setSaveSummary({
        createdVisit: !hasExistingVisit,
        invoiceId: createdInvoiceId,
        paidNowAmount,
        paymentId: createdPaymentId,
        remainingDebt: remainingDebtAmount,
        savedAt: new Date().toISOString(),
        supplierPaidNowAmount,
        supplierSafeTransactionId,
        treatmentCount: selectedImplantTeeth.length,
        visitId,
      });

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
                    <SelectContent>
                      {patientOptions.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="grid gap-3 md:grid-cols-3">
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
                    value={formatCurrency(invoiceNetAmount)}
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
                    value={formatCurrency(remainingDebtAmount)}
                    readOnly
                  />
                  <Input
                    placeholder="Invoice status"
                    value={effectiveInvoiceStatus}
                    readOnly
                  />
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
                    value={formatCurrency(totalSupplierCost)}
                    readOnly
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Company paid now"
                    value={form.supplierPaidNowAmount}
                    onChange={(event) => {
                      setField('supplierPaidNowAmount', event.target.value);
                    }}
                  />
                  <Input
                    placeholder="Company remaining payable"
                    value={formatCurrency(supplierRemainingAmount)}
                    readOnly
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Company paid-now amount is saved as an expense transaction in safe.
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
                    setForm(DEFAULT_FORM);
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
                  <p>Paid now: {formatCurrency(saveSummary.paidNowAmount)}</p>
                  <p>Remaining debt: {formatCurrency(saveSummary.remainingDebt)}</p>
                  {saveSummary.paymentId ? <p>Payment #{saveSummary.paymentId}</p> : null}
                  <p>Third-company paid now: {formatCurrency(saveSummary.supplierPaidNowAmount)}</p>
                  {saveSummary.supplierSafeTransactionId ? (
                    <p>Safe expense #{saveSummary.supplierSafeTransactionId}</p>
                  ) : null}
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
