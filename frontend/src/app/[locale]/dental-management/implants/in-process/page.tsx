'use client';

import { JSX, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  convertInputToUsd,
  convertUsdToInput,
  DEFAULT_AFN_PER_USD,
  formatCurrency,
  type CurrencyCode,
} from '@/lib/currency-utils';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { getIntlLocale } from '@/modules/common/utils/locale';
import { ListPatientsUseCase } from '@/modules/dental-management/application/use-cases/patients/list-patients-use-case';
import { ListVisitTreatmentsUseCase } from '@/modules/dental-management/application/use-cases/visit-treatments/list-visit-treatments-use-case';
import { ListVisitsUseCase } from '@/modules/dental-management/application/use-cases/visits/list-visits-use-case';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import { VisitRepository } from '@/modules/dental-management/infrastructure/repositories/visit-repository';
import { VisitTreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/visit-treatment-repository';
import { type PaginatedApiResponse } from '@/types/ApiResponse';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ClipboardList, Loader2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import styles from '../implant-workspace.module.css';

type SessionTaskStatus = 'pending' | 'in_progress' | 'done';
type SessionTaskMark = 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'purple';
type ImplantAvailabilityStatus = 'not_available' | 'in_purchase' | 'available' | 'done';
type SessionTask = {
  id: number;
  mark: SessionTaskMark;
  notes?: string;
  patientId: number;
  status: SessionTaskStatus;
  title: string;
};

const IMPLANT_TASK_MARKER = 'implant_tooth';
const AVAILABILITY_TO_TASK_STATUS: Record<ImplantAvailabilityStatus, SessionTaskStatus> = {
  available: 'in_progress',
  done: 'done',
  in_purchase: 'in_progress',
  not_available: 'pending',
};
const AVAILABILITY_TO_TASK_MARK: Record<ImplantAvailabilityStatus, SessionTaskMark> = {
  available: 'green',
  done: 'blue',
  in_purchase: 'yellow',
  not_available: 'red',
};
const AVAILABILITY_TITLES: Record<ImplantAvailabilityStatus, string> = {
  available: 'Available',
  done: 'Done',
  in_purchase: 'In Purchase',
  not_available: 'Not Available',
};
const AVAILABILITY_ORDER: ImplantAvailabilityStatus[] = [
  'not_available',
  'in_purchase',
  'available',
  'done',
];
const FALLBACK_TASK_STATUS_TO_AVAILABILITY: Record<SessionTaskStatus, ImplantAvailabilityStatus> = {
  done: 'done',
  in_progress: 'available',
  pending: 'not_available',
};

type ImplantCard = {
  availability: ImplantAvailabilityStatus;
  currency: CurrencyCode;
  exchangeRate: number;
  supplierPaid: number;
  supplierPaidInput: number;
  supplierRemaining: number;
  supplierRemainingInput: number;
  supplierTotal: number;
  supplierTotalInput: number;
  taskId: number;
  toothNumber: string;
};

type ImplantPlanningRecord = {
  arch: string;
  createdAt: string;
  dentistId?: string;
  diameterMm: string;
  id: number;
  implantSystem: string;
  lengthMm: string;
  loadingProtocol: string;
  notes: string;
  patientId: string;
  patientPrice: number;
  patientPriceInput: number;
  rawNotes: string;
  currency: CurrencyCode;
  exchangeRate: number;
  supplierCost: number;
  supplierCostInput: number;
  toothNumber: string;
  treatmentId: string;
  updatedAt: string;
  visitDate: string;
  visitId: string;
};

const extractImplantToothFromTask = (task: Pick<SessionTask, 'notes' | 'title'>): string | null => {
  const notesMatch = task.notes?.match(/\[implant_tooth:([0-9]{2})\]/i);
  if (notesMatch?.[1]) {
    return notesMatch[1];
  }

  const titleMatch = task.title.match(/([0-9]{2})/);
  return titleMatch?.[1] ?? null;
};

const parseAvailabilityFromTaskNotes = (notes?: string): ImplantAvailabilityStatus | null => {
  if (!notes) {
    return null;
  }

  const match = notes.match(/\[implant_availability:(not_available|in_purchase|available|done)\]/i);
  if (!match?.[1]) {
    return null;
  }

  const value = match[1].toLowerCase();
  if (
    value === 'not_available' ||
    value === 'in_purchase' ||
    value === 'available' ||
    value === 'done'
  ) {
    return value;
  }

  return null;
};

const parseTaggedAmount = (
  notes: string | undefined,
  key: 'supplier_paid' | 'supplier_total'
): number => {
  if (!notes) {
    return 0;
  }

  const match = notes.match(new RegExp(`\\[${key}:([0-9]+(?:\\.[0-9]+)?)\\]`, 'i'));
  if (!match?.[1]) {
    return 0;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const resolveCurrencyCode = (value?: string): CurrencyCode =>
  value?.trim().toUpperCase() === 'USD' ? 'USD' : 'AFN';

const resolveExchangeRate = (currency: CurrencyCode, value: number): number => {
  if (currency === 'USD') {
    return value > 0 ? value : DEFAULT_AFN_PER_USD;
  }

  return 1;
};

const parseTaggedText = (notes: string | undefined, key: string): string => {
  if (!notes) {
    return '';
  }

  const match = notes.match(new RegExp(`\\[${key}:([^\\]]+)\\]`, 'i'));
  return match?.[1]?.trim() ?? '';
};

const parseTaggedNumber = (notes: string | undefined, key: string): number => {
  const text = parseTaggedText(notes, key);
  if (!text) {
    return 0;
  }

  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const stripTaggedTokens = (notes: string | undefined): string => {
  if (!notes) {
    return '';
  }

  return notes
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const formatDateTime = (value: string, locale: string): string => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(getIntlLocale(locale));
};

const formatAmountDisplay = (
  amountAfn: number,
  amountInput: number,
  currency: CurrencyCode,
  exchangeRate: number
): string => {
  if (currency === 'USD') {
    const resolvedInput =
      amountInput > 0 ? amountInput : convertUsdToInput(amountAfn, currency, exchangeRate);
    return `${formatCurrency(resolvedInput, 'USD')} (${formatCurrency(amountAfn, 'AFN')})`;
  }

  return formatCurrency(amountInput > 0 ? amountInput : amountAfn, 'AFN');
};

const buildImplantTaskPayload = (
  toothNumber: string,
  availability: ImplantAvailabilityStatus,
  supplier: {
    currency: CurrencyCode;
    exchangeRate: number;
    paid: number;
    paidInput: number;
    total: number;
    totalInput: number;
  }
): Pick<SessionTask, 'mark' | 'notes' | 'status' | 'title'> => ({
  mark: AVAILABILITY_TO_TASK_MARK[availability],
  notes: `[${IMPLANT_TASK_MARKER}:${toothNumber}] [implant_availability:${availability}] [currency:${supplier.currency}] [exchangeRate:${supplier.exchangeRate.toFixed(6)}] [supplier_paid:${supplier.paid.toFixed(2)}] [supplier_paid_input:${supplier.paidInput.toFixed(2)}] [supplier_total:${supplier.total.toFixed(2)}] [supplier_total_input:${supplier.totalInput.toFixed(2)}]`,
  status: AVAILABILITY_TO_TASK_STATUS[availability],
  title: `Implant Tooth ${toothNumber}`,
});

// eslint-disable-next-line react/function-component-definition
export default function InProcessImplantsPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchDebounced, setPatientSearchDebounced] = useState('');
  const [availabilityTaskSaving, setAvailabilityTaskSaving] = useState<number | null>(null);
  const [supplierPayNowByTask, setSupplierPayNowByTask] = useState<Record<string, string>>({});
  const [selectedPlanningRecord, setSelectedPlanningRecord] =
    useState<ImplantPlanningRecord | null>(null);
  const patientTasksQueryKey = useMemo(() => ['patient-session-tasks', patientId], [patientId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPatientSearchDebounced(patientSearch.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [patientSearch]);

  const {
    data: patientPages,
    fetchNextPage,
    hasNextPage,
    isFetching: isLoadingPatients,
    isFetchingNextPage,
  } = useInfiniteQuery({
    getNextPageParam: (lastPage: PaginatedApiResponse<Patient[]>) =>
      lastPage.meta.currentPage < lastPage.meta.lastPage
        ? lastPage.meta.currentPage + 1
        : undefined,
    initialPageParam: 1,
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
    queryKey: ['in-process-implant-patient-options', patientSearchDebounced],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: patientSessionTasks = [] } = useQuery<SessionTask[]>({
    enabled: Boolean(patientId),
    queryFn: async () => {
      if (!patientId) {
        return [];
      }

      const client = new AxiosClient();
      const response = await client.get<SessionTask[]>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks`
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
  const { data: implantPlanningRecords = [], isFetching: isLoadingImplantPlanningRecords } =
    useQuery<ImplantPlanningRecord[]>({
      enabled: Boolean(patientId),
      queryFn: async () => {
        if (!patientId) {
          return [];
        }

        const visitRepository = new VisitRepository();
        const listVisitsUseCase = new ListVisitsUseCase(visitRepository);
        const allVisits: Visit[] = [];
        let currentVisitPage = 1;
        let lastVisitPage = 1;

        do {
          const visitResponse = await listVisitsUseCase.execute(
            '',
            [],
            [],
            { patientId: [patientId] },
            currentVisitPage,
            100
          );
          if (visitResponse.error || !visitResponse.data) {
            return [];
          }

          allVisits.push(...visitResponse.data.data);
          lastVisitPage = visitResponse.data.meta?.lastPage ?? currentVisitPage;
          currentVisitPage += 1;
        } while (currentVisitPage <= lastVisitPage);

        if (allVisits.length === 0) {
          return [];
        }

        const visitIds = allVisits.map((visit) => String(visit.id));
        const visitDateById = allVisits.reduce<Record<string, string>>((accumulator, visit) => {
          accumulator[String(visit.id)] = visit.visitDate;
          return accumulator;
        }, {});

        const visitTreatmentRepository = new VisitTreatmentRepository();
        const listVisitTreatmentsUseCase = new ListVisitTreatmentsUseCase(visitTreatmentRepository);
        const allVisitTreatments: VisitTreatment[] = [];
        const chunkSize = 30;

        for (let index = 0; index < visitIds.length; index += chunkSize) {
          const visitIdChunk = visitIds.slice(index, index + chunkSize);
          let currentVisitTreatmentPage = 1;
          let lastVisitTreatmentPage = 1;

          do {
            const visitTreatmentResponse = await listVisitTreatmentsUseCase.execute(
              '',
              [],
              [],
              { visitId: visitIdChunk },
              currentVisitTreatmentPage,
              100
            );

            if (visitTreatmentResponse.error || !visitTreatmentResponse.data) {
              break;
            }

            allVisitTreatments.push(...visitTreatmentResponse.data.data);
            lastVisitTreatmentPage =
              visitTreatmentResponse.data.meta?.lastPage ?? currentVisitTreatmentPage;
            currentVisitTreatmentPage += 1;
          } while (currentVisitTreatmentPage <= lastVisitTreatmentPage);
        }

        return allVisitTreatments
          .filter((visitTreatment) => {
            const notes = visitTreatment.notes?.toLowerCase() ?? '';
            return notes.includes('[condition:implant]');
          })
          .map((visitTreatment) => {
            const rawNotes = visitTreatment.notes ?? '';
            const currency = resolveCurrencyCode(parseTaggedText(rawNotes, 'currency'));
            const exchangeRate = resolveExchangeRate(
              currency,
              parseTaggedNumber(rawNotes, 'exchangeRate')
            );
            const taggedTooth = parseTaggedText(rawNotes, 'tooth');
            const patientPriceFromNotes = parseTaggedNumber(rawNotes, 'patientPrice');
            const patientPriceInputFromNotes = parseTaggedNumber(rawNotes, 'patientPriceInput');
            const supplierCostFromNotes = parseTaggedNumber(rawNotes, 'supplierCost');
            const supplierCostInputFromNotes = parseTaggedNumber(rawNotes, 'supplierCostInput');
            const patientPriceFromRow = Number.parseFloat(visitTreatment.price);
            const patientPrice = Number.isFinite(patientPriceFromRow)
              ? patientPriceFromRow
              : patientPriceFromNotes;
            const patientPriceInput =
              patientPriceInputFromNotes > 0
                ? patientPriceInputFromNotes
                : currency === 'USD'
                  ? convertUsdToInput(Math.max(0, patientPrice), currency, exchangeRate)
                  : Math.max(0, patientPrice);
            const supplierCost = supplierCostFromNotes;
            const supplierCostInput =
              supplierCostInputFromNotes > 0
                ? supplierCostInputFromNotes
                : currency === 'USD'
                  ? convertUsdToInput(Math.max(0, supplierCost), currency, exchangeRate)
                  : Math.max(0, supplierCost);

            return {
              arch: parseTaggedText(rawNotes, 'arch') || '-',
              createdAt: visitTreatment.createdAt,
              currency,
              dentistId: visitTreatment.dentistId,
              diameterMm: parseTaggedText(rawNotes, 'diameter') || '-',
              exchangeRate,
              id: visitTreatment.id,
              implantSystem: visitTreatment.material?.trim() || '-',
              lengthMm: parseTaggedText(rawNotes, 'length') || '-',
              loadingProtocol: parseTaggedText(rawNotes, 'protocol') || '-',
              notes: stripTaggedTokens(rawNotes) || '-',
              patientId,
              patientPrice: Math.max(0, patientPrice),
              patientPriceInput,
              rawNotes: rawNotes || '-',
              supplierCost,
              supplierCostInput,
              toothNumber: visitTreatment.toothNumber || taggedTooth || '-',
              treatmentId: visitTreatment.treatmentId,
              updatedAt: visitTreatment.updatedAt,
              visitDate: visitDateById[visitTreatment.visitId] || '-',
              visitId: visitTreatment.visitId,
            } satisfies ImplantPlanningRecord;
          })
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      },
      queryKey: ['in-process-implant-planning-records', patientId],
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    });

  const allPatients = useMemo(
    () => (patientPages?.pages ?? []).flatMap((page) => page.data),
    [patientPages]
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
      .sort((left, right) =>
        left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
      );
  }, [allPatients]);

  const implantCards = useMemo<ImplantCard[]>(() => {
    const cards = patientSessionTasks
      .map((task) => {
        const notes = task.notes ?? '';
        if (
          !notes.includes(IMPLANT_TASK_MARKER) &&
          !task.title.toLowerCase().includes('implant tooth')
        ) {
          return null;
        }

        const toothNumber = extractImplantToothFromTask(task);
        if (!toothNumber) {
          return null;
        }

        const availabilityFromNotes = parseAvailabilityFromTaskNotes(task.notes);
        const currency = resolveCurrencyCode(parseTaggedText(task.notes, 'currency'));
        const exchangeRate = resolveExchangeRate(
          currency,
          parseTaggedNumber(task.notes, 'exchangeRate')
        );
        const supplierTotal = parseTaggedAmount(task.notes, 'supplier_total');
        const supplierPaidRaw = parseTaggedAmount(task.notes, 'supplier_paid');
        const supplierPaid = Math.min(supplierTotal, supplierPaidRaw);
        const supplierTotalInputRaw = parseTaggedNumber(task.notes, 'supplier_total_input');
        const supplierTotalInput =
          supplierTotalInputRaw > 0
            ? supplierTotalInputRaw
            : currency === 'USD'
              ? convertUsdToInput(supplierTotal, currency, exchangeRate)
              : supplierTotal;
        const supplierPaidInputRaw = parseTaggedNumber(task.notes, 'supplier_paid_input');
        const supplierPaidInput =
          supplierPaidInputRaw > 0
            ? Math.min(supplierTotalInput, supplierPaidInputRaw)
            : currency === 'USD'
              ? convertUsdToInput(supplierPaid, currency, exchangeRate)
              : supplierPaid;
        const supplierRemaining = Math.max(0, supplierTotal - supplierPaid);
        const supplierRemainingInput = Math.max(0, supplierTotalInput - supplierPaidInput);

        return {
          availability: availabilityFromNotes ?? FALLBACK_TASK_STATUS_TO_AVAILABILITY[task.status],
          currency,
          exchangeRate,
          supplierPaid,
          supplierPaidInput,
          supplierRemaining,
          supplierRemainingInput,
          supplierTotal,
          supplierTotalInput,
          taskId: task.id,
          toothNumber,
        };
      })
      .filter((card): card is ImplantCard => Boolean(card));

    const uniqueByTaskTooth = new Map<string, ImplantCard>();
    cards.forEach((card) => {
      const key = `${card.taskId}-${card.toothNumber}`;
      uniqueByTaskTooth.set(key, card);
    });

    return Array.from(uniqueByTaskTooth.values()).sort((left, right) =>
      left.toothNumber.localeCompare(right.toothNumber, undefined, { numeric: true })
    );
  }, [patientSessionTasks]);

  const implantCardByTask = useMemo<Record<string, ImplantCard>>(() => {
    const result: Record<string, ImplantCard> = {};
    implantCards.forEach((card) => {
      result[card.taskId] = card;
    });
    return result;
  }, [implantCards]);

  const groupedImplants = useMemo(() => {
    const grouped: Record<ImplantAvailabilityStatus, ImplantCard[]> = {
      available: [],
      done: [],
      in_purchase: [],
      not_available: [],
    };

    implantCards.forEach((card) => {
      grouped[card.availability].push(card);
    });

    return grouped;
  }, [implantCards]);
  const unpaidSupplierRows = useMemo(() => {
    return implantCards
      .filter((card) => card.supplierRemaining > 0)
      .sort((left, right) =>
        left.toothNumber.localeCompare(right.toothNumber, undefined, { numeric: true })
      );
  }, [implantCards]);

  const fetchCsrfClient = async (): Promise<AxiosClient> => {
    const client = new AxiosClient();
    await client.get('/sanctum/csrf-cookie');
    return client;
  };

  const setImplantAvailabilityMutation = useMutation({
    mutationFn: async ({
      currency,
      exchangeRate,
      nextAvailability,
      supplierPaid,
      supplierPaidInput,
      supplierTotal,
      supplierTotalInput,
      taskId,
      toothNumber,
    }: {
      currency: CurrencyCode;
      exchangeRate: number;
      nextAvailability: ImplantAvailabilityStatus;
      supplierPaid: number;
      supplierPaidInput: number;
      supplierTotal: number;
      supplierTotalInput: number;
      taskId: number;
      toothNumber: string;
    }) => {
      if (!patientId) {
        throw new Error('Patient is required.');
      }

      const client = await fetchCsrfClient();
      return client.put<SessionTask>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks/${taskId}`,
        buildImplantTaskPayload(toothNumber, nextAvailability, {
          currency,
          exchangeRate,
          paid: supplierPaid,
          paidInput: supplierPaidInput,
          total: supplierTotal,
          totalInput: supplierTotalInput,
        })
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: patientTasksQueryKey });
    },
  });

  const handleSetImplantAvailability = async (
    taskId: number,
    toothNumber: string,
    nextAvailability: ImplantAvailabilityStatus
  ): Promise<void> => {
    if (!patientId) {
      toast.error('Select a patient first.');
      return;
    }

    const card = implantCardByTask[taskId];
    if (!card) {
      toast.error('Implant card not found.');
      return;
    }

    let supplierPaidNext = card.supplierPaid;
    let supplierPaidInputNext = card.supplierPaidInput;
    const supplierRemainingBeforeInput = Math.max(
      0,
      card.supplierTotalInput - card.supplierPaidInput
    );
    const requestedPayNow = Number.parseFloat(supplierPayNowByTask[taskId] ?? '');
    const supplierPayNowInput = Number.isFinite(requestedPayNow)
      ? Math.min(Math.max(0, requestedPayNow), supplierRemainingBeforeInput)
      : 0;
    const supplierPayNow = convertInputToUsd(supplierPayNowInput, card.currency, card.exchangeRate);

    if (card.availability === nextAvailability && supplierPayNowInput <= 0) {
      return;
    }

    setAvailabilityTaskSaving(taskId);
    try {
      if (supplierPayNowInput > 0) {
        const safeClient = await fetchCsrfClient();
        const today = new Date().toISOString().slice(0, 10);
        const safeResponse = await safeClient.post<{ id: number }>(
          '/api/v1/dental-management/safe-transactions',
          {
            amount: supplierPayNowInput,
            currency: card.currency,
            direction: 'out',
            entryType: 'expense',
            exchangeRate: card.exchangeRate,
            notes: `Implant supplier payment for tooth ${toothNumber}.`,
            sourceId: taskId,
            sourceType: 'implant_supplier',
            transactionDate: today,
          }
        );

        if (!safeResponse.success) {
          toast.error(safeResponse.error?.message || 'Could not record supplier payment in safe.');
          return;
        }

        supplierPaidNext = Math.min(card.supplierTotal, card.supplierPaid + supplierPayNow);
        supplierPaidInputNext = Math.min(
          card.supplierTotalInput,
          card.supplierPaidInput + supplierPayNowInput
        );
      }

      const response = await setImplantAvailabilityMutation.mutateAsync({
        currency: card.currency,
        exchangeRate: card.exchangeRate,
        nextAvailability,
        supplierPaid: supplierPaidNext,
        supplierPaidInput: supplierPaidInputNext,
        supplierTotal: card.supplierTotal,
        supplierTotalInput: card.supplierTotalInput,
        taskId,
        toothNumber,
      });

      if (!response.success) {
        toast.error(response.error?.message || 'Failed to update implant status.');
        return;
      }

      setSupplierPayNowByTask((prev) => ({ ...prev, [taskId]: '' }));
      toast.success(
        card.availability === nextAvailability
          ? `Supplier payment recorded for tooth ${toothNumber}.`
          : `Tooth ${toothNumber} moved to ${AVAILABILITY_TITLES[nextAvailability]}.`
      );
    } catch {
      toast.error('Failed to update implant status.');
    } finally {
      setAvailabilityTaskSaving(null);
    }
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'implants', label: tSidebar('implants') },
          { id: 'implantsInProcess', isCurrent: true, label: tSidebar('implantsInProcess') },
        ]}
      />

      <div className={`${styles.page} flex min-w-0 flex-1 flex-col px-4 pb-8 lg:px-6`}>
        <section className={styles.hero} aria-labelledby="implant-progress-title">
          <div>
            <p className={styles.heroEyebrow}>IMPLANT WORKSPACE / CASE PROGRESS</p>
            <h1 id="implant-progress-title">Track implant cases</h1>
            <p className={styles.heroDescription}>
              See where each tooth stands, record supplier payments, and move care forward.
            </p>
            <div className={styles.heroActions}>
              <Link href={`/${locale}/dental-management/implants`} className={styles.heroLink}>
                Create an implant plan
              </Link>
              {patientId && (
                <span className={styles.heroProgress}>
                  {implantCards.length} implant teeth in this patient file
                </span>
              )}
            </div>
          </div>
          <div className={styles.heroEmblem} aria-hidden="true">
            <PackageCheck size={47} strokeWidth={1.25} />
          </div>
        </section>

        <Card className={styles.progressCard}>
          <CardHeader>
            <CardTitle>Find a patient</CardTitle>
            <CardDescription>
              Choose a patient to view their saved plans and implant progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className={styles.patientPicker}>
              <Input
                aria-label="Search patients"
                placeholder="Search patient (name, code, phone)"
                value={patientSearch}
                onChange={(event) => setPatientSearch(event.target.value)}
              />
              <Select
                value={patientId || undefined}
                onValueChange={setPatientId}
                disabled={isLoadingPatients || patientOptions.length === 0}
              >
                <SelectTrigger aria-label="Select patient">
                  <SelectValue
                    placeholder={isLoadingPatients ? 'Loading patients...' : 'Select patient'}
                  />
                </SelectTrigger>
                <SelectContent
                  onScroll={(event) => {
                    const target = event.currentTarget;
                    const isNearBottom =
                      target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
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
                      <p>
                        {isFetchingNextPage
                          ? 'Loading more patients...'
                          : 'Scroll to load more patients.'}
                      </p>
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
              <p className={`${styles.pickerHint} text-xs text-muted-foreground`}>
                Type to search by name, code, or phone. Scroll to load more.
              </p>
            </div>

            {!patientId ? (
              <div className={styles.emptyState}>
                <ClipboardList className="size-8" aria-hidden="true" />
                <p className="font-semibold">Choose a patient to see their implant progress</p>
                <p className="text-sm">
                  Their teeth, current stages and supplier balances will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <section className={styles.boardSection} aria-labelledby="implant-stage-heading">
                  <div className={styles.boardHeading}>
                    <div>
                      <p className={styles.sectionEyebrow}>PATIENT PROGRESS</p>
                      <h2 id="implant-stage-heading">Implant stages</h2>
                      <p>
                        Each tooth has a clear next step. Open other stage changes when a case needs
                        a correction.
                      </p>
                    </div>
                  </div>
                  <div className={styles.stageOverview} aria-label="Teeth by implant stage">
                    {AVAILABILITY_ORDER.map((availability) => (
                      <div
                        key={`summary-${availability}`}
                        className={styles.stageSummary}
                        data-stage={availability}
                      >
                        <span>{AVAILABILITY_TITLES[availability]}</span>
                        <strong>{groupedImplants[availability].length}</strong>
                      </div>
                    ))}
                  </div>
                  <div className={styles.stageBoard}>
                    {AVAILABILITY_ORDER.map((availability) => (
                      <div
                        key={availability}
                        className={styles.stageColumn}
                        data-stage={availability}
                      >
                        <div className={styles.stageColumnHeading}>
                          <p className="text-sm font-semibold">
                            {AVAILABILITY_TITLES[availability]}
                          </p>
                          <span>{groupedImplants[availability].length}</span>
                        </div>

                        {groupedImplants[availability].length === 0 ? (
                          <p className={styles.stageEmpty}>No teeth at this stage</p>
                        ) : (
                          <div className="space-y-2">
                            {groupedImplants[availability].map((card) => {
                              const nextAvailability =
                                AVAILABILITY_ORDER[
                                  AVAILABILITY_ORDER.indexOf(card.availability) + 1
                                ];
                              const hasPendingPayment =
                                Number(supplierPayNowByTask[card.taskId]) > 0;
                              const otherStages = AVAILABILITY_ORDER.filter(
                                (stage) => stage !== card.availability && stage !== nextAvailability
                              );
                              return (
                                <div
                                  key={`${card.taskId}-${card.toothNumber}`}
                                  className={styles.toothCard}
                                >
                                  <div className={styles.toothHeading}>
                                    <span className="text-sm font-medium">
                                      Tooth {card.toothNumber}
                                    </span>
                                    <span className={styles.toothStage}>
                                      {AVAILABILITY_TITLES[card.availability]}
                                    </span>
                                  </div>
                                  <div className={styles.balanceLine}>
                                    <span>Supplier balance</span>
                                    <strong>
                                      {formatAmountDisplay(
                                        card.supplierRemaining,
                                        card.supplierRemainingInput,
                                        card.currency,
                                        card.exchangeRate
                                      )}
                                    </strong>
                                  </div>
                                  {nextAvailability ? (
                                    <Button
                                      className={styles.nextStageButton}
                                      type="button"
                                      size="sm"
                                      disabled={availabilityTaskSaving === card.taskId}
                                      onClick={() => {
                                        void handleSetImplantAvailability(
                                          card.taskId,
                                          card.toothNumber,
                                          nextAvailability
                                        );
                                      }}
                                    >
                                      {availabilityTaskSaving === card.taskId ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <ArrowRight className="size-4" />
                                      )}
                                      {hasPendingPayment
                                        ? 'Record payment and move to '
                                        : 'Move to '}
                                      {AVAILABILITY_TITLES[nextAvailability]}
                                    </Button>
                                  ) : (
                                    <p className={styles.completedLabel}>Stage complete</p>
                                  )}
                                  {card.supplierRemainingInput > 0 ? (
                                    <details className={styles.cardDetails}>
                                      <summary>Record supplier payment</summary>
                                      <div className={styles.paymentPanel}>
                                        <label htmlFor={`supplier-payment-${card.taskId}`}>
                                          Amount to pay ({card.currency})
                                        </label>
                                        <Input
                                          id={`supplier-payment-${card.taskId}`}
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max={card.supplierRemainingInput}
                                          placeholder="Enter amount"
                                          value={supplierPayNowByTask[card.taskId] ?? ''}
                                          onChange={(event) => {
                                            setSupplierPayNowByTask((prev) => ({
                                              ...prev,
                                              [card.taskId]: event.target.value,
                                            }));
                                          }}
                                        />
                                        <p>
                                          Paid so far:{' '}
                                          {formatAmountDisplay(
                                            card.supplierPaid,
                                            card.supplierPaidInput,
                                            card.currency,
                                            card.exchangeRate
                                          )}
                                        </p>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={
                                            !hasPendingPayment ||
                                            availabilityTaskSaving === card.taskId
                                          }
                                          onClick={() => {
                                            void handleSetImplantAvailability(
                                              card.taskId,
                                              card.toothNumber,
                                              card.availability
                                            );
                                          }}
                                        >
                                          {availabilityTaskSaving === card.taskId ? (
                                            <Loader2 className="size-4 animate-spin" />
                                          ) : null}
                                          Record payment
                                        </Button>
                                      </div>
                                    </details>
                                  ) : null}
                                  {otherStages.length > 0 ? (
                                    <details className={styles.cardDetails}>
                                      <summary>Other stage changes</summary>
                                      <div className={styles.otherStages}>
                                        {otherStages.map((targetAvailability) => (
                                          <Button
                                            key={targetAvailability}
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={availabilityTaskSaving === card.taskId}
                                            onClick={() => {
                                              void handleSetImplantAvailability(
                                                card.taskId,
                                                card.toothNumber,
                                                targetAvailability
                                              );
                                            }}
                                          >
                                            {hasPendingPayment
                                              ? `Record payment and set ${AVAILABILITY_TITLES[targetAvailability]}`
                                              : `Set ${AVAILABILITY_TITLES[targetAvailability]}`}
                                          </Button>
                                        ))}
                                      </div>
                                    </details>
                                  ) : null}
                                  <div className={styles.costDetails}>
                                    <span>
                                      Total cost:{' '}
                                      {formatAmountDisplay(
                                        card.supplierTotal,
                                        card.supplierTotalInput,
                                        card.currency,
                                        card.exchangeRate
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <Card id="saved-implant-records" className={styles.recordsCard}>
                  <CardHeader>
                    <CardTitle className="text-base">Planning records</CardTitle>
                    <CardDescription>
                      Open a saved plan to see its full clinical and cost details.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingImplantPlanningRecords ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Loading implant records...
                      </div>
                    ) : implantPlanningRecords.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No saved implant planning records found.
                      </p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {implantPlanningRecords.map((record) => (
                          <button
                            key={`planning-record-${record.id}`}
                            type="button"
                            className={styles.recordTile}
                            onClick={() => {
                              setSelectedPlanningRecord(record);
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold">Tooth {record.toothNumber}</p>
                              <Badge variant="outline">Visit {record.visitId}</Badge>
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <p>
                                Patient price:{' '}
                                <span className="font-medium text-foreground">
                                  {formatAmountDisplay(
                                    record.patientPrice,
                                    record.patientPriceInput,
                                    record.currency,
                                    record.exchangeRate
                                  )}
                                </span>
                              </p>
                              <p>
                                Supplier cost:{' '}
                                <span className="font-medium text-foreground">
                                  {formatAmountDisplay(
                                    record.supplierCost,
                                    record.supplierCostInput,
                                    record.currency,
                                    record.exchangeRate
                                  )}
                                </span>
                              </p>
                              <p>
                                Implant system:{' '}
                                <span className="font-medium text-foreground">
                                  {record.implantSystem}
                                </span>
                              </p>
                              <p>
                                Saved at:{' '}
                                <span className="font-medium text-foreground">
                                  {formatDateTime(record.createdAt, locale)}
                                </span>
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {patientId ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Supplier balances</CardTitle>
                  <CardDescription>
                    Outstanding clinic payments to implant supplier by tooth.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {unpaidSupplierRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No unpaid supplier balances.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tooth</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>Unpaid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unpaidSupplierRows.map((row) => (
                          <TableRow key={`unpaid-${row.taskId}-${row.toothNumber}`}>
                            <TableCell>Tooth {row.toothNumber}</TableCell>
                            <TableCell>{AVAILABILITY_TITLES[row.availability]}</TableCell>
                            <TableCell>
                              {formatAmountDisplay(
                                row.supplierTotal,
                                row.supplierTotalInput,
                                row.currency,
                                row.exchangeRate
                              )}
                            </TableCell>
                            <TableCell>
                              {formatAmountDisplay(
                                row.supplierPaid,
                                row.supplierPaidInput,
                                row.currency,
                                row.exchangeRate
                              )}
                            </TableCell>
                            <TableCell>
                              {formatAmountDisplay(
                                row.supplierRemaining,
                                row.supplierRemainingInput,
                                row.currency,
                                row.exchangeRate
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(selectedPlanningRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPlanningRecord(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPlanningRecord
                ? `Tooth ${selectedPlanningRecord.toothNumber} implant plan`
                : 'Implant plan'}
            </DialogTitle>
            <DialogDescription>Clinical and cost details from the saved plan.</DialogDescription>
          </DialogHeader>

          {selectedPlanningRecord ? (
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Visit date:</span>{' '}
                {selectedPlanningRecord.visitDate}
              </p>
              <p>
                <span className="text-muted-foreground">Tooth:</span>{' '}
                {selectedPlanningRecord.toothNumber}
              </p>
              <p>
                <span className="text-muted-foreground">Patient price:</span>{' '}
                {formatAmountDisplay(
                  selectedPlanningRecord.patientPrice,
                  selectedPlanningRecord.patientPriceInput,
                  selectedPlanningRecord.currency,
                  selectedPlanningRecord.exchangeRate
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Supplier cost:</span>{' '}
                {formatAmountDisplay(
                  selectedPlanningRecord.supplierCost,
                  selectedPlanningRecord.supplierCostInput,
                  selectedPlanningRecord.currency,
                  selectedPlanningRecord.exchangeRate
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Implant system:</span>{' '}
                {selectedPlanningRecord.implantSystem}
              </p>
              <p>
                <span className="text-muted-foreground">Diameter (mm):</span>{' '}
                {selectedPlanningRecord.diameterMm}
              </p>
              <p>
                <span className="text-muted-foreground">Length (mm):</span>{' '}
                {selectedPlanningRecord.lengthMm}
              </p>
              <p>
                <span className="text-muted-foreground">Arch:</span> {selectedPlanningRecord.arch}
              </p>
              <p>
                <span className="text-muted-foreground">Loading protocol:</span>{' '}
                {selectedPlanningRecord.loadingProtocol}
              </p>
              <p>
                <span className="text-muted-foreground">Created:</span>{' '}
                {formatDateTime(selectedPlanningRecord.createdAt, locale)}
              </p>
              <p>
                <span className="text-muted-foreground">Updated:</span>{' '}
                {formatDateTime(selectedPlanningRecord.updatedAt, locale)}
              </p>
              <div className="space-y-1 md:col-span-2">
                <p className="text-muted-foreground">Notes:</p>
                <p className="rounded-md border border-border bg-muted/20 p-2">
                  {selectedPlanningRecord.notes}
                </p>
              </div>
              <details className={`${styles.cardDetails} md:col-span-2`}>
                <summary>Technical record details</summary>
                <div className={styles.technicalDetails}>
                  <p>Patient ID: {selectedPlanningRecord.patientId}</p>
                  <p>Visit ID: {selectedPlanningRecord.visitId}</p>
                  <p>Treatment ID: {selectedPlanningRecord.treatmentId}</p>
                  <p>Dentist ID: {selectedPlanningRecord.dentistId || '-'}</p>
                  <p>Raw record: {selectedPlanningRecord.rawNotes}</p>
                </div>
              </details>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
