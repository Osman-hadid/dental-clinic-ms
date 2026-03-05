'use client';

import { JSX, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/modules/auth/application/stores/auth-store';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
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

type InventoryMaterialOption = {
  category: string;
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
};

type InventoryPaginatedResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: { currentPage?: number; lastPage?: number };
};

type MaterialSelectionRow = {
  key: string;
  inventoryItemId: string;
  quantity: string;
};

type PrescriptionFoodTiming = 'before_food' | 'after_food' | 'with_food' | 'anytime';

type PrescriptionSelectionRow = {
  amount: string;
  key: string;
  foodTiming: PrescriptionFoodTiming | '';
  frequency: string;
  name: string;
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
type ToothVisualType =
  | 'central_incisor'
  | 'lateral_incisor'
  | 'canine'
  | 'first_premolar'
  | 'second_premolar'
  | 'first_molar'
  | 'second_molar'
  | 'third_molar';
type ToothArch = 'maxilla' | 'mandible';
type ToothDisplayMeta = {
  fullLabel: string;
  shortLabel: string;
  visualType: ToothVisualType;
};
type ToothGlyphSpec = {
  crownPath: string;
  mandibularRoots: number;
  maxillaryRoots: number;
  rootTipY: number;
  rootWidth: number;
};

const TOOTH_POSITION_META: Record<number, ToothDisplayMeta> = {
  1: { fullLabel: 'Central Incisor', shortLabel: 'CI', visualType: 'central_incisor' },
  2: { fullLabel: 'Lateral Incisor', shortLabel: 'LI', visualType: 'lateral_incisor' },
  3: { fullLabel: 'Canine', shortLabel: 'C', visualType: 'canine' },
  4: { fullLabel: 'First Premolar', shortLabel: 'P1', visualType: 'first_premolar' },
  5: { fullLabel: 'Second Premolar', shortLabel: 'P2', visualType: 'second_premolar' },
  6: { fullLabel: 'First Molar', shortLabel: 'M1', visualType: 'first_molar' },
  7: { fullLabel: 'Second Molar', shortLabel: 'M2', visualType: 'second_molar' },
  8: { fullLabel: 'Third Molar (Wisdom)', shortLabel: 'M3', visualType: 'third_molar' },
};
const TOOTH_GLYPH_SPECS: Record<ToothVisualType, ToothGlyphSpec> = {
  canine: {
    crownPath: 'M25 36 C22 25 26 18 31 9 C33 6 39 6 41 9 C46 18 50 25 47 36 Z',
    mandibularRoots: 1,
    maxillaryRoots: 1,
    rootTipY: 80,
    rootWidth: 4.2,
  },
  central_incisor: {
    crownPath: 'M24 35 C20 23 22 14 28 10 C32 7 40 7 44 10 C50 14 52 23 48 35 Z',
    mandibularRoots: 1,
    maxillaryRoots: 1,
    rootTipY: 76,
    rootWidth: 3.8,
  },
  first_molar: {
    crownPath: 'M15 37 C13 27 18 19 24 15 C29 12 33 13 36 15 C39 12 43 12 48 15 C54 19 59 27 57 37 Z',
    mandibularRoots: 2,
    maxillaryRoots: 3,
    rootTipY: 82,
    rootWidth: 4.8,
  },
  first_premolar: {
    crownPath: 'M20 36 C18 25 22 16 28 12 C32 10 40 10 44 12 C50 16 54 25 52 36 Z',
    mandibularRoots: 1,
    maxillaryRoots: 2,
    rootTipY: 79,
    rootWidth: 4.4,
  },
  lateral_incisor: {
    crownPath: 'M25 35 C21 24 23 15 29 11 C33 9 39 9 43 11 C49 15 51 24 47 35 Z',
    mandibularRoots: 1,
    maxillaryRoots: 1,
    rootTipY: 77,
    rootWidth: 3.9,
  },
  second_molar: {
    crownPath: 'M16 37 C14 28 19 20 25 16 C30 13 34 14 36 16 C38 14 42 13 47 16 C53 20 58 28 56 37 Z',
    mandibularRoots: 2,
    maxillaryRoots: 3,
    rootTipY: 80,
    rootWidth: 4.7,
  },
  second_premolar: {
    crownPath: 'M19 36 C17 26 22 17 28 13 C33 11 39 11 44 13 C50 17 55 26 53 36 Z',
    mandibularRoots: 1,
    maxillaryRoots: 2,
    rootTipY: 78,
    rootWidth: 4.3,
  },
  third_molar: {
    crownPath: 'M15 38 C13 30 17 22 24 18 C28 16 31 15 34 17 C37 14 41 14 45 17 C52 20 58 29 57 38 C53 39 49 41 43 42 C39 43 33 43 29 42 C23 41 19 40 15 38 Z',
    mandibularRoots: 2,
    maxillaryRoots: 3,
    rootTipY: 79,
    rootWidth: 4.5,
  },
};
const PRESCRIPTION_FREQUENCY_OPTIONS = [
  'Once per day',
  'Twice per day',
  'Three times per day',
  'Every 8 hours',
  'Every 12 hours',
  'As needed',
] as const;
const PRESCRIPTION_FOOD_TIMING_LABELS: Record<PrescriptionFoodTiming, string> = {
  after_food: 'After food',
  anytime: 'Anytime',
  before_food: 'Before food',
  with_food: 'With food',
};
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
const isConditionKey = (value: string): value is ConditionKey => {
  return value in CONDITIONS;
};

const isToothNumber = (value: string): boolean => /^[0-9]{2}$/.test(value);

const resolveToothDisplayMeta = (toothNumber: string): ToothDisplayMeta => {
  const position = Number.parseInt(toothNumber[1] || '', 10);
  return TOOTH_POSITION_META[position] ?? {
    fullLabel: 'Tooth',
    shortLabel: '?',
    visualType: 'central_incisor',
  };
};

const resolveToothQuadrantCode = (toothNumber: string): string => {
  const quadrant = toothNumber.charAt(0);
  const position = toothNumber.charAt(1);
  const prefix = quadrant === '1'
    ? 'UR'
    : quadrant === '2'
      ? 'UL'
      : quadrant === '3'
        ? 'LL'
        : 'LR';
  return `${prefix}${position}`;
};

const rootCentersByCount = (count: number): number[] => {
  if (count <= 1) return [36];
  if (count === 2) return [30, 42];
  return [24, 36, 48];
};

const TOOTH_SURFACE_DETAILS: Record<ToothVisualType, string[]> = {
  canine: [
    'M35 12 C35.5 20 35.5 27 35 35',
  ],
  central_incisor: [
    'M31 13 C33 20 33 27 32 34',
    'M41 13 C39 20 39 27 40 34',
  ],
  first_molar: [
    'M23 21 C28 18 32 18 36 21',
    'M36 21 C40 18 44 18 49 21',
    'M28 29 C33 26 39 26 44 29',
  ],
  first_premolar: [
    'M27 20 C31 17 35 17 39 20',
    'M33 29 C35 27 37 27 39 29',
  ],
  lateral_incisor: [
    'M31 14 C32.5 21 32.5 27 32 34',
    'M40 14 C38.5 21 38.5 27 39 34',
  ],
  second_molar: [
    'M24 22 C29 19 33 19 36.5 22',
    'M36.5 22 C40 19 44 19 48 22',
    'M29 29 C34 27 39 27 43.5 29',
  ],
  second_premolar: [
    'M28 21 C32 18 36 18 40 21',
    'M33 29 C36 27 39 27 41 29',
  ],
  third_molar: [
    'M22 22 C27 19 31 19 35 22',
    'M35 22 C39 19 43 19 47 22',
    'M27 30 C32 28 38 28 43 30',
  ],
};

const buildRootPath = (
  centerX: number,
  startY: number,
  tipY: number,
  rootWidth: number,
  leftTilt: number,
  rightTilt: number
): string => {
  const controlY = (startY + tipY) / 2;
  return `M${(centerX - rootWidth).toFixed(2)} ${startY.toFixed(2)} C${(centerX - rootWidth * 1.15 - leftTilt).toFixed(2)} ${controlY.toFixed(2)} ${(centerX - rootWidth * 0.5 - leftTilt).toFixed(2)} ${(tipY - 2).toFixed(2)} ${centerX.toFixed(2)} ${tipY.toFixed(2)} C${(centerX + rootWidth * 0.5 + rightTilt).toFixed(2)} ${(tipY - 2).toFixed(2)} ${(centerX + rootWidth * 1.15 + rightTilt).toFixed(2)} ${controlY.toFixed(2)} ${(centerX + rootWidth).toFixed(2)} ${startY.toFixed(2)} Z`;
};

const ToothGlyph = ({
  arch,
  isActive,
  visualType,
}: {
  arch: ToothArch;
  isActive: boolean;
  visualType: ToothVisualType;
}): JSX.Element => {
  const uid = useId().replace(/:/g, '-');
  const spec = TOOTH_GLYPH_SPECS[visualType];
  const rootCount = arch === 'maxilla' ? spec.maxillaryRoots : spec.mandibularRoots;
  const rootCenters = rootCentersByCount(rootCount);
  const crownDetailPaths = TOOTH_SURFACE_DETAILS[visualType];
  const crownGradientId = `${uid}-crown`;
  const rootGradientId = `${uid}-root`;
  const glossGradientId = `${uid}-gloss`;
  const strokeColor = isActive ? '#e5e7eb' : '#c3ccd8';
  const crownHighlight = '#ffffff';
  const crownBase = isActive ? '#f4f6f8' : '#eef1f4';
  const crownDepth = isActive ? '#d9e0e8' : '#d5dde6';
  const rootTop = isActive ? '#eef2f6' : '#e5ebf2';
  const rootBottom = isActive ? '#c7d1dc' : '#c0cad7';
  const detailColor = isActive ? 'rgba(255,255,255,0.56)' : 'rgba(100,116,139,0.3)';
  const shadowColor = isActive ? 'rgba(88, 28, 135, 0.42)' : 'rgba(15, 23, 42, 0.22)';

  return (
    <svg viewBox="0 0 72 88" className="h-16 w-16" aria-hidden="true">
      <defs>
        <linearGradient id={crownGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={crownHighlight} />
          <stop offset="55%" stopColor={crownBase} />
          <stop offset="100%" stopColor={crownDepth} />
        </linearGradient>
        <linearGradient id={rootGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={rootTop} />
          <stop offset="100%" stopColor={rootBottom} />
        </linearGradient>
        <radialGradient id={glossGradientId} cx="34%" cy="22%" r="55%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.78)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <path
        d={spec.crownPath}
        fill={`url(#${crownGradientId})`}
        stroke={strokeColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        style={{ filter: `drop-shadow(0 2px 3px ${shadowColor})` }}
      />
      <path
        d={spec.crownPath}
        fill={`url(#${glossGradientId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 34 C28 32 44 32 50 34"
        fill="none"
        stroke="rgba(148,163,184,0.35)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
      />
      {crownDetailPaths.map((detailPath, index) => (
        <path
          key={`${visualType}-detail-${index}`}
          d={detailPath}
          fill="none"
          stroke={detailColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.1}
        />
      ))}
      {rootCenters.map((centerX, index) => (
        <path
          key={`${visualType}-${arch}-root-${index}`}
          d={buildRootPath(
            centerX,
            35,
            spec.rootTipY + (rootCount === 3 && index === 1 ? 3 : 0),
            spec.rootWidth,
            rootCount === 3 && index === 0 ? 1.6 : 0.6,
            rootCount === 3 && index === rootCount - 1 ? 1.6 : 0.6
          )}
          fill={`url(#${rootGradientId})`}
          stroke={strokeColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          style={{ filter: `drop-shadow(0 1px 2px ${shadowColor})` }}
        />
      ))}
    </svg>
  );
};

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

const parseImageChargeFromNotes = (value?: string): string => {
  if (!value) {
    return '-';
  }

  const imageRequiredMatch = value.match(/\[image:([01])\]/i);
  if (!imageRequiredMatch || imageRequiredMatch[1] !== '1') {
    return '-';
  }

  const imagePriceMatch = value.match(/\[imagePrice:([0-9]+(?:\.[0-9]+)?)\]/i);
  if (!imagePriceMatch) {
    return 'Required';
  }

  const parsed = Number(imagePriceMatch[1]);
  if (!Number.isFinite(parsed)) {
    return 'Required';
  }

  return `${parsed.toFixed(2)} AFN`;
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
    /^(?:\[(?:chart:[^\]]+|image:[01]|imagePrice:[0-9.]+|imagePriceInput:[0-9.]+|currency:(?:AFN)|exchangeRate:[0-9.]+|priceInput:[0-9.]+|condition:[a-z]+|tooth:[0-9]{2})\])+\s*/i;

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

const asText = (value: unknown): string => {
  if (typeof value === 'number') return String(value).trim();
  if (typeof value === 'string') return value.trim();
  return '';
};

const asNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(asText(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const bigint = Number.parseInt(normalized, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const createMaterialSelectionRow = (): MaterialSelectionRow => ({
  inventoryItemId: '',
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  quantity: '1',
});

const createPrescriptionSelectionRow = (): PrescriptionSelectionRow => ({
  amount: '',
  foodTiming: '',
  frequency: '',
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
});

const formatPrescriptionSummary = (
  prescription?: Partial<{
    amount: string;
    content: string;
    foodTiming: string;
    frequency: string;
    items: Array<{
      amount?: string;
      foodTiming?: string;
      frequency?: string;
      name?: string;
    }>;
    name: string;
  }>
): string => {
  if (!prescription) return '-';

  const formatSingle = (source: Partial<{
    amount: string;
    foodTiming: string;
    frequency: string;
    name: string;
  }>): string => {
    const name = source.name?.trim() || '';
    const amount = source.amount?.trim() || '';
    const frequency = source.frequency?.trim() || '';
    const foodTimingRaw = source.foodTiming?.trim() || '';
    const foodTiming = (foodTimingRaw in PRESCRIPTION_FOOD_TIMING_LABELS
      ? PRESCRIPTION_FOOD_TIMING_LABELS[foodTimingRaw as PrescriptionFoodTiming]
      : foodTimingRaw);

    if (!name && !amount && !frequency && !foodTiming) {
      return '';
    }

    const dose = amount;
    const parts = [
      name ? (dose ? `${name} (${dose})` : name) : dose,
      frequency,
      foodTiming,
    ].filter(Boolean);

    return parts.join(', ');
  };

  if (Array.isArray(prescription.items) && prescription.items.length > 0) {
    const rows = prescription.items
      .map((item) => formatSingle(item))
      .filter(Boolean);
    if (rows.length > 0) {
      return rows.join('; ');
    }
  }

  const single = formatSingle({
    amount: prescription.amount,
    foodTiming: prescription.foodTiming,
    frequency: prescription.frequency,
    name: prescription.name,
  });
  if (single !== '') {
    return single;
  }

  if (single === '') {
    return prescription.content?.trim() || '-';
  }
  return '-';
};

const inventoryApiClient = new AxiosClient();

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
  const [price, setPrice] = useState<string>('');
  const [requiresImage, setRequiresImage] = useState<boolean>(false);
  const [imagePrice, setImagePrice] = useState<string>('');
  const [materialSelections, setMaterialSelections] = useState<MaterialSelectionRow[]>([]);
  const [inventoryMaterials, setInventoryMaterials] = useState<InventoryMaterialOption[]>([]);
  const [isLoadingInventoryMaterials, setIsLoadingInventoryMaterials] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [prescriptionSelections, setPrescriptionSelections] = useState<PrescriptionSelectionRow[]>([]);
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
    ['treatment', 'tooth', 'dentist', 'prescription', 'prescription.items', 'materialItems'],
    visitTreatmentFilters
  );

  const { entities: treatments } = useTreatmentList(1, 100, '', [], [], { enabled: ['1'] });
  const { entities: teeth } = useToothList(1, 100);
  const { entities: staff } = useStaffList(1, 100, authenticatedEmail, ['email'], [], { enabled: ['1'] });
  const inventoryMaterialsById = useMemo(
    () => new Map(inventoryMaterials.map((item) => [item.id, item])),
    [inventoryMaterials]
  );

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
  const resolveRowMaterialSummary = useCallback((row: VisitTreatmentWithRelations): string => {
    const directMaterial = row.material?.trim();
    if (directMaterial) {
      return directMaterial;
    }

    if (!Array.isArray(row.materialItems) || row.materialItems.length === 0) {
      return '-';
    }

    const parts = row.materialItems
      .map((item) => {
        const itemNameFromRow = 'itemName' in item ? item.itemName : undefined;
        const itemName = typeof itemNameFromRow === 'string' && itemNameFromRow.trim() !== ''
          ? itemNameFromRow.trim()
          : `Item #${item.inventoryItemId ?? '-'}`;
        const quantityUsed = 'quantityUsed' in item ? item.quantityUsed : undefined;
        const quantityFromPayload = 'quantity' in item ? item.quantity : undefined;
        const quantity = typeof quantityUsed === 'number'
          ? quantityUsed
          : Number(quantityFromPayload ?? 0);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return itemName;
        }
        return `${itemName} x${quantity}`;
      })
      .filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : '-';
  }, []);

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

  const doctorName = useMemo(() => {
    const visitDentistName = selectedVisit?.dentistName?.trim() || '';
    if (visitDentistName) {
      return visitDentistName;
    }

    const mappedStaffName = authenticatedDentist?.fullName?.trim() || '';
    if (mappedStaffName) {
      return mappedStaffName;
    }

    return 'Unassigned doctor';
  }, [
    authenticatedDentist?.fullName,
    selectedVisit?.dentistName,
  ]);
  const patientName = useMemo(() => {
    if (!selectedPatient) {
      return selectedPatientId ? `Patient #${selectedPatientId}` : 'N/A';
    }

    return [selectedPatient.firstName, selectedPatient.lastName].filter(Boolean).join(' ') || `Patient #${selectedPatient.id}`;
  }, [selectedPatient, selectedPatientId]);
  const materialSummary = useMemo(() => {
    const parts = materialSelections
      .map((selection) => {
        const inventoryItemId = selection.inventoryItemId.trim();
        if (!inventoryItemId) return '';

        const quantity = Number.parseInt(selection.quantity.trim(), 10);
        if (!Number.isFinite(quantity) || quantity <= 0) return '';

        const item = inventoryMaterialsById.get(inventoryItemId);
        const itemName = item?.itemName || `Item #${inventoryItemId}`;
        return `${itemName} x${quantity}`;
      })
      .filter(Boolean);

    return parts.join(', ');
  }, [inventoryMaterialsById, materialSelections]);
  const prescriptionDraftSummary = useMemo(() => {
    const items = prescriptionSelections
      .map((item) => ({
        amount: item.amount.trim(),
        foodTiming: item.foodTiming || undefined,
        frequency: item.frequency.trim(),
        name: item.name.trim(),
      }))
      .filter((item) => item.name || item.amount || item.frequency || item.foodTiming);

    return formatPrescriptionSummary({ items });
  }, [prescriptionSelections]);

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
    const defaultPrice = roundCurrency(parseCurrency(treatment?.defaultPrice ?? ''));
    if (defaultPrice <= 0) {
      setPrice('');
      return;
    }

    setPrice(defaultPrice.toFixed(2));
  };

  const addMaterialSelection = (): void => {
    setMaterialSelections((previous) => [...previous, createMaterialSelectionRow()]);
  };

  const updateMaterialSelection = (
    key: string,
    patch: Partial<Pick<MaterialSelectionRow, 'inventoryItemId' | 'quantity'>>
  ): void => {
    setMaterialSelections((previous) =>
      previous.map((selection) => (selection.key === key ? { ...selection, ...patch } : selection))
    );
  };

  const removeMaterialSelection = (key: string): void => {
    setMaterialSelections((previous) => previous.filter((selection) => selection.key !== key));
  };

  const addPrescriptionSelection = (): void => {
    setPrescriptionSelections((previous) => [...previous, createPrescriptionSelectionRow()]);
  };

  const updatePrescriptionSelection = (
    key: string,
    patch: Partial<Omit<PrescriptionSelectionRow, 'key'>>
  ): void => {
    setPrescriptionSelections((previous) =>
      previous.map((selection) => (selection.key === key ? { ...selection, ...patch } : selection))
    );
  };

  const removePrescriptionSelection = (key: string): void => {
    setPrescriptionSelections((previous) => previous.filter((selection) => selection.key !== key));
  };

  const fetchInventoryMaterials = useCallback(async (): Promise<void> => {
    setIsLoadingInventoryMaterials(true);

    try {
      const allRows: Array<Record<string, unknown>> = [];
      let page = 1;

      while (true) {
        const response = await inventoryApiClient.get<InventoryPaginatedResponse>(
          '/api/v1/dental-management/inventory-items',
          {
            params: { page, perPage: 100, sortBy: 'entryDate', sortDirection: 'desc' },
          }
        );

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to fetch inventory materials.');
        }

        const payload = response.data;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        allRows.push(...rows);

        const currentPage = Number(payload?.meta?.currentPage ?? page);
        const lastPage = Number(payload?.meta?.lastPage ?? currentPage);
        if (rows.length === 0 || currentPage >= lastPage) break;
        page += 1;
      }

      const uniqueMaterials = new Map<string, InventoryMaterialOption>();
      for (const row of allRows) {
        const id = asText(row.id);
        const itemName = asText(row.itemName ?? row.item_name);
        if (!id || !itemName) continue;

        uniqueMaterials.set(id, {
          category: asText(row.category),
          id,
          itemName,
          quantity: asNumber(row.quantity),
          unit: asText(row.unit) || 'unit',
        });
      }

      const materials = Array.from(uniqueMaterials.values())
        .sort((left, right) => left.itemName.localeCompare(right.itemName, undefined, { sensitivity: 'base' }));
      setInventoryMaterials(materials);
    } catch {
      toast.error('Failed to load inventory materials.');
    } finally {
      setIsLoadingInventoryMaterials(false);
    }
  }, []);

  useEffect(() => {
    void fetchInventoryMaterials();
  }, [fetchInventoryMaterials]);

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

    const rawPriceAmount = roundCurrency(parseCurrency(price));
    if (rawPriceAmount <= 0) {
      toast.error('Price must be greater than zero.');
      return;
    }

    const rawImageCharge = requiresImage ? roundCurrency(parseCurrency(imagePrice)) : 0;
    if (requiresImage && rawImageCharge <= 0) {
      toast.error('Provide an image price when image is required.');
      return;
    }

    const normalizedMaterialItemsMap = new Map<string, { inventoryItemId: string; quantity: number }>();
    for (const selection of materialSelections) {
      const inventoryItemId = selection.inventoryItemId.trim();
      const quantityRaw = selection.quantity.trim();
      if (!inventoryItemId && !quantityRaw) {
        continue;
      }
      if (!inventoryItemId) {
        toast.error('Select an inventory item for each material row.');
        return;
      }

      const quantity = Number.parseInt(quantityRaw, 10);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error('Material quantity must be a positive whole number.');
        return;
      }

      const previous = normalizedMaterialItemsMap.get(inventoryItemId);
      normalizedMaterialItemsMap.set(inventoryItemId, {
        inventoryItemId,
        quantity: (previous?.quantity ?? 0) + quantity,
      });
    }

    const materialItemsPayload = Array.from(normalizedMaterialItemsMap.values());
    const materialSummaryForPayload = materialItemsPayload
      .map((item) => {
        const option = inventoryMaterialsById.get(item.inventoryItemId);
        const itemName = option?.itemName || `Item #${item.inventoryItemId}`;
        return `${itemName} x${item.quantity}`;
      })
      .join(', ');

    const normalizedPrescriptionItems = prescriptionSelections
      .map((item) => ({
        amount: item.amount.trim(),
        foodTiming: item.foodTiming,
        frequency: item.frequency.trim(),
        name: item.name.trim(),
      }))
      .filter((item) => item.name || item.amount || item.frequency || item.foodTiming);

    for (const item of normalizedPrescriptionItems) {
      if (!item.name || !item.amount || !item.frequency || !item.foodTiming) {
        toast.error('Complete all fields for each prescription item.');
        return;
      }
    }

    const targets = paintedTeeth.length > 0
      ? paintedTeeth
      : [{ condition: (toothConditions[selectedToothNumber] ?? activeCondition), toothNumber: selectedToothNumber }];
    const uniqueTargets = Array.from(
      new Map(targets.map((target) => [target.toothNumber, target])).values()
    );
    const chartMetadata = `[chart:${uniqueTargets.map((target) => `${target.toothNumber}=${CONDITION_CODES[target.condition]}`).join(',')}]`;
    const priceMetadata = `[priceInput:${rawPriceAmount.toFixed(2)}]`;
    const imageMetadata = requiresImage
      ? `[image:1][imagePrice:${rawImageCharge.toFixed(2)}][imagePriceInput:${rawImageCharge.toFixed(2)}]`
      : '';
    const plainNote = notes.trim();
    const metadataSegments = [chartMetadata, priceMetadata, imageMetadata].filter(Boolean).join('');
    const combinedNote = plainNote ? `${metadataSegments} ${plainNote}` : metadataSegments;
    if (combinedNote.length > 255) {
      toast.error('Notes are too long. Please shorten the note and try again.');
      return;
    }
    const primaryToothNumber = uniqueTargets[0]?.toothNumber ?? selectedToothNumber;
    const targetTooth = uniqueTargets.length === 1 ? toothByNumber.get(primaryToothNumber) : undefined;

    const payload: Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'> = {
      notes: combinedNote,
      price: rawPriceAmount.toFixed(2),
      toothNumber: uniqueTargets.map((target) => target.toothNumber).join(','),
      treatmentId: selectedTreatmentId,
      visitId: visitIdForSave,
    };
    if (materialSummaryForPayload) {
      payload.material = materialSummaryForPayload;
    }
    if (materialItemsPayload.length > 0) {
      payload.materialItems = materialItemsPayload;
    }
    if (normalizedPrescriptionItems.length > 0) {
      payload.prescription = {
        items: normalizedPrescriptionItems.map((item) => ({
          amount: item.amount,
          foodTiming: item.foodTiming as PrescriptionFoodTiming,
          frequency: item.frequency,
          name: item.name,
        })),
      };
    }

    if (targetTooth) {
      payload.toothId = String(targetTooth.id);
    }

    const dentistIdForPayload = selectedVisit?.dentistId?.trim() || (authenticatedDentist ? String(authenticatedDentist.id) : '');
    if (dentistIdForPayload) {
      payload.dentistId = dentistIdForPayload;
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
    setMaterialSelections([]);
    setPrescriptionSelections([]);
    setRequiresImage(false);
    setImagePrice('');
    void fetchInventoryMaterials();

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
          const toothMeta = resolveToothDisplayMeta(toothNumber);
          const color = condition ? CONDITIONS[condition].color : '#ffffff';
          const backgroundColor = condition ? hexToRgba(color, 0.28) : '#ffffff';

          return `
            <td class="tooth-cell" style="background:${backgroundColor};border-color:${condition ? color : '#d1d5db'};">
              <div style="font-weight:700;font-size:12px;">${toothNumber}</div>
              <div style="font-size:10px;color:#374151;">${escapeHtml(toothMeta.shortLabel)} | ${escapeHtml(conditionLabel)}</div>
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
        const materialSummary = resolveRowMaterialSummary(row);
        const prescriptionContent = formatPrescriptionSummary(row.prescription);
        const visit = visitById.get(String(row.visitId));
        const dentistLabel =
          row.dentist
            ? asText(row.dentist.fullName)
            : '';
        const resolvedDentist = dentistLabel || asText(visit?.dentistName) || doctorName;
        const imageCharge = parseImageChargeFromNotes(row.notes);
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
            <td>${escapeHtml(materialSummary)}</td>
            <td>${escapeHtml(resolvedDentist || '-')}</td>
            <td>${escapeHtml(imageCharge)}</td>
            <td>${escapeHtml(row.price || '-')}</td>
            <td>${escapeHtml(cleanedNotes || '-')}</td>
            <td>${escapeHtml(prescriptionContent)}</td>
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
          <th>Dentist</th>
          <th>Image Charge</th>
          <th>Price</th>
          <th>Note</th>
          <th>Prescription</th>
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
              <Label>Price (AFN)</Label>
              <Input
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                }}
                placeholder="e.g. 1000"
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
                placeholder="Image price in AFN"
                disabled={!requiresImage}
              />
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Materials (Inventory)</Label>
                <Button type="button" size="sm" variant="outline" onClick={addMaterialSelection}>
                  Add Material
                </Button>
              </div>

              {materialSelections.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                  No material selected.
                </p>
              ) : (
                <div className="space-y-2">
                  {materialSelections.map((selection) => (
                    <div key={selection.key} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                      <Select
                        value={selection.inventoryItemId || '__none__'}
                        onValueChange={(value) => {
                          updateMaterialSelection(selection.key, {
                            inventoryItemId: value === '__none__' ? '' : value,
                          });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={isLoadingInventoryMaterials ? 'Loading materials...' : 'Select material'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Select material</SelectItem>
                          {inventoryMaterials.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {`${item.itemName} (${item.quantity} ${item.unit})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={selection.quantity}
                        onChange={(event) => {
                          updateMaterialSelection(selection.key, { quantity: event.target.value });
                        }}
                        placeholder="Qty"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          removeMaterialSelection(selection.key);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                {materialSummary
                  ? `Selected: ${materialSummary}`
                  : 'Selected materials will be deducted from inventory after saving this treatment.'}
              </p>
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

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Prescription</Label>
                <Button type="button" size="sm" variant="outline" onClick={addPrescriptionSelection}>
                  Add Medicine
                </Button>
              </div>

              {prescriptionSelections.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                  No prescription items added.
                </p>
              ) : (
                <div className="space-y-2">
                  {prescriptionSelections.map((selection) => (
                    <div key={selection.key} className="rounded-md border border-border/70 p-3">
                      <div className="mb-2 grid gap-2 md:grid-cols-2">
                        <Input
                          value={selection.name}
                          onChange={(event) => {
                            updatePrescriptionSelection(selection.key, { name: event.target.value });
                          }}
                          placeholder="Medicine name"
                        />
                        <Input
                          value={selection.amount}
                          onChange={(event) => {
                            updatePrescriptionSelection(selection.key, { amount: event.target.value });
                          }}
                          placeholder="Amount (e.g. 2)"
                        />
                      </div>
                      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <Select
                          value={selection.frequency || '__none__'}
                          onValueChange={(value) => {
                            updatePrescriptionSelection(selection.key, {
                              frequency: value === '__none__' ? '' : value,
                            });
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select frequency</SelectItem>
                            {PRESCRIPTION_FREQUENCY_OPTIONS.map((frequency) => (
                              <SelectItem key={frequency} value={frequency}>
                                {frequency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={selection.foodTiming || '__none__'}
                          onValueChange={(value) => {
                            updatePrescriptionSelection(selection.key, {
                              foodTiming: value === '__none__' ? '' : (value as PrescriptionFoodTiming),
                            });
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Food timing" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select food timing</SelectItem>
                            {(Object.keys(PRESCRIPTION_FOOD_TIMING_LABELS) as PrescriptionFoodTiming[]).map((timing) => (
                              <SelectItem key={timing} value={timing}>
                                {PRESCRIPTION_FOOD_TIMING_LABELS[timing]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            removePrescriptionSelection(selection.key);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Saved with this visit treatment and shown in patient records.
              </p>
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
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 xl:grid-cols-16">
              {UPPER_ARCH.map((toothNumber) => {
                const condition = toothConditions[toothNumber];
                const isSelected = selectedToothNumber === toothNumber;
                const toothMeta = resolveToothDisplayMeta(toothNumber);
                const toothCode = resolveToothQuadrantCode(toothNumber);
                const conditionColor = condition ? CONDITIONS[condition].color : '#d1d5db';

                return (
                  <button
                    key={toothNumber}
                    type="button"
                    onClick={() => {
                      paintTooth(toothNumber);
                    }}
                    className={cn(
                      'relative flex h-28 min-w-0 flex-col items-center justify-between overflow-visible rounded-[20px] rounded-br-none border px-1.5 py-2 text-[10px] font-semibold transition hover:scale-[1.03] active:scale-[0.98]',
                      isSelected ? 'ring-2 ring-offset-1' : ''
                    )}
                    style={{
                      background: isSelected
                        ? 'linear-gradient(180deg, #7c3aed 0%, #9333ea 100%)'
                        : condition
                          ? `linear-gradient(180deg, ${hexToRgba(conditionColor, 0.16)} 0%, #f8fafc 100%)`
                          : '#f8fafc',
                      borderColor: isSelected ? '#7c3aed' : condition ? hexToRgba(conditionColor, 0.65) : '#e5e7eb',
                      boxShadow: isSelected
                        ? '0 14px 26px rgba(124,58,237,0.28)'
                        : '0 8px 16px rgba(15,23,42,0.06)',
                      color: isSelected ? '#ffffff' : '#1f2937',
                    }}
                    aria-label={`Tooth ${toothNumber} ${toothMeta.fullLabel}`}
                    title={`${toothCode} - ${toothMeta.fullLabel}`}
                  >
                    <span className={cn('text-sm leading-none', isSelected ? 'text-white' : 'text-slate-500')}>
                      {toothCode}
                    </span>
                    <ToothGlyph
                      arch="maxilla"
                      isActive={isSelected}
                      visualType={toothMeta.visualType}
                    />
                    <span
                      className="absolute -bottom-2 left-1/2 block size-5 -translate-x-1/2 rounded-full border-2 border-white"
                      style={{ backgroundColor: conditionColor }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mandible</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 xl:grid-cols-16">
              {LOWER_ARCH.map((toothNumber) => {
                const condition = toothConditions[toothNumber];
                const isSelected = selectedToothNumber === toothNumber;
                const toothMeta = resolveToothDisplayMeta(toothNumber);
                const toothCode = resolveToothQuadrantCode(toothNumber);
                const conditionColor = condition ? CONDITIONS[condition].color : '#d1d5db';

                return (
                  <button
                    key={toothNumber}
                    type="button"
                    onClick={() => {
                      paintTooth(toothNumber);
                    }}
                    className={cn(
                      'relative flex h-28 min-w-0 flex-col items-center justify-between overflow-visible rounded-[20px] rounded-br-none border px-1.5 py-2 text-[10px] font-semibold transition hover:scale-[1.03] active:scale-[0.98]',
                      isSelected ? 'ring-2 ring-offset-1' : ''
                    )}
                    style={{
                      background: isSelected
                        ? 'linear-gradient(180deg, #7c3aed 0%, #9333ea 100%)'
                        : condition
                          ? `linear-gradient(180deg, ${hexToRgba(conditionColor, 0.16)} 0%, #f8fafc 100%)`
                          : '#f8fafc',
                      borderColor: isSelected ? '#7c3aed' : condition ? hexToRgba(conditionColor, 0.65) : '#e5e7eb',
                      boxShadow: isSelected
                        ? '0 14px 26px rgba(124,58,237,0.28)'
                        : '0 8px 16px rgba(15,23,42,0.06)',
                      color: isSelected ? '#ffffff' : '#1f2937',
                    }}
                    aria-label={`Tooth ${toothNumber} ${toothMeta.fullLabel}`}
                    title={`${toothCode} - ${toothMeta.fullLabel}`}
                  >
                    <span className={cn('text-sm leading-none', isSelected ? 'text-white' : 'text-slate-500')}>
                      {toothCode}
                    </span>
                    <ToothGlyph
                      arch="mandible"
                      isActive={isSelected}
                      visualType={toothMeta.visualType}
                    />
                    <span
                      className="absolute -bottom-2 left-1/2 block size-5 -translate-x-1/2 rounded-full border-2 border-white"
                      style={{ backgroundColor: conditionColor }}
                    />
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
          <CardDescription>Patient context, assigned doctor, and selected tooth details from patient records.</CardDescription>
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
              <span className="font-medium">{materialSummary || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Treatment</span>
              <span className="font-medium">{selectedTreatment?.name || '-'}</span>
            </div>
            <div className="pt-1">
              <p className="text-muted-foreground">Prescription</p>
              <p className="mt-1 rounded-md border border-border/70 bg-muted/30 p-2 text-xs text-foreground">
                {prescriptionDraftSummary}
              </p>
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
                      <p className="text-xs text-muted-foreground">Material: {resolveRowMaterialSummary(row)}</p>
                      <p className="text-xs text-muted-foreground">Note: {cleanedNotes || '-'}</p>
                      <p className="text-xs text-muted-foreground">
                        Prescription: {formatPrescriptionSummary(row.prescription)}
                      </p>
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
              Doctor Mapping
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedVisit?.dentistName
                ? `Using visit doctor: ${selectedVisit.dentistName}`
                : authenticatedDentist
                  ? `Using linked staff record: #${authenticatedDentist.id}`
                  : 'No visit doctor or linked staff record found.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
