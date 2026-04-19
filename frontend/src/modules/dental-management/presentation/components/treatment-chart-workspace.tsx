'use client';

import { JSX, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/modules/auth/application/stores/auth-store';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { fetchAllRows } from '@/modules/common/infrastructure/api/fetch-all-rows';
import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import {
  type VisitTreatment,
  type VisitTreatmentImage,
  type VisitTreatmentImageModality,
  type VisitTreatmentImageSource,
} from '@/modules/dental-management/domain/entities/VisitTreatment';
import {
  useCreateVisitTreatment,
  useUpdateVisitTreatment,
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
  DEFAULT_AFN_PER_USD,
  type CurrencyCode,
  convertInputToUsd,
  convertUsdToInput,
  formatCurrency,
  getExchangeRate,
} from '@/lib/currency-utils';
import { writePendingInvoiceFlow } from '@/modules/dental-management/presentation/components/invoices/invoice-flow-storage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utilities';
import { Camera, Eraser, ImagePlus, Loader2, Paintbrush, Pencil, Printer, RotateCcw, ScanLine, Stethoscope, UserRound } from 'lucide-react';
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
  availableQuantity: number;
  category: string;
  id: string;
  itemName: string;
  location: string;
  minStock: number;
  quantity: number;
  stockState: 'in_stock' | 'low_stock' | 'out_of_stock';
  supplier: string;
  unit: string;
  unitCost: number;
};

type MaterialSelectionRow = {
  key: string;
  inventoryItemId: string;
  quantity: string;
};

type MaterialReviewRow = {
  availableQuantity: number;
  category: string;
  itemName: string;
  key: string;
  location: string;
  minStock: number;
  remainingQuantity: number;
  requestedQuantity: number;
  status: 'healthy' | 'low_after' | 'shortage';
  substituteOptions: InventoryMaterialOption[];
  supplier: string;
  unit: string;
};

type PrescriptionFoodTiming = 'before_food' | 'after_food' | 'with_food' | 'anytime';

type PrescriptionSelectionRow = {
  amount: string;
  key: string;
  foodTiming: PrescriptionFoodTiming | '';
  frequency: string;
  name: string;
};

type ImagePreview = {
  file: File;
  key: string;
  url: string;
};

