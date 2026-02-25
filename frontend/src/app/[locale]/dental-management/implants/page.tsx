'use client';

import { JSX, useMemo, useState } from 'react';
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
import {
  ListVisitTreatmentsUseCase,
} from '@/modules/dental-management/application/use-cases/visit-treatments/list-visit-treatments-use-case';
import {
  ListVisitsUseCase,
} from '@/modules/dental-management/application/use-cases/visits/list-visits-use-case';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import { VisitTreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/visit-treatment-repository';
import { VisitRepository } from '@/modules/dental-management/infrastructure/repositories/visit-repository';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Printer, RefreshCcw, ShieldAlert } from 'lucide-react';
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
  imagingType: ImagingType;
  implantArch: ImplantArch;
  implantDiameterMm: string;
  implantLengthMm: string;
  implantPricePerTooth: string;
  implantSystem: string;
  insertionTorqueNcm: string;
  keratinizedTissueMm: string;
  loadingProtocol: LoadingProtocol;
  notes: string;
  patientId: string;
  primaryStabilityIsq: string;
  prosthesisType: string;
  riskFactors: RiskFactorKey[];
  surgeryGuideType: 'freehand' | 'pilot' | 'fully-guided';
  visitDate: string;
};

type ChecklistItem = {
  complete: boolean;
  label: string;
};

const RISK_FACTOR_LABELS: Record<RiskFactorKey, string> = {
  bisphosphonateUse: 'Bisphosphonate/anti-resorptive history',
  bruxism: 'Bruxism or heavy occlusal load',
  periodontitisHistory: 'History of periodontitis',
  poorHygiene: 'Poor oral hygiene/plaque control',
  smoking: 'Smoker',
  uncontrolledDiabetes: 'Uncontrolled diabetes',
};

const DEFAULT_FORM: ImplantPlanningForm = {
  boneHeightMm: '',
  boneWidthMm: '',
  imagingType: 'cbct',
  implantArch: 'maxilla',
  implantDiameterMm: '',
  implantLengthMm: '',
  implantPricePerTooth: '',
  implantSystem: '',
  insertionTorqueNcm: '',
  keratinizedTissueMm: '',
  loadingProtocol: 'delayed',
  notes: '',
  patientId: '',
  primaryStabilityIsq: '',
  prosthesisType: 'Single crown',
  riskFactors: [],
  surgeryGuideType: 'pilot',
  visitDate: '',
};

const toNumber = (value: string): number | null => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
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
  const [form, setForm] = useState<ImplantPlanningForm>(DEFAULT_FORM);
  const [selectedTeethByPatient, setSelectedTeethByPatient] = useState<Record<string, string[]>>({});
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
  const totalAllImplantsPayment = implantPricePerTooth * implantTeethFromChart.length;

  const selectedPatient = useMemo(
    () => allPatients.find((patient) => String(patient.id) === form.patientId),
    [allPatients, form.patientId]
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
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    value={form.patientId || undefined}
                    onValueChange={(value) => {
                      setField('patientId', value);
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
                  <Input
                    type="date"
                    value={form.visitDate}
                    onChange={(event) => {
                      setField('visitDate', event.target.value);
                    }}
                  />
                  <Input
                    placeholder="Implant teeth from chart"
                    value={implantTeethFromChart.join(', ')}
                    readOnly
                  />
                  {form.patientId && !isLoadingImplantTeeth && implantTeethFromChart.length === 0 ? (
                    <p className="text-xs text-muted-foreground md:col-span-2">
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
                <h3 className="text-sm font-semibold">Implant Payment</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Payment for one implant"
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
                    placeholder="Total payment (selected implants)"
                    value={formatCurrency(totalSelectedImplantsPayment)}
                    readOnly
                  />
                  <Input
                    placeholder="Total payment (all chart implants)"
                    value={formatCurrency(totalAllImplantsPayment)}
                    readOnly
                  />
                </div>
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
                  variant="outline"
                  onClick={() => {
                    setForm(DEFAULT_FORM);
                  }}
                >
                  <RefreshCcw className="me-2 size-4" />
                  Reset
                </Button>
                <Button
                  type="button"
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
