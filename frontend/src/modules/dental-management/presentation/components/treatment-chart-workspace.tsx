'use client';

import { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { useAuthStore } from '@/modules/auth/application/stores/auth-store';
import { DEFAULT_AFN_PER_USD, getExchangeRate } from '@/lib/currency-utils';
import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import {
  useCreateVisitTreatment,
  usePatientList,
  useStaffList,
  useToothList,
  useTreatmentList,
  useVisitList,
  useVisitTreatmentList,
} from '@/modules/dental-management/presentation/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utilities';
import { Eraser, Loader2, Paintbrush, Printer, Stethoscope, UserRound } from 'lucide-react';
import { toast } from 'sonner';

type ConditionKey =
  | 'caries'
  | 'surgery'
  | 'implant'
  | 'gingivitis'
  | 'periodontitis'
  | 'removal'
  | 'periostitis';

type ConditionMeta = {
  color: string;
  label: string;
};

type VisitTreatmentWithRelations = VisitTreatment & {
  dentist?: Partial<Staff>;
  tooth?: Partial<Tooth>;
  treatment?: Partial<Treatment>;
};

type TreatmentChartWorkspaceProps = {
  hidePatientVisitSelectors?: boolean;
  initialPatientId?: string | number;
  initialVisitId?: string | number;
  lockPatientSelection?: boolean;
  lockVisitSelection?: boolean;
};

const CONDITIONS: Record<ConditionKey, ConditionMeta> = {
  caries: { color: '#4ade80', label: 'Caries' },
  gingivitis: { color: '#f87171', label: 'Gingivitis' },
  implant: { color: '#c084fc', label: 'Implant' },
  periodontitis: { color: '#67e8f9', label: 'Periodontitis' },
  periostitis: { color: '#8b5e3c', label: 'Periostitis' },
  removal: { color: '#cbd5e1', label: 'Removal' },
  surgery: { color: '#f9a8d4', label: 'Surgery' },
};

const UPPER_ARCH = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_ARCH = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
const ALL_TEETH = [...UPPER_ARCH, ...LOWER_ARCH];
const CONDITION_CODES: Record<ConditionKey, string> = {
  caries: 'c',
  gingivitis: 'g',
  implant: 'i',
  periodontitis: 'p',
  periostitis: 'o',
  removal: 'r',
  surgery: 's',
};
const CODE_TO_CONDITION: Record<string, ConditionKey> = Object.fromEntries(
  (Object.keys(CONDITION_CODES) as ConditionKey[]).map((key) => [CONDITION_CODES[key], key])
) as Record<string, ConditionKey>;
const exchangeRateClient = new AxiosClient();

const isConditionKey = (value: string): value is ConditionKey => {
  return value in CONDITIONS;
};

const isToothNumber = (value: string): boolean => /^[0-9]{2}$/.test(value);

const parseConditionToken = (value?: string): ConditionKey | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (isConditionKey(normalized)) {
    return normalized;
  }

  return CODE_TO_CONDITION[normalized] ?? null;
};

const parseConditionFromNotes = (value?: string): ConditionKey | null => {
  if (!value) {
    return null;
  }

  const match = value.match(/^\[condition:([a-z]+)\]/i);
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
  return match ? match[1] : null;
};

const parseToothNumbersFromValue = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  const numbers = value
    .split(',')
    .map((item) => item.trim())
    .filter(isToothNumber);

  return Array.from(new Set(numbers));
};

const parseToothConditionMapFromNotes = (value?: string): Record<string, ConditionKey> => {
  if (!value) {
    return {};
  }

  const match = value.match(/\[chart:([^\]]+)\]/i);
  if (!match) {
    return {};
  }

  const result: Record<string, ConditionKey> = {};
  const pairs = match[1].split(',');

  for (const pair of pairs) {
    const [toothRaw, conditionRaw] = pair.split('=').map((item) => item?.trim() ?? '');
    const condition = parseConditionToken(conditionRaw);

    if (isToothNumber(toothRaw) && condition) {
      result[toothRaw] = condition;
    }
  }

  return result;
};

const stripMetadataPrefixes = (value?: string): string => {
  if (!value) {
    return '';
  }

  const metadataPrefix =
    /^(?:\[(?:chart:[^\]]+|image:[01]|imagePrice:[0-9.]+|imagePriceInput:[0-9.]+|currency:(?:USD|AFN)|exchangeRate:[0-9.]+|priceInput:[0-9.]+|condition:[a-z]+|tooth:[0-9]{2})\])+\s*/i;

  return value.replace(metadataPrefix, '').trim();
};

const inferConditionFromText = (value?: string): ConditionKey | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (isConditionKey(normalized)) {
    return normalized;
  }

  if (normalized.includes('caries')) return 'caries';
  if (normalized.includes('surgery')) return 'surgery';
  if (normalized.includes('implant')) return 'implant';
  if (normalized.includes('gingivitis')) return 'gingivitis';
  if (normalized.includes('periodontitis')) return 'periodontitis';
  if (normalized.includes('removal') || normalized.includes('extract')) return 'removal';
  if (normalized.includes('periostitis')) return 'periostitis';

  return null;
};