const CONDITIONS: Record<ConditionKey, ConditionMeta> = {
  caries: { color: '#4ade80', label: 'Caries' },
  gingivitis: { color: '#f87171', label: 'Gingivitis' },
  implant: { color: '#c084fc', label: 'Implant' },
  periodontitis: { color: '#67e8f9', label: 'Periodontitis' },
  periostitis: { color: '#8b5e3c', label: 'Periostitis' },
  removal: { color: '#3b82f6', label: 'Removal' },
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
const TREATMENT_IMAGE_MODALITY_LABELS: Record<VisitTreatmentImageModality, string> = {
  cbct: 'CBCT',
  intraoral_photo: 'Intraoral Photo',
  opg: 'OPG / Panoramic',
  other: 'Other',
  scanner_export: 'Scanner Export',
  xray: 'Dental X-Ray',
};
const TREATMENT_IMAGE_SOURCE_LABELS: Record<VisitTreatmentImageSource, string> = {
  camera: 'Captured now',
  device_import: 'Imported from device/software',
  upload: 'Uploaded from files',
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
  const enamelGradientId = `${uid}-enamel`;
  const highlightGradientId = `${uid}-highlight`;
  const shadowGradientId = `${uid}-shadow`;
  const innerHighlightId = `${uid}-inner-highlight`;
  const strokeColor = isActive ? '#e5e7eb' : '#c3ccd8';
  const crownHighlight = '#fafbfc';
  const crownMidLight = isActive ? '#f5f9fd' : '#f2f6fa';
  const crownMid = isActive ? '#f0f4f8' : '#edf1f5';
  const crownBase = isActive ? '#e8ecf2' : '#e5e9ed';
  const crownDepth = isActive ? '#dce0e8' : '#d9dde5';
  const crownShadow = isActive ? '#cfd4da' : '#ccd1d7';
  const rootTop = isActive ? '#e8ecf2' : '#e5e9ed';
  const rootMid = isActive ? '#d4dce4' : '#d1d9e1';
  const rootBottom = isActive ? '#b8c2cc' : '#b5bfd9';
  const rootShadow = isActive ? '#a8b2be' : '#a5b0bc';
  const detailColor = isActive ? 'rgba(255,255,255,0.8)' : 'rgba(100,116,139,0.45)';
  const shadowColor = isActive ? 'rgba(88, 28, 135, 0.32)' : 'rgba(15, 23, 42, 0.16)';

  return (
    <svg viewBox="0 0 72 88" className="h-16 w-16" aria-hidden="true">
      <defs>
        <linearGradient id={crownGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={crownHighlight} />
          <stop offset="15%" stopColor={crownMidLight} />
          <stop offset="30%" stopColor={crownMid} />
          <stop offset="50%" stopColor={crownBase} />
          <stop offset="70%" stopColor={crownDepth} />
          <stop offset="90%" stopColor={crownShadow} />
          <stop offset="100%" stopColor={crownShadow} stopOpacity={0.95} />
        </linearGradient>
        <linearGradient id={rootGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={rootTop} />
          <stop offset="30%" stopColor={rootMid} />
          <stop offset="70%" stopColor={rootBottom} />
          <stop offset="100%" stopColor={rootShadow} />
        </linearGradient>
        <radialGradient id={glossGradientId} cx="30%" cy="18%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
          <stop offset="30%" stopColor="rgba(255,255,255,0.45)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={enamelGradientId} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={highlightGradientId} cx="26%" cy="16%" r="38%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={shadowGradientId} cx="70%" cy="80%" r="60%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="50%" stopColor="rgba(0,0,0,0.05)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
        </radialGradient>
        <radialGradient id={innerHighlightId} cx="35%" cy="25%" r="30%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* Crown base with multi-stop gradient */}
      <path
        d={spec.crownPath}
        fill={`url(#${crownGradientId})`}
        stroke={strokeColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
        style={{ filter: `drop-shadow(0 3px 5px ${shadowColor})` }}
      />

      {/* Enamel texture overlay */}
      <path
        d={spec.crownPath}
        fill={`url(#${enamelGradientId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />

      {/* Shadow gradient overlay */}
      <path
        d={spec.crownPath}
        fill={`url(#${shadowGradientId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.4}
      />

      {/* Primary gloss effect */}
      <path
        d={spec.crownPath}
        fill={`url(#${glossGradientId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Inner highlight spot */}
      <ellipse
        cx="26"
        cy="16"
        rx="14"
        ry="9"
        fill={`url(#${innerHighlightId})`}
        opacity={0.6}
      />

      {/* Main highlight ellipse */}
      <ellipse
        cx="26"
        cy="16"
        rx="13"
        ry="8.5"
        fill={`url(#${highlightGradientId})`}
        opacity={0.55}
      />

      {/* Secondary highlight */}
      <ellipse
        cx="42"
        cy="22"
        rx="6"
        ry="4"
        fill="rgba(255,255,255,0.25)"
        opacity={0.5}
      />

      {/* Crown separation line */}
      <path
        d="M22 34 C28 32 44 32 50 34"
        fill="none"
        stroke="rgba(148,163,184,0.45)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.3}
      />

      {/* Enhanced surface details */}
      {crownDetailPaths.map((detailPath, index) => (
        <path
          key={`${visualType}-detail-${index}`}
          d={detailPath}
          fill="none"
          stroke={detailColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.3}
          opacity={0.85}
        />
      ))}

      {/* Roots with enhanced gradient */}
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
          strokeWidth={2.1}
          style={{ filter: `drop-shadow(0 2px 4px ${shadowColor})` }}
        />
      ))}

      {/* Root texture lines */}
      {rootCenters.map((centerX, index) => (
        <path
          key={`${visualType}-${arch}-root-texture-${index}`}
          d={`M${centerX - 2.5} 46 Q${centerX} 56 ${centerX + 2.5} 66`}
          fill="none"
          stroke="rgba(148,163,184,0.28)"
          strokeLinecap="round"
          strokeWidth={0.9}
          opacity={0.55}
        />
      ))}

      {/* Root highlight lines */}
      {rootCenters.map((centerX, index) => (
        <path
          key={`${visualType}-${arch}-root-highlight-${index}`}
          d={`M${centerX - 1} 48 Q${centerX - 0.5} 54 ${centerX} 60`}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeLinecap="round"
          strokeWidth={0.6}
          opacity={0.5}
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

  const imagePriceInput = parseTagNumberFromNotes(value, 'imagePriceInput');
  const currency = parseCurrencyCodeFromNotes(value);
  const exchangeRate = parseExchangeRateFromNotes(value, currency);

  return formatStoredAmount(parsed, imagePriceInput, currency, exchangeRate);
};

const parseRequiresImageFromNotes = (value?: string): boolean => {
  if (!value) {
    return false;
  }

  const imageRequiredMatch = value.match(/\[image:([01])\]/i);

  return imageRequiredMatch?.[1] === '1';
};

const parseImagePriceValueFromNotes = (value?: string): string => {
  if (!value) {
    return '';
  }

  const parsedInput = parseTagNumberFromNotes(value, 'imagePriceInput');
  if (parsedInput > 0) {
    return parsedInput.toFixed(2);
  }

  const imagePriceMatch = value.match(/\[imagePrice:([0-9]+(?:\.[0-9]+)?)\]/i);
  if (!imagePriceMatch) {
    return '';
  }

  const parsed = Number(imagePriceMatch[1]);

  return Number.isFinite(parsed) ? parsed.toFixed(2) : '';
};

const parseTagTextFromNotes = (value: string | undefined, tag: string): string => {
  if (!value) {
    return '';
  }

  const match = value.match(new RegExp(`\\[${tag}:([^\\]]+)\\]`, 'i'));
  return match?.[1]?.trim() ?? '';
};

const parseTagNumberFromNotes = (value: string | undefined, tag: string): number => {
  const text = parseTagTextFromNotes(value, tag);
  if (!text) {
    return 0;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCurrencyCodeFromNotes = (value?: string): CurrencyCode => {
  return parseTagTextFromNotes(value, 'currency').toUpperCase() === 'USD' ? 'USD' : 'AFN';
};

const parseExchangeRateFromNotes = (value: string | undefined, currency: CurrencyCode): number => {
  if (currency === 'USD') {
    return Math.max(parseTagNumberFromNotes(value, 'exchangeRate') || DEFAULT_AFN_PER_USD, DEFAULT_AFN_PER_USD);
  }

  return 1;
};

const parsePriceValueFromNotes = (value: string | undefined, fallbackPrice: string): string => {
  const parsedInput = parseTagNumberFromNotes(value, 'priceInput');
  if (parsedInput > 0) {
    return parsedInput.toFixed(2);
  }

  return asText(fallbackPrice);
};

const formatStoredAmount = (
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
    /^(?:\[(?:chart:[^\]]+|image:[01]|imagePrice:[0-9.]+|imagePriceInput:[0-9.]+|currency:(?:AFN|USD)|exchangeRate:[0-9.]+|priceInput:[0-9.]+|condition:[a-z]+|tooth:[0-9]{2})\])+\s*/i;

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

const isLightColor = (hex: string): boolean => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return false;
  }
  const bigint = Number.parseInt(normalized, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.7;
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
    const name = asText(source.name);
    const amount = asText(source.amount);
    const frequency = asText(source.frequency);
    const foodTimingRaw = asText(source.foodTiming);
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
    return asText(prescription.content) || '-';
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
  const authenticatedEmail = asText(authenticatedUser?.email).toLowerCase();
  const createVisitTreatment = useCreateVisitTreatment();
  const updateVisitTreatment = useUpdateVisitTreatment();
  const defaultPatientId = initialPatientId !== undefined && initialPatientId !== null
    ? String(initialPatientId)
    : '';
  const defaultVisitId = initialVisitId !== undefined && initialVisitId !== null
    ? String(initialVisitId)
    : '';

  const [activeCondition, setActiveCondition] = useState<ConditionKey | null>(null);
  const [editingTreatmentId, setEditingTreatmentId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(defaultPatientId);
  const [selectedVisitId, setSelectedVisitId] = useState<string>(defaultVisitId);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string>('');
  const [selectedToothNumber, setSelectedToothNumber] = useState<string>('');
  const [currency, setCurrency] = useState<CurrencyCode>('AFN');
  const [exchangeRate, setExchangeRate] = useState<string>('1');
  const [defaultExchangeRate, setDefaultExchangeRate] = useState(DEFAULT_AFN_PER_USD);
  const [price, setPrice] = useState<string>('');
  const [requiresImage, setRequiresImage] = useState<boolean>(false);
  const [imagePrice, setImagePrice] = useState<string>('');
  const [treatmentImages, setTreatmentImages] = useState<File[]>([]);
  const [persistedTreatmentImages, setPersistedTreatmentImages] = useState<VisitTreatmentImage[]>([]);
  const [imageModality, setImageModality] = useState<VisitTreatmentImageModality>('xray');
  const [imageSource, setImageSource] = useState<VisitTreatmentImageSource>('upload');
  const [materialSelections, setMaterialSelections] = useState<MaterialSelectionRow[]>([]);
  const [inventoryMaterials, setInventoryMaterials] = useState<InventoryMaterialOption[]>([]);
  const [isLoadingInventoryMaterials, setIsLoadingInventoryMaterials] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [prescriptionSelections, setPrescriptionSelections] = useState<PrescriptionSelectionRow[]>([]);
  const [conditionOverrides, setConditionOverrides] = useState<Record<string, ConditionKey | null>>({});
  const [autoHydratedVisitId, setAutoHydratedVisitId] = useState<string>('');

  const { entities: patients } = usePatientList(1, 100);

  const visitFilters = useMemo(() => ({ patientId: [selectedPatientId || '-1'] }), [selectedPatientId]);
  const { entities: visits, isFetching: isLoadingVisits } = useVisitList(1, 100, '', [], ['patient', 'dentist'], visitFilters);

  const patientVisitIds = useMemo(() => visits.map((visit) => String(visit.id)), [visits]);
  const resolvedExchangeRate = currency === 'USD'
    ? Math.max(parseCurrency(exchangeRate) || defaultExchangeRate, DEFAULT_AFN_PER_USD)
    : 1;
  const visitTreatmentFilters = useMemo(
    () => ({ visitId: patientVisitIds.length > 0 ? patientVisitIds : ['-1'] }),
    [patientVisitIds]
  );
  const { entities: visitTreatments, isFetching: isLoadingVisitTreatments } = useVisitTreatmentList(
    1,
    100,
    '',
    [],
    ['treatment', 'tooth', 'dentist', 'prescription', 'prescription.items', 'materialItems', 'treatmentImages', 'activityLogs', 'activityLogs.causer'],
    visitTreatmentFilters
  );

  const { entities: treatments } = useTreatmentList(1, 100, '', [], [], { enabled: ['1'] });
  const { entities: teeth } = useToothList(1, 100);
  const { entities: staff } = useStaffList(1, 100, authenticatedEmail, ['email'], [], { enabled: ['1'] });

  useEffect(() => {
    const client = new AxiosClient();

    void getExchangeRate(client)
      .then((rate) => {
        setDefaultExchangeRate(rate);
        setExchangeRate((previous) => (currency === 'USD' && (parseCurrency(previous) <= 0 || previous === '1')
          ? String(rate)
          : previous));
      })
      .catch(() => {
        setDefaultExchangeRate(DEFAULT_AFN_PER_USD);
      });
  }, [currency]);
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

    const matches = staff.filter((member) => asText(member.email).toLowerCase() === authenticatedEmail);

    if (matches.length === 0) {
      return null;
    }

    return matches.find((member) => member.role === 'dentist') ?? matches[0];
  }, [authenticatedEmail, staff]);

  const selectedTreatment = selectedTreatmentId ? treatmentById.get(selectedTreatmentId) : undefined;
  const selectedVisit = selectedVisitId ? visitById.get(selectedVisitId) : undefined;
  const uploadInputId = useId();
  const captureInputId = useId();
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
    const directMaterial = asText(row.material);
    if (directMaterial) {
      return directMaterial;
    }

    if (!Array.isArray(row.materialItems) || row.materialItems.length === 0) {
      return '-';
    }

    const parts = row.materialItems
      .map((item) => {
        const itemNameFromRow = 'itemName' in item ? item.itemName : undefined;
        const itemName = asText(itemNameFromRow)
          ? asText(itemNameFromRow)
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

  const treatmentImagePreviews = useMemo<ImagePreview[]>(
    () =>
      treatmentImages.map((file) => ({
        file,
        key: `${file.name}-${file.size}-${file.lastModified}`,
        url: URL.createObjectURL(file),
      })),
    [treatmentImages]
  );

  useEffect(() => {
    return () => {
      treatmentImagePreviews.forEach((preview) => {
        URL.revokeObjectURL(preview.url);
      });
    };
  }, [treatmentImagePreviews]);

  const isSubmitting = createVisitTreatment.isPending || updateVisitTreatment.isPending;
  const attachedImageCount = treatmentImages.length + persistedTreatmentImages.length;
  const canSave =
    !!selectedPatientId &&
    !!selectedTreatmentId &&
    !!selectedToothNumber &&
    price.trim().length > 0 &&
    !isSubmitting;

  const doctorName = useMemo(() => {
    const visitDentistName = asText(selectedVisit?.dentistName);
    if (visitDentistName) {
      return visitDentistName;
    }

    const mappedStaffName = asText(authenticatedDentist?.fullName);
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
  const materialReviewRows = useMemo<MaterialReviewRow[]>(() => {
    return materialSelections
      .map((selection) => {
        const inventoryItemId = selection.inventoryItemId.trim();
        const requestedQuantity = Number.parseInt(selection.quantity.trim(), 10);

        if (!inventoryItemId || !Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
          return null;
        }

        const item = inventoryMaterialsById.get(inventoryItemId);
        if (!item) {
          return null;
        }

        const availableQuantity = item.availableQuantity;
        const remainingQuantity = availableQuantity - requestedQuantity;
        const status: MaterialReviewRow['status'] = remainingQuantity < 0
          ? 'shortage'
          : remainingQuantity <= item.minStock
            ? 'low_after'
            : 'healthy';
        const substituteOptions = inventoryMaterials
          .filter((candidate) =>
            candidate.id !== item.id &&
            candidate.category === item.category &&
            candidate.availableQuantity >= requestedQuantity
          )
          .sort((left, right) => right.availableQuantity - left.availableQuantity)
          .slice(0, 3);

        return {
          availableQuantity,
          category: item.category,
          itemName: item.itemName,
          key: selection.key,
          location: item.location,
          minStock: item.minStock,
          remainingQuantity,
          requestedQuantity,
          status,
          substituteOptions,
          supplier: item.supplier,
          unit: item.unit,
        };
      })
      .filter((row): row is MaterialReviewRow => row !== null);
  }, [inventoryMaterials, inventoryMaterialsById, materialSelections]);
  const hasBlockingMaterialIssue = materialReviewRows.some((row) => row.status === 'shortage');
  const hasLowStockMaterialIssue = materialReviewRows.some((row) => row.status === 'low_after');
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

  const convertEditorValue = (
    value: string,
    nextCurrency: CurrencyCode,
    nextExchangeRate: number
  ): string => {
    const numericValue = roundCurrency(parseCurrency(value));
    if (numericValue <= 0) {
      return '';
    }

    const amountAfn = convertInputToUsd(numericValue, currency, resolvedExchangeRate);
    const convertedValue = convertUsdToInput(amountAfn, nextCurrency, nextExchangeRate);
    return convertedValue > 0 ? convertedValue.toFixed(2) : '';
  };

  const resetEditor = useCallback((): void => {
    setEditingTreatmentId(null);
    setActiveCondition(null);
    setSelectedTreatmentId('');
    setSelectedToothNumber('');
    setCurrency('AFN');
    setExchangeRate('1');
    setPrice('');
    setRequiresImage(false);
    setImagePrice('');
    setTreatmentImages([]);
    setPersistedTreatmentImages([]);
    setImageModality('xray');
    setImageSource('upload');
    setMaterialSelections([]);
    setNotes('');
    setCorrectionReason('');
    setPrescriptionSelections([]);
    setConditionOverrides({});
  }, []);

  const handlePatientChange = (value: string): void => {
    if (lockPatientSelection) {
      return;
    }

    resetEditor();
    setSelectedPatientId(value);
    if (!lockVisitSelection) {
      setSelectedVisitId('');
    }
  };

  const handleTreatmentChange = (value: string): void => {
    setSelectedTreatmentId(value);
    const treatment = treatmentById.get(value);
    const defaultPrice = roundCurrency(parseCurrency(treatment?.defaultPrice ?? ''));
    if (defaultPrice <= 0) {
      setPrice('');
      return;
    }

    const defaultPriceInput = currency === 'USD'
      ? convertUsdToInput(defaultPrice, currency, resolvedExchangeRate)
      : defaultPrice;
    setPrice(defaultPriceInput.toFixed(2));
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

  const applyMaterialSubstitute = (key: string, inventoryItemId: string): void => {
    updateMaterialSelection(key, { inventoryItemId });
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

  const addTreatmentImages = (files: File[], source: VisitTreatmentImageSource): void => {
    if (files.length === 0) {
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('Only image files can be attached to the treatment chart.');
      return;
    }

    setImageSource(source);
    setTreatmentImages((previous) => {
      const merged = [...previous];
      const seen = new Set(previous.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const persistedCount = persistedTreatmentImages.length;

      imageFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      });

      return merged.slice(0, Math.max(0, 12 - persistedCount));
    });
  };

  const handleTreatmentImagesSelected = (
    files: FileList | null,
    source: VisitTreatmentImageSource
  ): void => {
    if (!files || files.length === 0) {
      return;
    }

    addTreatmentImages(Array.from(files), source);
  };

  const removeTreatmentImage = (key: string): void => {
    setTreatmentImages((previous) =>
      previous.filter((file) => `${file.name}-${file.size}-${file.lastModified}` !== key)
    );
  };

  const removePersistedTreatmentImage = (imageId: number | undefined): void => {
    if (!imageId) {
      return;
    }

    setPersistedTreatmentImages((previous) =>
      previous.filter((image) => image.id !== imageId)
    );
  };

  const fetchInventoryMaterials = useCallback(async (): Promise<void> => {
    setIsLoadingInventoryMaterials(true);

    try {
      const allRows = await fetchAllRows(
        inventoryApiClient,
        '/api/v1/dental-management/inventory-items',
        { sortBy: 'entryDate', sortDirection: 'desc' }
      );

      const uniqueMaterials = new Map<string, InventoryMaterialOption>();
      for (const row of allRows) {
        const id = asText(row.id);
        const itemName = asText(row.itemName ?? row.item_name);
        if (!id || !itemName) continue;

        uniqueMaterials.set(id, {
          availableQuantity: asNumber(row.availableQuantity ?? row.quantity),
          category: asText(row.category),
          id,
          itemName,
          location: asText(row.location),
          minStock: asNumber(row.minStock ?? row.min_stock),
          quantity: asNumber(row.quantity),
          stockState: (asText(row.stockState ?? row.stock_state) as InventoryMaterialOption['stockState']) || 'in_stock',
          supplier: asText(row.supplier),
          unit: asText(row.unit) || 'unit',
          unitCost: asNumber(row.unitCost ?? row.unit_cost),
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

  const startEditingTreatment = useCallback((row: VisitTreatmentWithRelations): void => {
    const rowTeeth = resolveRowTeeth(row);
    const rowConditionMap = resolveRowConditionMap(row);
    const firstCondition = Object.values(rowConditionMap)[0] ?? null;
    const persistedImagesFromRow = Array.isArray(row.treatmentImages)
      ? row.treatmentImages.filter((image): image is VisitTreatmentImage => !(image instanceof File))
      : [];
    const materialSelectionsFromRow = Array.isArray(row.materialItems)
      ? row.materialItems.map((item) => {
          const quantity = 'quantityUsed' in item && typeof item.quantityUsed === 'number'
            ? item.quantityUsed
            : Number('quantity' in item ? item.quantity : 1);

          return {
            inventoryItemId: String(item.inventoryItemId ?? ''),
            key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            quantity: Number.isFinite(quantity) && quantity > 0 ? String(quantity) : '1',
          };
        })
      : [];
    const prescriptionSelectionsFromRow = Array.isArray(row.prescription?.items)
      ? row.prescription.items.map((item) => ({
          amount: item.amount ?? '',
          foodTiming: item.foodTiming ?? '',
          frequency: item.frequency ?? '',
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: item.name ?? '',
        }))
      : [];
    const rowCurrency = parseCurrencyCodeFromNotes(row.notes);
    const rowExchangeRate = parseExchangeRateFromNotes(row.notes, rowCurrency);

    setEditingTreatmentId(row.id);
    setSelectedVisitId(String(row.visitId));
    setSelectedTreatmentId(String(row.treatmentId));
    setSelectedToothNumber(rowTeeth[0] ?? parseToothNumbersFromValue(row.toothNumber)[0] ?? '');
    setActiveCondition(firstCondition);
    setConditionOverrides(Object.keys(rowConditionMap).length > 0 ? rowConditionMap : {});
    setCurrency(rowCurrency);
    setExchangeRate(String(rowCurrency === 'USD' ? rowExchangeRate : 1));
    setPrice(parsePriceValueFromNotes(row.notes, row.price));
    setRequiresImage(parseRequiresImageFromNotes(row.notes));
    setImagePrice(parseImagePriceValueFromNotes(row.notes));
    setTreatmentImages([]);
    setPersistedTreatmentImages(persistedImagesFromRow);
    setImageModality(row.imageModality ?? 'xray');
    setImageSource(row.imageSource ?? 'upload');
    setMaterialSelections(materialSelectionsFromRow);
    setNotes(stripMetadataPrefixes(row.notes));
    setCorrectionReason('');
    setPrescriptionSelections(prescriptionSelectionsFromRow);
  }, [resolveRowConditionMap, resolveRowTeeth]);

  useEffect(() => {
    if (!hidePatientVisitSelectors || !lockVisitSelection || !selectedVisitId) {
      return;
    }

    if (displayedVisitTreatments.length === 0 || autoHydratedVisitId === selectedVisitId) {
      return;
    }

    startEditingTreatment(displayedVisitTreatments[0]);
    setAutoHydratedVisitId(selectedVisitId);
  }, [
    autoHydratedVisitId,
    displayedVisitTreatments,
    hidePatientVisitSelectors,
    lockVisitSelection,
    selectedVisitId,
    startEditingTreatment,
  ]);

  const paintTooth = (toothNumber: string): void => {
    setSelectedToothNumber(toothNumber);
    if (!activeCondition) {
      return;
    }
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

    const rawPriceAmountInput = roundCurrency(parseCurrency(price));
    if (rawPriceAmountInput <= 0) {
      toast.error('Price must be greater than zero.');
      return;
    }
    const rawPriceAmount = convertInputToUsd(rawPriceAmountInput, currency, resolvedExchangeRate);

    const rawImageChargeInput = requiresImage ? roundCurrency(parseCurrency(imagePrice)) : 0;
    if (requiresImage && rawImageChargeInput <= 0) {
      toast.error('Provide an imaging charge when separate imaging billing is enabled.');
      return;
    }
    const rawImageCharge = requiresImage
      ? convertInputToUsd(rawImageChargeInput, currency, resolvedExchangeRate)
      : 0;

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
    if (hasBlockingMaterialIssue) {
      toast.error('One or more selected materials do not have enough stock. Use a substitute or lower the requested quantity.');
      return;
    }
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

    const fallbackCondition = toothConditions[selectedToothNumber] ?? activeCondition;
    if (!fallbackCondition && paintedTeeth.length === 0) {
      toast.error('Select a condition first.');
      return;
    }

    const targets = paintedTeeth.length > 0
      ? paintedTeeth
      : [{ condition: fallbackCondition as ConditionKey, toothNumber: selectedToothNumber }];
    const uniqueTargets = Array.from(
      new Map(targets.map((target) => [target.toothNumber, target])).values()
    );
    const chartMetadata = `[chart:${uniqueTargets.map((target) => `${target.toothNumber}=${CONDITION_CODES[target.condition]}`).join(',')}]`;
    const priceMetadata = `[currency:${currency}][exchangeRate:${resolvedExchangeRate.toFixed(6)}][priceInput:${rawPriceAmountInput.toFixed(2)}]`;
    const imageMetadata = requiresImage
      ? `[image:1][imagePrice:${rawImageCharge.toFixed(2)}][imagePriceInput:${rawImageChargeInput.toFixed(2)}]`
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
    if (attachedImageCount > 0) {
      payload.imageModality = imageModality;
      payload.imageSource = imageSource;
    }
    if (treatmentImages.length > 0) {
      payload.treatmentImages = treatmentImages;
    }
    if (editingTreatmentId !== null) {
      payload.retainedTreatmentImageIds = persistedTreatmentImages
        .filter((image): image is VisitTreatmentImage => typeof image.id === 'number')
        .map((image) => Number(image.id));
    }
    if (materialSummaryForPayload || editingTreatmentId !== null) {
      payload.material = materialSummaryForPayload;
    }
    if (materialItemsPayload.length > 0 || editingTreatmentId !== null) {
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
    } else if (editingTreatmentId !== null) {
      payload.prescription = { content: '', items: [] };
    }

    if (targetTooth) {
      payload.toothId = String(targetTooth.id);
    }

    const dentistIdForPayload = asText(selectedVisit?.dentistId) || (authenticatedDentist ? String(authenticatedDentist.id) : '');
    if (dentistIdForPayload) {
      payload.dentistId = dentistIdForPayload;
    }

    if (editingTreatmentId !== null) {
      const normalizedCorrectionReason = correctionReason.trim();
      if (!normalizedCorrectionReason) {
        toast.error('Add a correction reason before updating a saved treatment.');
        return;
      }

      payload.correctionReason = normalizedCorrectionReason;
    }

    const response = editingTreatmentId !== null
      ? await updateVisitTreatment.mutateAsync({
          data: payload,
          id: editingTreatmentId,
        })
      : await createVisitTreatment.mutateAsync(payload);
    if (!response.success) {
      const errorText =
        typeof response.error?.details === 'string'
          ? response.error.details
          : response.error?.message || (editingTreatmentId !== null
            ? 'Failed to update treatment entry.'
            : 'Failed to save treatment entry.');
      toast.error(errorText);
      return;
    }

    resetEditor();
    void fetchInventoryMaterials();

    const shouldStartBillingFlow =
      editingTreatmentId === null &&
      hidePatientVisitSelectors && lockPatientSelection && lockVisitSelection;

    if (shouldStartBillingFlow) {
      const searchParameters = new URLSearchParams({
        flow: 'chart',
        visitId: String(visitIdForSave),
      });
      const invoiceFlowUrl = `/${locale}/dental-management/invoices/?${searchParameters.toString()}`;
      toast.success('Treatment saved. Redirecting to payment and invoice flow.');
      if (typeof window !== 'undefined') {
        writePendingInvoiceFlow(String(visitIdForSave), 'chart');
        window.location.assign(invoiceFlowUrl);
      } else {
        router.push(invoiceFlowUrl);
      }
      return;
    }

    toast.success(editingTreatmentId !== null ? 'Treatment entry updated.' : 'Treatment added to patient chart.');
    if (hasLowStockMaterialIssue) {
      toast.warning('Some materials are now at or below minimum stock. Check the inventory panel for reorder planning.');
    }
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
        const rowCurrency = parseCurrencyCodeFromNotes(row.notes);
        const rowExchangeRate = parseExchangeRateFromNotes(row.notes, rowCurrency);
        const rowPriceLabel = formatStoredAmount(
          parseCurrency(row.price),
          parseTagNumberFromNotes(row.notes, 'priceInput'),
          rowCurrency,
          rowExchangeRate
        );
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
            <td>${escapeHtml(rowPriceLabel)}</td>
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
      <p><strong>Selected Tooth:</strong> ${
        selectedToothNumber
          ? `${escapeHtml(selectedToothNumber)} (${escapeHtml(getToothRegion(selectedToothNumber))})`
          : 'None'
      }</p>
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
          {editingTreatmentId !== null ? (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900">Editing saved treatment #{editingTreatmentId}</p>
                <p className="text-xs text-amber-800">
                  Update the saved entry, keep or remove old images, and add a correction reason so the audit history stays clear.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={resetEditor}>
                <RotateCcw className="size-4" />
                Cancel Edit
              </Button>
            </div>
          ) : null}

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
                      resetEditor();
                      setSelectedVisitId(value);
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
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={(value) => {
                  const nextCurrency = value as CurrencyCode;
                  const nextExchangeRate = nextCurrency === 'USD' ? defaultExchangeRate : 1;
                  setPrice(convertEditorValue(price, nextCurrency, nextExchangeRate));
                  setImagePrice(requiresImage ? convertEditorValue(imagePrice, nextCurrency, nextExchangeRate) : '');
                  setCurrency(nextCurrency);
                  setExchangeRate(String(nextExchangeRate));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AFN">AFN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Exchange Rate</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={exchangeRate}
                onChange={(event) => {
                  setExchangeRate(event.target.value);
                }}
                placeholder="AFN per 1 USD"
                disabled={currency === 'AFN'}
              />
            </div>

            <div className="space-y-2">
              <Label>{`Price (${currency})`}</Label>
              <Input
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                }}
                placeholder={currency === 'USD' ? 'e.g. 25' : 'e.g. 1000'}
              />
              <p className="text-[11px] text-muted-foreground">
                Saved in reports as {formatCurrency(convertInputToUsd(parseCurrency(price), currency, resolvedExchangeRate), 'AFN')}.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Imaging Type</Label>
              <Select
                value={imageModality}
                onValueChange={(value) => {
                  setImageModality(value as VisitTreatmentImageModality);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select imaging type" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TREATMENT_IMAGE_MODALITY_LABELS) as VisitTreatmentImageModality[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {TREATMENT_IMAGE_MODALITY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Treatment Images (Optional)</Label>
                <Badge variant="outline">
                  {attachedImageCount} attached
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <label htmlFor={uploadInputId}>
                  <Button type="button" variant="outline" className="gap-2" asChild>
                    <span>
                      <ImagePlus className="size-4" />
                      Upload Images
                    </span>
                  </Button>
                </label>
                <input
                  id={uploadInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    handleTreatmentImagesSelected(event.target.files, 'upload');
                    event.target.value = '';
                  }}
                />

                <label htmlFor={captureInputId}>
                  <Button type="button" variant="outline" className="gap-2" asChild>
                    <span>
                      <Camera className="size-4" />
                      Capture Now
                    </span>
                  </Button>
                </label>
                <input
                  id={captureInputId}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    handleTreatmentImagesSelected(event.target.files, 'camera');
                    event.target.value = '';
                  }}
                />

                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setImageSource('device_import');
                    const input = document.getElementById(uploadInputId) as HTMLInputElement | null;
                    input?.click();
                  }}
                >
                  <ScanLine className="size-4" />
                  Import Device Export
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Attach images when available. CBCT and dental X-ray machines can be used by importing their exported
                images here. Full direct device control needs vendor-specific software or SDK support.
              </p>
              {attachedImageCount === 0 ? (
                <p className="rounded-md border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
                  No images attached yet.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {persistedTreatmentImages.map((image) => (
                      <div key={`persisted-${image.id ?? image.url}`} className="overflow-hidden rounded-lg border bg-background">
                        {image.url ? (
                          <img
                            src={image.url}
                            alt={image.originalName || 'Saved treatment image'}
                            className="h-32 w-full bg-muted object-cover"
                          />
                        ) : (
                          <div className="flex h-32 items-center justify-center bg-muted text-xs text-muted-foreground">
                            Saved image
                          </div>
                        )}
                        <div className="space-y-2 p-3">
                          <p className="truncate text-xs font-medium">{image.originalName || `Image #${image.id}`}</p>
                          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                            <span>Saved on chart</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                removePersistedTreatmentImage(image.id);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {treatmentImagePreviews.map((preview) => (
                    <div key={preview.key} className="overflow-hidden rounded-lg border bg-background">
                      <img
                        src={preview.url}
                        alt={preview.file.name}
                        className="h-32 w-full bg-muted object-cover"
                      />
                      <div className="space-y-2 p-3">
                        <p className="truncate text-xs font-medium">{preview.file.name}</p>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>{TREATMENT_IMAGE_SOURCE_LABELS[imageSource]}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              removeTreatmentImage(preview.key);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editingTreatmentId !== null ? (
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <Label>Correction Reason</Label>
                <textarea
                  value={correctionReason}
                  onChange={(event) => {
                    setCorrectionReason(event.target.value);
                  }}
                  rows={3}
                  placeholder="Explain why this saved treatment is being corrected"
                  className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none"
                />
              </div>
            ) : null}

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
                Add Imaging Charge
              </Label>
              <Input
                value={imagePrice}
                onChange={(event) => {
                  setImagePrice(event.target.value);
                }}
                placeholder={`Imaging charge in ${currency}`}
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

              {materialReviewRows.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Material Review</p>
                    <div className="flex items-center gap-2">
                      {hasBlockingMaterialIssue ? <Badge className="bg-rose-600 text-white">Stock blocked</Badge> : null}
                      {!hasBlockingMaterialIssue && hasLowStockMaterialIssue ? <Badge className="bg-amber-500 text-white">Low stock warning</Badge> : null}
                      {!hasBlockingMaterialIssue && !hasLowStockMaterialIssue ? <Badge className="bg-emerald-600 text-white">Ready</Badge> : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {materialReviewRows.map((row) => (
                      <div key={`review-${row.key}`} className="rounded-md border bg-background p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{row.itemName}</p>
                            <p className="text-xs text-muted-foreground">
                              Requested {row.requestedQuantity} {row.unit} | Available {row.availableQuantity} | After save {row.remainingQuantity}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Min stock {row.minStock} {row.unit}{row.location ? ` | Location ${row.location}` : ''}{row.supplier ? ` | Supplier ${row.supplier}` : ''}
                            </p>
                          </div>
                          {row.status === 'shortage' ? (
                            <Badge className="bg-rose-600 text-white">Shortage</Badge>
                          ) : row.status === 'low_after' ? (
                            <Badge className="bg-amber-500 text-white">Low after save</Badge>
                          ) : (
                            <Badge className="bg-emerald-600 text-white">Healthy</Badge>
                          )}
                        </div>
                        {row.substituteOptions.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {row.substituteOptions.map((option) => (
                              <Button
                                key={`${row.key}-${option.id}`}
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => {
                                  applyMaterialSubstitute(row.key, option.id);
                                }}
                              >
                                Use {option.itemName} ({option.availableQuantity})
                              </Button>
                            ))}
                          </div>
                        ) : row.status !== 'healthy' ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            No same-category substitute with enough stock is available right now.
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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
                  style={
                    isActive
                      ? {
                          backgroundColor: condition.color,
                          borderColor: condition.color,
                          color: isLightColor(condition.color) ? '#0f172a' : '#ffffff',
                        }
                      : undefined
                  }
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

          <Card className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
            <CardHeader className="relative pb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl border border-emerald-200/50 bg-emerald-100/60 p-2">
                  <Stethoscope className="size-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-foreground">Maxilla (Upper Arch)</CardTitle>
                  <CardDescription>Upper teeth - click to mark conditions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 xl:grid-cols-16">
                {UPPER_ARCH.map((toothNumber) => {
                  const condition = toothConditions[toothNumber];
                  const isSelected = selectedToothNumber === toothNumber;
                  const toothMeta = resolveToothDisplayMeta(toothNumber);
                  const toothCode = resolveToothQuadrantCode(toothNumber);
                  const conditionColor = condition ? CONDITIONS[condition].color : '#d1d5db';
                  const selectionColor = condition ? conditionColor : (activeCondition ? CONDITIONS[activeCondition].color : '#94a3b8');

                  return (
                    <button
                      key={toothNumber}
                      type="button"
                      onClick={() => {
                        paintTooth(toothNumber);
                      }}
                      className={cn(
                        'relative flex h-28 min-w-0 flex-col items-center justify-between overflow-visible rounded-2xl border px-1.5 py-2 text-[10px] font-semibold transition-[border-color,background-color,box-shadow,transform] duration-200',
                        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:translate-y-0',
                        isSelected ? 'ring-2 ring-offset-1' : ''
                      )}
                      style={{
                        backgroundColor: isSelected
                          ? hexToRgba(selectionColor, 0.18)
                          : condition
                            ? hexToRgba(conditionColor, 0.1)
                            : 'var(--background)',
                        borderColor: isSelected ? selectionColor : condition ? hexToRgba(conditionColor, 0.4) : 'var(--border)',
                        boxShadow: isSelected
                          ? `0 10px 24px ${hexToRgba(selectionColor, 0.18)}`
                          : '0 1px 2px rgba(15,23,42,0.04)',
                        color: 'var(--foreground)',
                      }}
                      aria-label={`Tooth ${toothNumber} ${toothMeta.fullLabel}`}
                      title={`${toothCode} - ${toothMeta.fullLabel}`}
                    >
                      <span className="text-sm leading-none text-muted-foreground">
                        {toothCode}
                      </span>
                      <ToothGlyph
                        arch="maxilla"
                        isActive={isSelected}
                        visualType={toothMeta.visualType}
                      />
                      <span
                        className="absolute -bottom-2 left-1/2 block size-5 -translate-x-1/2 rounded-full border-2 border-background transition-transform duration-300"
                        style={{ backgroundColor: conditionColor }}
                      />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
            <CardHeader className="relative pb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl border border-blue-200/50 bg-blue-100/60 p-2">
                  <Stethoscope className="size-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-foreground">Mandible (Lower Arch)</CardTitle>
                  <CardDescription>Lower teeth - click to mark conditions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 xl:grid-cols-16">
                {LOWER_ARCH.map((toothNumber) => {
                  const condition = toothConditions[toothNumber];
                  const isSelected = selectedToothNumber === toothNumber;
                  const toothMeta = resolveToothDisplayMeta(toothNumber);
                  const toothCode = resolveToothQuadrantCode(toothNumber);
                  const conditionColor = condition ? CONDITIONS[condition].color : '#d1d5db';
                  const selectionColor = condition ? conditionColor : (activeCondition ? CONDITIONS[activeCondition].color : '#94a3b8');

                  return (
                    <button
                      key={toothNumber}
                      type="button"
                      onClick={() => {
                        paintTooth(toothNumber);
                      }}
                      className={cn(
                        'relative flex h-28 min-w-0 flex-col items-center justify-between overflow-visible rounded-2xl border px-1.5 py-2 text-[10px] font-semibold transition-[border-color,background-color,box-shadow,transform] duration-200',
                        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:translate-y-0',
                        isSelected ? 'ring-2 ring-offset-1' : ''
                      )}
                      style={{
                        backgroundColor: isSelected
                          ? hexToRgba(selectionColor, 0.18)
                          : condition
                            ? hexToRgba(conditionColor, 0.1)
                            : 'var(--background)',
                        borderColor: isSelected ? selectionColor : condition ? hexToRgba(conditionColor, 0.4) : 'var(--border)',
                        boxShadow: isSelected
                          ? `0 10px 24px ${hexToRgba(selectionColor, 0.18)}`
                          : '0 1px 2px rgba(15,23,42,0.04)',
                        color: 'var(--foreground)',
                      }}
                      aria-label={`Tooth ${toothNumber} ${toothMeta.fullLabel}`}
                      title={`${toothCode} - ${toothMeta.fullLabel}`}
                    >
                      <span className="text-sm leading-none text-muted-foreground">
                        {toothCode}
                      </span>
                      <ToothGlyph
                        arch="mandible"
                        isActive={isSelected}
                        visualType={toothMeta.visualType}
                      />
                      <span
                        className="absolute -bottom-2 left-1/2 block size-5 -translate-x-1/2 rounded-full border-2 border-background transition-transform duration-300"
                        style={{ backgroundColor: conditionColor }}
                      />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/50 bg-card shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl border border-violet-200/50 bg-violet-100/60 p-2">
                  <Paintbrush className="size-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-foreground">Condition Summary</CardTitle>
                  <CardDescription>Dental conditions distribution across all teeth</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.keys(CONDITIONS) as ConditionKey[]).map((key) => {
                  const count = conditionStats.find((item) => item.key === key)?.count ?? 0;
                  const percent = conditionStats.find((item) => item.key === key)?.percent ?? 0;
                  const color = CONDITIONS[key].color;

                  return (
                    <div key={key} className="rounded-xl border border-border/50 bg-background/60 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="size-3 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs font-medium text-foreground">{CONDITIONS[key].label}</span>
                        </div>
                        <span className="text-xs font-bold text-foreground">{percent}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            backgroundColor: color,
                            width: `${percent}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">{count} teeth affected</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between rounded-lg border bg-background p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Selected tooth: <span className="text-primary">{selectedToothNumber || 'None'}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedTreatment
                  ? `Treatment: ${selectedTreatment.name} (${selectedTreatment.category})`
                  : 'Select a treatment to save the selected condition on this tooth.'}
              </p>
            </div>
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {editingTreatmentId !== null ? 'Update Treatment' : 'Save Treatment'}
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
                {selectedToothNumber ? `${getToothRegion(selectedToothNumber)} ${selectedToothNumber}` : 'No tooth selected'}
              </p>
              {selectedToothNumber && selectedCondition ? (
                <Badge style={{ backgroundColor: CONDITIONS[selectedCondition].color, color: '#111827' }}>
                  {CONDITIONS[selectedCondition].label}
                </Badge>
              ) : selectedToothNumber ? (
                <Badge variant="outline">Healthy</Badge>
              ) : (
                <Badge variant="outline">Select a tooth</Badge>
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
              <span className="text-muted-foreground">Imaging</span>
              <span className="font-medium">
                {treatmentImages.length > 0
                  ? `${treatmentImages.length} ${TREATMENT_IMAGE_MODALITY_LABELS[imageModality]}`
                  : '-'}
              </span>
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
              Active condition:{' '}
              <span className="font-medium">
                {activeCondition ? CONDITIONS[activeCondition].label : 'None'}
              </span>
              . Click any tooth to apply this color.
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
                  const rowCurrency = parseCurrencyCodeFromNotes(row.notes);
                  const rowExchangeRate = parseExchangeRateFromNotes(row.notes, rowCurrency);
                  const rowPriceLabel = formatStoredAmount(
                    parseCurrency(row.price),
                    parseTagNumberFromNotes(row.notes, 'priceInput'),
                    rowCurrency,
                    rowExchangeRate
                  );
                  const rowImages = (row.treatmentImages ?? []).filter(
                    (image): image is Exclude<typeof image, File> =>
                      !(image instanceof File) && typeof image?.url === 'string' && image.url.length > 0
                  );
                  const rowImageModalityLabel = row.imageModality
                    ? TREATMENT_IMAGE_MODALITY_LABELS[row.imageModality]
                    : 'Image';

                  return (
                    <div key={row.id} className="rounded-md border p-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">
                          {treatmentName}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Total: {rowPriceLabel}</Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-[11px]"
                            onClick={() => {
                              startEditingTreatment(row);
                            }}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Button>
                        </div>
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
                      <p className="text-xs text-muted-foreground">
                        Imaging: {rowImages.length > 0 ? `${rowImages.length} ${rowImageModalityLabel}` : 'No images'}
                      </p>
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
                      {Array.isArray(row.correctionHistory) && row.correctionHistory.length > 0 ? (
                        <div className="mt-2 rounded-md border border-dashed border-border/70 bg-muted/20 p-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Correction History
                          </p>
                          <div className="mt-2 space-y-2">
                            {row.correctionHistory.slice(0, 3).map((entry) => (
                              <div key={`${row.id}-${entry.id ?? entry.createdAt}`} className="rounded-md bg-background/90 p-2 text-xs">
                                <p className="font-medium text-foreground">
                                  {entry.event === 'corrected' ? 'Corrected' : (entry.description || entry.event || 'Updated')}
                                </p>
                                <p className="text-muted-foreground">
                                  {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'} by {entry.changedBy || 'System'}
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                  Reason: {entry.correctionReason || '-'}
                                </p>
                                {Array.isArray(entry.changes) && entry.changes.length > 0 ? (
                                  <p className="mt-1 text-muted-foreground">
                                    Changed: {entry.changes.slice(0, 3).map((change) => change.label || change.field || 'Field').join(', ')}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {rowImages.length > 0 ? (
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {rowImages.map((image) => (
                            <a
                              key={`${row.id}-${image.id ?? image.url}`}
                              href={image.url}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-md border bg-muted/30"
                            >
                              <img
                                src={image.url}
                                alt={image.originalName || `${treatmentName} image`}
                                className="h-20 w-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      ) : null}
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