const getToothRegion = (toothNumber: string): 'Maxilla' | 'Mandible' => {
  const firstDigit = Number(toothNumber[0]);
  return firstDigit <= 2 ? 'Maxilla' : 'Mandible';
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const resolveLocale = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0]?.trim() || 'en';
  }

  return value?.trim() || 'en';
};

const parseCurrency = (value: string): number => {
  const normalized = value.replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const bigint = Number.parseInt(normalized, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

export const TreatmentChartWorkspace = ({
  hidePatientVisitSelectors = false,
  initialPatientId,
  initialVisitId,
  lockPatientSelection = false,
  lockVisitSelection = false,
}: TreatmentChartWorkspaceProps = {}): JSX.Element => {
  const router = useRouter();
  const params = useParams<{ locale?: string | string[] }>();
  const locale = resolveLocale(params?.locale);
  const authenticatedUser = useAuthStore((state) => state.user);
  const authenticatedEmail = authenticatedUser?.email?.trim().toLowerCase() ?? '';
  const createVisitTreatment = useCreateVisitTreatment();
  const defaultPatientId = initialPatientId !== undefined && initialPatientId !== null
    ? String(initialPatientId)
    : '';
  const defaultVisitId = initialVisitId !== undefined && initialVisitId !== null
    ? String(initialVisitId)
    : '';

  const [activeCondition, setActiveCondition] = useState<ConditionKey>('implant');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(defaultPatientId);
  const [selectedVisitId, setSelectedVisitId] = useState<string>(defaultVisitId);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string>('');
  const [selectedToothNumber, setSelectedToothNumber] = useState<string>('25');
  const [currency, setCurrency] = useState<'AFN' | 'USD'>('USD');
  const [exchangeRate, setExchangeRate] = useState<string>(String(DEFAULT_AFN_PER_USD));
  const [price, setPrice] = useState<string>('');
  const [requiresImage, setRequiresImage] = useState<boolean>(false);
  const [imagePrice, setImagePrice] = useState<string>('');
  const [material, setMaterial] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [conditionOverrides, setConditionOverrides] = useState<Record<string, ConditionKey | null>>({});

  const { entities: patients } = usePatientList(1, 100);

  const visitFilters = useMemo(() => ({ patientId: [selectedPatientId || '-1'] }), [selectedPatientId]);
  const { entities: visits, isFetching: isLoadingVisits } = useVisitList(1, 100, '', [], ['patient', 'dentist'], visitFilters);

  const patientVisitIds = useMemo(() => visits.map((visit) => String(visit.id)), [visits]);
  const visitTreatmentFilters = useMemo(
    () => ({ visitId: patientVisitIds.length > 0 ? patientVisitIds : ['-1'] }),
    [patientVisitIds]
  );
  const { entities: visitTreatments, isFetching: isLoadingVisitTreatments } = useVisitTreatmentList(
    1,
    100,
    '',
    [],
    ['treatment', 'tooth', 'dentist'],
    visitTreatmentFilters
  );

  const { entities: treatments } = useTreatmentList(1, 100, '', [], [], { enabled: ['1'] });
  const { entities: teeth } = useToothList(1, 100);
  const { entities: staff } = useStaffList(1, 100, authenticatedEmail, ['email'], [], { enabled: ['1'] });

  const typedVisitTreatments = visitTreatments as VisitTreatmentWithRelations[];
  const selectedPatient = useMemo(
    () => patients.find((patient) => String(patient.id) === selectedPatientId),
    [patients, selectedPatientId]
  );
  const treatmentById = useMemo(
    () => new Map(treatments.map((treatment) => [String(treatment.id), treatment])),
    [treatments]
  );
  const visitById = useMemo(
    () => new Map(visits.map((visit) => [String(visit.id), visit])),
    [visits]
  );
  const toothById = useMemo(() => new Map(teeth.map((tooth) => [String(tooth.id), tooth])), [teeth]);
  const toothByNumber = useMemo(() => new Map(teeth.map((tooth) => [tooth.toothNumber, tooth])), [teeth]);

  const authenticatedDentist = useMemo(() => {
    if (!authenticatedEmail) {
      return null;
    }

    const matches = staff.filter(
      (member) => member.email && member.email.trim().toLowerCase() === authenticatedEmail
    );

    if (matches.length === 0) {
      return null;
    }

    return matches.find((member) => member.role === 'dentist') ?? matches[0];
  }, [authenticatedEmail, staff]);

  const selectedTreatment = selectedTreatmentId ? treatmentById.get(selectedTreatmentId) : undefined;
  const selectedVisit = selectedVisitId ? visitById.get(selectedVisitId) : undefined;
  const visitOrderIndexById = useMemo(() => {
    const sortedVisits = visits.slice().sort((left, right) => {
      const leftDate = new Date(left.visitDate || '').getTime();
      const rightDate = new Date(right.visitDate || '').getTime();

      if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate) && leftDate !== rightDate) {
        return leftDate - rightDate;
      }

      return String(left.id).localeCompare(String(right.id), undefined, { numeric: true, sensitivity: 'base' });
    });

    const map = new Map<string, number>();
    sortedVisits.forEach((visit, index) => {
      map.set(String(visit.id), index);
    });
    return map;
  }, [visits]);
  const selectedVisitOrderIndex = useMemo(() => {
    if (!selectedVisitId) return Number.POSITIVE_INFINITY;
    return visitOrderIndexById.get(String(selectedVisitId)) ?? Number.POSITIVE_INFINITY;
  }, [selectedVisitId, visitOrderIndexById]);

  const chartSourceTreatments = useMemo(() => {
    if (!selectedVisitId) return typedVisitTreatments;

    return typedVisitTreatments.filter((row) => {
      const rowVisitIndex = visitOrderIndexById.get(String(row.visitId));
      if (rowVisitIndex === undefined) return false;
      return rowVisitIndex <= selectedVisitOrderIndex;
    });
  }, [selectedVisitId, selectedVisitOrderIndex, typedVisitTreatments, visitOrderIndexById]);

  const orderedChartTreatments = useMemo(() => {
    const rows = [...chartSourceTreatments];
    rows.sort((left, right) => {
      const leftVisitIndex = visitOrderIndexById.get(String(left.visitId)) ?? Number.MAX_SAFE_INTEGER;
      const rightVisitIndex = visitOrderIndexById.get(String(right.visitId)) ?? Number.MAX_SAFE_INTEGER;
      if (leftVisitIndex !== rightVisitIndex) {
        return leftVisitIndex - rightVisitIndex;
      }

      const leftCreated = new Date(left.createdAt || '').getTime();
      const rightCreated = new Date(right.createdAt || '').getTime();
      if (!Number.isNaN(leftCreated) && !Number.isNaN(rightCreated) && leftCreated !== rightCreated) {
        return leftCreated - rightCreated;
      }

      return String(left.id).localeCompare(String(right.id), undefined, { numeric: true, sensitivity: 'base' });
    });
    return rows;
  }, [chartSourceTreatments, visitOrderIndexById]);

  const displayedVisitTreatments = useMemo(() => {
    const rows = selectedVisitId
      ? typedVisitTreatments.filter((row) => String(row.visitId) === String(selectedVisitId))
      : typedVisitTreatments;

    return rows.slice().sort((left, right) => {
      const leftCreated = new Date(left.createdAt || '').getTime();
      const rightCreated = new Date(right.createdAt || '').getTime();
      if (!Number.isNaN(leftCreated) && !Number.isNaN(rightCreated) && leftCreated !== rightCreated) {
        return rightCreated - leftCreated;
      }
      return String(right.id).localeCompare(String(left.id), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [selectedVisitId, typedVisitTreatments]);

  const resolveRowTeeth = useCallback((row: VisitTreatmentWithRelations): string[] => {
    const fromChartMetadata = Object.keys(parseToothConditionMapFromNotes(row.notes));
    if (fromChartMetadata.length > 0) {
      return fromChartMetadata;
    }

    const fromToothNumber = parseToothNumbersFromValue(row.toothNumber);
    if (fromToothNumber.length > 0) {
      return fromToothNumber;
    }

    const toothNumber =
      row.tooth?.toothNumber
      ?? toothById.get(String(row.toothId))?.toothNumber
      ?? parseToothNumberFromNotes(row.notes);

    return toothNumber ? [toothNumber] : [];
  }, [toothById]);
  const resolveRowConditionMap = useCallback((row: VisitTreatmentWithRelations): Record<string, ConditionKey> => {
    const fromChartMetadata = parseToothConditionMapFromNotes(row.notes);
    if (Object.keys(fromChartMetadata).length > 0) {
      return fromChartMetadata;
    }

    const condition =
      parseConditionFromNotes(row.notes)
      ?? inferConditionFromText(row.treatment?.category)
      ?? inferConditionFromText(row.treatment?.name);

    if (!condition) {
      return {};
    }

    const teeth = resolveRowTeeth(row);
    const mapped: Record<string, ConditionKey> = {};

    for (const toothNumber of teeth) {
      mapped[toothNumber] = condition;
    }

    return mapped;
  }, [resolveRowTeeth]);

  const baseConditions = useMemo(() => {
    const result: Record<string, ConditionKey | null> = {};
    for (const toothNumber of ALL_TEETH) {
      result[toothNumber] = null;
    }

    for (const row of orderedChartTreatments) {
      const rowConditionMap = resolveRowConditionMap(row);
      for (const [toothNumber, condition] of Object.entries(rowConditionMap)) {
        result[toothNumber] = condition;
      }
    }

    return result;
  }, [orderedChartTreatments, resolveRowConditionMap]);

  const toothConditions = useMemo(() => {
    return { ...baseConditions, ...conditionOverrides };
  }, [baseConditions, conditionOverrides]);

  const selectedCondition = toothConditions[selectedToothNumber] ?? null;
  const paintedTeeth = useMemo(
    () =>
      Object.entries(conditionOverrides)
        .filter((entry): entry is [string, ConditionKey] => entry[1] !== null)
        .map(([toothNumber, condition]) => ({ condition, toothNumber })),
    [conditionOverrides]
  );

  const conditionStats = useMemo(() => {
    const total = ALL_TEETH.length;

    return (Object.keys(CONDITIONS) as ConditionKey[]).map((key) => {
      const count = ALL_TEETH.filter((toothNumber) => toothConditions[toothNumber] === key).length;
      return {
        count,
        key,
        percent: Math.round((count / total) * 100),
      };
    });
  }, [toothConditions]);

  const canSave =
    !!selectedPatientId &&
    !!selectedTreatmentId &&
    !!selectedToothNumber &&
    price.trim().length > 0 &&
    !createVisitTreatment.isPending;

  useEffect(() => {
    void getExchangeRate(exchangeRateClient).then((rate) => {
      setExchangeRate(String(rate));
    });
  }, []);

  const doctorName = useMemo(() => {
    const fullName = [authenticatedUser?.firstName, authenticatedUser?.lastName]
      .map((item) => item?.trim())
      .filter(Boolean)
      .join(' ');

    return fullName || authenticatedUser?.email || 'Authenticated user';
  }, [authenticatedUser?.email, authenticatedUser?.firstName, authenticatedUser?.lastName]);
  const patientName = useMemo(() => {
    if (!selectedPatient) {
      return selectedPatientId ? `Patient #${selectedPatientId}` : 'N/A';
    }

    return [selectedPatient.firstName, selectedPatient.lastName].filter(Boolean).join(' ') || `Patient #${selectedPatient.id}`;
  }, [selectedPatient, selectedPatientId]);

  const handlePatientChange = (value: string): void => {
    if (lockPatientSelection) {
      return;
    }

    setSelectedPatientId(value);
    if (!lockVisitSelection) {
      setSelectedVisitId('');
    }
    setConditionOverrides({});
  };

  const handleTreatmentChange = (value: string): void => {
    setSelectedTreatmentId(value);
    const treatment = treatmentById.get(value);
    const defaultPriceUsd = roundCurrency(parseCurrency(treatment?.defaultPrice ?? ''));
    if (defaultPriceUsd <= 0) {
      setPrice('');
      return;
    }

    const rate = Math.max(0.000001, parseCurrency(exchangeRate) || DEFAULT_AFN_PER_USD);
    const amountInSelectedCurrency = currency === 'AFN'
      ? roundCurrency(defaultPriceUsd * rate)
      : defaultPriceUsd;
    setPrice(amountInSelectedCurrency.toFixed(2));
  };

  const paintTooth = (toothNumber: string): void => {
    setSelectedToothNumber(toothNumber);
    setConditionOverrides((previous) => ({
      ...previous,
      [toothNumber]: activeCondition,
    }));
  };

  const clearSelectedTooth = (): void => {
    setConditionOverrides((previous) => ({
      ...previous,
      [selectedToothNumber]: null,
    }));
  };

  const handleSave = async (): Promise<void> => {
    const visitIdForSave = selectedVisitId || (visits.length === 1 ? String(visits[0].id) : '');

    if (!canSave) {
      toast.error('Select patient, treatment, tooth, and price first.');
      return;
    }

    if (!visitIdForSave) {
      toast.error('Select a visit first. If there is no visit, create one for this patient.');
      return;
    }

    const normalizedRate = Math.max(0.000001, parseCurrency(exchangeRate) || DEFAULT_AFN_PER_USD);
    const rawPriceAmount = roundCurrency(parseCurrency(price));
    const normalizedPrice = currency === 'AFN'
      ? roundCurrency(rawPriceAmount / normalizedRate)
      : rawPriceAmount;
    if (normalizedPrice <= 0) {
      toast.error('Price must be greater than zero.');
      return;
    }

    const rawImageCharge = requiresImage ? roundCurrency(parseCurrency(imagePrice)) : 0;
    const imageCharge = requiresImage
      ? (currency === 'AFN' ? roundCurrency(rawImageCharge / normalizedRate) : rawImageCharge)
      : 0;
    if (requiresImage && imageCharge <= 0) {
      toast.error('Provide an image price when image is required.');
      return;
    }

    const targets = paintedTeeth.length > 0
      ? paintedTeeth
      : [{ condition: (toothConditions[selectedToothNumber] ?? activeCondition), toothNumber: selectedToothNumber }];
    const uniqueTargets = Array.from(
      new Map(targets.map((target) => [target.toothNumber, target])).values()
    );
    const chartMetadata = `[chart:${uniqueTargets.map((target) => `${target.toothNumber}=${CONDITION_CODES[target.condition]}`).join(',')}]`;
    const currencyMetadata = `[currency:${currency}][exchangeRate:${normalizedRate.toFixed(6)}][priceInput:${rawPriceAmount.toFixed(2)}]`;
    const imageMetadata = requiresImage
      ? `[image:1][imagePrice:${imageCharge.toFixed(2)}][imagePriceInput:${rawImageCharge.toFixed(2)}]`
      : '';
    const plainNote = notes.trim();
    const metadataSegments = [chartMetadata, currencyMetadata, imageMetadata].filter(Boolean).join('');
    const combinedNote = plainNote ? `${metadataSegments} ${plainNote}` : metadataSegments;
    if (combinedNote.length > 255) {
      toast.error('Notes are too long. Please shorten the note and try again.');
      return;
    }
    const primaryToothNumber = uniqueTargets[0]?.toothNumber ?? selectedToothNumber;
    const targetTooth = uniqueTargets.length === 1 ? toothByNumber.get(primaryToothNumber) : undefined;

    const payload: Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'> = {
      material: material.trim(),
      notes: combinedNote,
      price: normalizedPrice.toFixed(2),
      toothNumber: uniqueTargets.map((target) => target.toothNumber).join(','),
      treatmentId: selectedTreatmentId,
      visitId: visitIdForSave,
    };

    if (targetTooth) {
      payload.toothId = String(targetTooth.id);
    }

    if (authenticatedDentist) {
      payload.dentistId = String(authenticatedDentist.id);
    }

    const response = await createVisitTreatment.mutateAsync(payload);
    if (!response.success) {
      const errorText =
        typeof response.error?.details === 'string'
          ? response.error.details
          : response.error?.message || 'Failed to save treatment entry.';
      toast.error(errorText);
      return;
    }

    setConditionOverrides({});
    setNotes('');
    setMaterial('');
    setRequiresImage(false);
    setImagePrice('');

    const shouldStartBillingFlow =
      hidePatientVisitSelectors && lockPatientSelection && lockVisitSelection;

    if (shouldStartBillingFlow) {
      const searchParameters = new URLSearchParams({
        flow: 'chart',
        visitId: String(visitIdForSave),
      });
      toast.success('Treatment saved. Redirecting to payment and invoice flow.');
      router.push(`/${locale}/dental-management/invoices?${searchParameters.toString()}`);
      return;
    }

    toast.success('Treatment added to patient chart.');
  };

  const handlePrintRecord = (): void => {
    if (!selectedPatient) {
      toast.error('Select a patient first.');
      return;
    }

    if (displayedVisitTreatments.length === 0) {
      toast.error('No recorded treatments to print.');
      return;
    }

    const conditionStatsRows = (Object.keys(CONDITIONS) as ConditionKey[])
      .map((key) => {
        const count = conditionStats.find((item) => item.key === key)?.count ?? 0;
        const percent = conditionStats.find((item) => item.key === key)?.percent ?? 0;
        const color = CONDITIONS[key].color;
        return `
          <tr>
            <td>
              <span class="color-dot" style="background:${color};"></span>
              ${escapeHtml(CONDITIONS[key].label)}
            </td>
            <td>${count}</td>
            <td>${percent}%</td>
          </tr>
        `;
      })
      .join('');

    const renderArchCells = (arch: string[]): string => {
      return arch
        .map((toothNumber) => {
          const condition = toothConditions[toothNumber];
          const conditionLabel = condition ? CONDITIONS[condition].label : 'Healthy';
          const color = condition ? CONDITIONS[condition].color : '#ffffff';
          const backgroundColor = condition ? hexToRgba(color, 0.28) : '#ffffff';

          return `
            <td class="tooth-cell" style="background:${backgroundColor};border-color:${condition ? color : '#d1d5db'};">
              <div style="font-weight:700;font-size:12px;">${toothNumber}</div>
              <div style="font-size:10px;color:#374151;">${escapeHtml(conditionLabel)}</div>
            </td>
          `;
        })
        .join('');
    };

    const recordRows = displayedVisitTreatments
      .map((row) => {
        const teeth = resolveRowTeeth(row);
        const teethLabel = teeth.length > 0 ? teeth.join(', ') : '-';
        const treatmentName =
          row.treatment?.name || treatmentById.get(String(row.treatmentId))?.name || `Treatment ${row.treatmentId}`;
        const rowConditionMap = resolveRowConditionMap(row);
        const uniqueConditions = Array.from(new Set(Object.values(rowConditionMap)));
        const condition =
          uniqueConditions.length === 1
            ? uniqueConditions[0]
            : null;
        const conditionLabel =
          uniqueConditions.length === 0
            ? 'Unspecified'
            : uniqueConditions.length === 1
              ? CONDITIONS[uniqueConditions[0]].label
              : `Multiple (${uniqueConditions.map((key) => CONDITIONS[key].label).join(', ')})`;
        const conditionColor = condition ? CONDITIONS[condition].color : '#d1d5db';
        const conditionChipBackground = condition ? hexToRgba(conditionColor, 0.2) : '#ffffff';
        const cleanedNotes = stripMetadataPrefixes(row.notes);
        const visit = visitById.get(String(row.visitId));
        const visitLabel = visit
          ? (visit.tag
              ? `${visit.tag} (${visit.visitDate})`
              : `Visit ${visit.id} (${visit.visitDate})`)
          : `Visit ${row.visitId}`;

        return `
          <tr>
            <td>${escapeHtml(teethLabel)}</td>
            <td>${escapeHtml(treatmentName)}</td>
            <td>
              <span class="condition-chip" style="background:${conditionChipBackground};border-color:${conditionColor};">
                ${escapeHtml(conditionLabel)}
              </span>
            </td>
            <td>${escapeHtml(row.material || '-')}</td>
            <td>${escapeHtml(row.price || '-')}</td>
            <td>${escapeHtml(cleanedNotes || '-')}</td>
            <td>${escapeHtml(visitLabel)}</td>
          </tr>
        `;
      })
      .join('');

    const noteRows = displayedVisitTreatments
      .map((row) => {
        const cleanedNotes = stripMetadataPrefixes(row.notes);
        if (!cleanedNotes) {
          return '';
        }

        const teeth = resolveRowTeeth(row);
        const teethLabel = teeth.length > 0 ? teeth.join(', ') : '-';
        const treatmentName =
          row.treatment?.name || treatmentById.get(String(row.treatmentId))?.name || `Treatment ${row.treatmentId}`;

        return `
          <tr>
            <td>${escapeHtml(teethLabel)}</td>
            <td>${escapeHtml(treatmentName)}</td>
            <td>${escapeHtml(cleanedNotes)}</td>
          </tr>
        `;
      })
      .filter(Boolean)
      .join('');

    const now = new Date();
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Patient Treatment Record</title>
  <style>
    @page { size: auto; margin: 0; }
    html, body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { font-family: Arial, sans-serif; padding: 24px; margin: 14mm; color: #111827; }
    h1,h2,h3 { margin: 0 0 8px 0; }
    .section { margin-top: 18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .tooth-cell {
      border: 1px solid #d1d5db;
      padding: 6px;
      text-align: center;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .condition-chip { display:inline-block; padding:2px 8px; border:1px solid; border-radius:999px; font-size:11px; font-weight:600; }
    .color-dot { display:inline-block; width:10px; height:10px; border-radius:999px; margin-right:6px; vertical-align:middle; }
    .muted { color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Dental Treatment Record</h1>
  <p class="muted">Printed on ${escapeHtml(now.toLocaleString())}</p>

  <div class="section grid">
    <div class="box">
      <h3>Patient</h3>
      <p><strong>Name:</strong> ${escapeHtml(patientName)}</p>
      <p><strong>Code:</strong> ${escapeHtml(selectedPatient.patientCode || '-')}</p>
      <p><strong>Contact:</strong> ${escapeHtml(selectedPatient.contactNumber || '-')}</p>
    </div>
    <div class="box">
      <h3>Clinical Context</h3>
      <p><strong>Doctor:</strong> ${escapeHtml(doctorName)}</p>
      <p><strong>Selected Tooth:</strong> ${escapeHtml(selectedToothNumber)} (${escapeHtml(getToothRegion(selectedToothNumber))})</p>
    </div>
  </div>

  <div class="section">
    <h2>Teeth Chart</h2>
    <table>
      <tbody>
        <tr>${renderArchCells(UPPER_ARCH)}</tr>
        <tr>${renderArchCells(LOWER_ARCH)}</tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Condition Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Condition</th>
          <th>Teeth</th>
          <th>Percent</th>
        </tr>
      </thead>
      <tbody>${conditionStatsRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Recorded Treatments</h2>
    <table>
      <thead>
        <tr>
          <th>Teeth</th>
          <th>Treatment</th>
          <th>Condition</th>
          <th>Material</th>
          <th>Price</th>
          <th>Note</th>
          <th>Visit</th>
        </tr>
      </thead>
      <tbody>${recordRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Notes</h2>
    ${noteRows
    ? `<table>
      <thead>
        <tr>
          <th>Teeth</th>
          <th>Treatment</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>${noteRows}</tbody>
    </table>`
    : '<p class="muted">No notes were recorded for this patient.</p>'}
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDocument) {
      document.body.removeChild(iframe);
      toast.error('Unable to prepare print document.');
      return;
    }

    iframeDocument.open();
    iframeDocument.write(html);
    iframeDocument.close();

    let didPrint = false;

    const printAndCleanup = (): void => {
      if (didPrint) {
        return;
      }
      didPrint = true;

      const frameWindow = iframe.contentWindow;
      if (!frameWindow) {
        document.body.removeChild(iframe);
        toast.error('Unable to print right now.');
        return;
      }

      frameWindow.focus();
      frameWindow.print();

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    };

    iframe.onload = () => {
      printAndCleanup();
    };

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        printAndCleanup();
      }
    }, 150);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle>Treatment Chart</CardTitle>
          <CardDescription>
            Link treatments directly to a patient visit, set a condition color, and save the treatment details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4">
          <div className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-2 lg:grid-cols-3">
            {!hidePatientVisitSelectors ? (
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select value={selectedPatientId} onValueChange={handlePatientChange} disabled={lockPatientSelection}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={String(patient.id)}>
                        {[patient.firstName, patient.lastName].filter(Boolean).join(' ') || `Patient #${patient.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {!hidePatientVisitSelectors ? (
              <div className="space-y-2">
                <Label>Visit</Label>
                <Select
                  value={selectedVisitId}
                  onValueChange={(value) => {
                    if (!lockVisitSelection) {
                      setSelectedVisitId(value);
                      setConditionOverrides({});
                    }
                  }}
                  disabled={lockVisitSelection || !selectedPatientId || isLoadingVisits}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoadingVisits ? 'Loading visits...' : 'Select visit'} />
                  </SelectTrigger>
                  <SelectContent>
                    {visits.map((visit) => (
                      <SelectItem key={visit.id} value={String(visit.id)}>
                        {visit.tag ? `${visit.tag} - ${visit.visitDate}` : `Visit ${visit.id} - ${visit.visitDate}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPatientId && !isLoadingVisits && visits.length === 0 ? (
                  <p className="text-xs text-destructive">No visits found for this patient. Create a visit first.</p>
                ) : null}
              </div>
            ) : null}

            {hidePatientVisitSelectors ? (
              <div className="rounded-md border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground md:col-span-2 lg:col-span-3">
                <p>
                  Linked patient: <span className="font-semibold text-foreground">{patientName}</span>
                </p>
                <p className="mt-1">
                  Linked visit:{' '}
                  <span className="font-semibold text-foreground">
                    {selectedVisit
                      ? (selectedVisit.tag ? `${selectedVisit.tag} (${selectedVisit.visitDate})` : `Visit #${selectedVisit.id}`)
                      : (selectedVisitId ? `Visit #${selectedVisitId}` : 'Not selected')}
                  </span>
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Treatment</Label>
              <Select value={selectedTreatmentId} onValueChange={handleTreatmentChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select treatment" />
                </SelectTrigger>
                <SelectContent>
                  {treatments.map((treatment) => (
                    <SelectItem key={treatment.id} value={String(treatment.id)}>
                      {`${treatment.name} (${treatment.category})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                }}
                placeholder="e.g. 100.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={(value) => {
                  setCurrency(value as 'AFN' | 'USD');
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="AFN">AFN (Afghani)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Exchange Rate (AFN per 1 USD)</Label>
              <Input
                value={exchangeRate}
                onChange={(event) => {
                  setExchangeRate(event.target.value);
                }}
                placeholder="e.g. 70"
                disabled={currency === 'USD'}
              />
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requiresImage}
                  onChange={(event) => {
                    setRequiresImage(event.target.checked);
                    if (!event.target.checked) {
                      setImagePrice('');
                    }
                  }}
                />
                Need Image
              </Label>
              <Input
                value={imagePrice}
                onChange={(event) => {
                  setImagePrice(event.target.value);
                }}
                placeholder="Image price (e.g. 25.00)"
                disabled={!requiresImage}
              />
            </div>

            <div className="space-y-2">
              <Label>Material (manual)</Label>
              <Input
                value={material}
                onChange={(event) => {
                  setMaterial(event.target.value);
                }}
                placeholder="e.g. Composite resin"
              />
            </div>

            <div className="space-y-2">
              <Label>Note</Label>
              <textarea
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                }}
                rows={4}
                placeholder="Enter treatment note"
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
            {(Object.keys(CONDITIONS) as ConditionKey[]).map((conditionKey) => {
              const condition = CONDITIONS[conditionKey];
              const isActive = conditionKey === activeCondition;

              return (
                <Button
                  key={conditionKey}
                  type="button"
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setActiveCondition(conditionKey);
                  }}
                  className="gap-2"
                >
                  <span
                    className="size-2.5 rounded-full border"
                    style={{ backgroundColor: condition.color, borderColor: condition.color }}
                  />
                  {condition.label}
                </Button>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={clearSelectedTooth} className="ml-auto gap-2">
              <Eraser className="size-4" />
              Clear Selected
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Maxilla</p>
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-16">
              {UPPER_ARCH.map((toothNumber) => {
                const condition = toothConditions[toothNumber];
                const isSelected = selectedToothNumber === toothNumber;

                return (
                  <button
                    key={toothNumber}
                    type="button"
                    onClick={() => {
                      paintTooth(toothNumber);
                    }}
                    className={cn(
                      'relative h-12 min-w-0 rounded-lg border text-[10px] font-medium transition hover:scale-[1.03] active:scale-[0.98]',
                      isSelected ? 'ring-2 ring-offset-1' : ''
                    )}
                    style={{
                      backgroundColor: condition ? `${CONDITIONS[condition].color}33` : '#FFFFFF',
                      borderColor: condition ? CONDITIONS[condition].color : '#d4d4d8',
                      boxShadow: isSelected ? `0 0 0 2px ${condition ? CONDITIONS[condition].color : '#94a3b8'}` : 'none',
                      color: '#1f2937',
                    }}
                    aria-label={`Tooth ${toothNumber}`}
                  >
                    <span className="absolute left-1 top-1 text-[9px] leading-none">{toothNumber}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mandible</p>
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-16">
              {LOWER_ARCH.map((toothNumber) => {
                const condition = toothConditions[toothNumber];
                const isSelected = selectedToothNumber === toothNumber;

                return (
                  <button
                    key={toothNumber}
                    type="button"
                    onClick={() => {
                      paintTooth(toothNumber);
                    }}
                    className={cn(
                      'relative h-12 min-w-0 rounded-lg border text-[10px] font-medium transition hover:scale-[1.03] active:scale-[0.98]',
                      isSelected ? 'ring-2 ring-offset-1' : ''
                    )}
                    style={{
                      backgroundColor: condition ? `${CONDITIONS[condition].color}33` : '#FFFFFF',
                      borderColor: condition ? CONDITIONS[condition].color : '#d4d4d8',
                      boxShadow: isSelected ? `0 0 0 2px ${condition ? CONDITIONS[condition].color : '#94a3b8'}` : 'none',
                      color: '#1f2937',
                    }}
                    aria-label={`Tooth ${toothNumber}`}
                  >
                    <span className="absolute left-1 top-1 text-[9px] leading-none">{toothNumber}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(CONDITIONS) as ConditionKey[]).map((key) => {
              const count = conditionStats.find((item) => item.key === key)?.count ?? 0;
              const percent = conditionStats.find((item) => item.key === key)?.percent ?? 0;

              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{CONDITIONS[key].label}</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        backgroundColor: CONDITIONS[key].color,
                        width: `${percent}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{count} teeth</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-background p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Selected tooth: <span className="text-primary">{selectedToothNumber}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedTreatment
                  ? `Treatment: ${selectedTreatment.name} (${selectedTreatment.category})`
                  : 'Select a treatment to save the selected condition on this tooth.'}
              </p>
            </div>
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              {createVisitTreatment.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save Treatment
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle>Selected</CardTitle>
          <CardDescription>Patient context, authenticated doctor, and selected tooth details from patient records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4">
          <div className="rounded-lg border bg-background p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">
                {getToothRegion(selectedToothNumber)} {selectedToothNumber}
              </p>
              {selectedCondition ? (
                <Badge style={{ backgroundColor: CONDITIONS[selectedCondition].color, color: '#111827' }}>
                  {CONDITIONS[selectedCondition].label}
                </Badge>
              ) : (
                <Badge variant="outline">Healthy</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Last manipulation: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="rounded-lg border bg-background p-4 text-sm">
            <p className="mb-2 flex items-center gap-2 font-medium">
              <UserRound className="size-4" />
              Patient
            </p>
            {selectedPatient ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  {[selectedPatient.firstName, selectedPatient.lastName].filter(Boolean).join(' ') || `Patient #${selectedPatient.id}`}
                </p>
                <p>{selectedPatient.patientCode}</p>
                <p>{selectedPatient.contactNumber || '-'}</p>
              </div>
            ) : selectedPatientId ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Patient #{selectedPatientId}</p>
                <p>Patient details are outside the current fetch range.</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Select a patient to link the chart.</p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border bg-background p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Doctor</span>
              <span className="font-medium">{doctorName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Planned action</span>
              <span className="font-medium">{selectedCondition ? CONDITIONS[selectedCondition].label : 'Monitoring'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Material</span>
              <span className="font-medium">{material || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Treatment</span>
              <span className="font-medium">{selectedTreatment?.name || '-'}</span>
            </div>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Paintbrush className="size-4" />
              Paint mode
            </p>
            <p className="text-xs text-muted-foreground">
              Active condition: <span className="font-medium">{CONDITIONS[activeCondition].label}</span>. Click any tooth to apply this color.
            </p>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Recorded Treatments (Patient Record)</p>
              <div className="flex items-center gap-2">
                {isLoadingVisitTreatments ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePrintRecord}
                  disabled={!selectedPatient || displayedVisitTreatments.length === 0}
                  className="gap-2"
                >
                  <Printer className="size-4" />
                  Print
                </Button>
              </div>
            </div>
            {displayedVisitTreatments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {selectedVisitId ? 'No treatment records yet for this visit.' : 'No treatment records yet for this patient.'}
              </p>
            ) : (
              <div className="space-y-2">
                {displayedVisitTreatments.map((row) => {
                  const teeth = resolveRowTeeth(row);
                  const teethLabel = teeth.length > 0 ? teeth.join(', ') : '-';
                  const treatmentName =
                    row.treatment?.name || treatmentById.get(String(row.treatmentId))?.name || `Treatment ${row.treatmentId}`;
                  const rowConditionMap = resolveRowConditionMap(row);
                  const uniqueConditions = Array.from(new Set(Object.values(rowConditionMap)));
                  const cleanedNotes = stripMetadataPrefixes(row.notes);
                  const visit = visitById.get(String(row.visitId));

                  return (
                    <div key={row.id} className="rounded-md border p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-semibold">
                          {treatmentName}
                        </p>
                        <Badge variant="outline">Total: {row.price || '-'}</Badge>
                      </div>
                      <p className="mb-1 text-xs text-muted-foreground">Teeth: {teethLabel}</p>
                      <div className="mb-1 flex items-center gap-2">
                        {uniqueConditions.length > 0 ? (
                          uniqueConditions.map((condition) => (
                            <Badge key={`${row.id}-${condition}`} style={{ backgroundColor: CONDITIONS[condition].color, color: '#111827' }}>
                              {CONDITIONS[condition].label}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">Unspecified</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Material: {row.material || '-'}</p>
                      <p className="text-xs text-muted-foreground">Note: {cleanedNotes || '-'}</p>
                      <p className="text-xs text-muted-foreground">
                        Visit: {visit
                          ? (visit.tag
                              ? `${visit.tag} (${visit.visitDate})`
                              : `Visit ${visit.id} (${visit.visitDate})`)
                          : `Visit ${row.visitId}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-background p-4 text-sm">
            <p className="mb-2 flex items-center gap-2 font-medium">
              <Stethoscope className="size-4" />
              Authenticated Doctor Mapping
            </p>
            <p className="text-xs text-muted-foreground">
              {authenticatedDentist
                ? `Linked staff record: #${authenticatedDentist.id}`
                : 'No linked staff by email. Create a staff record with the same email as the logged-in user.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
