'use client';

import { JSX, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';

type AiImagingReport = {
  confidence: number;
  concerns: string[];
  disclaimer: string;
  findings: string[];
  recommendations: string[];
  summary: string;
  urgency: string;
};

type DetectionBox = {
  confidence: number;
  label: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

type AiImagingResponse = {
  detectorModel?: string;
  detectorMeta?: {
    augment?: boolean;
    confUsed?: number;
    imgsz?: number;
    iou?: number;
    multiPass?: boolean;
    variantUsed?: string;
  };
  detectorWarning?: string;
  detections?: DetectionBox[];
  disclaimer: string;
  modality: string;
  provider?: string;
  model: string;
  rawText: string;
  report: AiImagingReport;
};

const MODALITY_OPTIONS = [
  { label: 'X-ray', value: 'xray' },
  { label: 'OPG (Panoramic)', value: 'opg' },
  { label: 'CBCT', value: 'cbct' },
  { label: 'Intraoral Photo', value: 'intraoral_photo' },
  { label: 'Other', value: 'other' },
] as const;

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const axiosLike = error as {
      message?: string;
      response?: { data?: { error?: { message?: string }; message?: string } };
    };

    return axiosLike.response?.data?.error?.message
      || axiosLike.response?.data?.message
      || axiosLike.message
      || 'Failed to analyze image.';
  }

  return 'Failed to analyze image.';
};

// eslint-disable-next-line react/function-component-definition
export default function AiImagingPage(): JSX.Element {
  const locale = useLocale();
  const tSidebar = useTranslations('sidebar.dentalManagement');

  const [file, setFile] = useState<File | null>(null);
  const [modality, setModality] = useState<string>('xray');
  const [patientContext, setPatientContext] = useState('');
  const [reportData, setReportData] = useState<AiImagingResponse | null>(null);
  const [errorText, setErrorText] = useState('');
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const [imageMetrics, setImageMetrics] = useState({
    naturalHeight: 0,
    naturalWidth: 0,
    renderedHeight: 0,
    renderedWidth: 0,
  });

  const groupedDetections = useMemo(() => {
    if (!reportData?.detections || reportData.detections.length === 0) {
      return [];
    }

    const grouped = new Map<string, { count: number; confidenceSum: number }>();
    reportData.detections.forEach((detection) => {
      const current = grouped.get(detection.label) || { confidenceSum: 0, count: 0 };
      current.count += 1;
      current.confidenceSum += detection.confidence;
      grouped.set(detection.label, current);
    });

    return Array.from(grouped.entries())
      .map(([label, value]) => ({
        avgConfidence: Math.round((value.confidenceSum / value.count) * 100),
        count: value.count,
        label,
      }))
      .sort((a, b) => b.count - a.count || b.avgConfidence - a.avgConfidence);
  }, [reportData]);

  const previewUrl = useMemo(() => {
    if (!file) return '';
    return URL.createObjectURL(file);
  }, [file]);

  const updateImageMetrics = (): void => {
    const image = previewImageRef.current;
    if (!image) return;

    setImageMetrics({
      naturalHeight: image.naturalHeight || 0,
      naturalWidth: image.naturalWidth || 0,
      renderedHeight: image.clientHeight || 0,
      renderedWidth: image.clientWidth || 0,
    });
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const onResize = (): void => {
      updateImageMetrics();
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const analyzeMutation = useMutation({
    mutationFn: async (): Promise<AiImagingResponse> => {
      if (!file) {
        throw new Error('Please upload an image first.');
      }

      const client = new AxiosClient();
      await client.get('/sanctum/csrf-cookie');

      const formData = new FormData();
      formData.append('image', file);
      formData.append('modality', modality);
      if (patientContext.trim()) {
        formData.append('patientContext', patientContext.trim());
      }

      const response = await client.post<AiImagingResponse>(
        '/api/v1/dental-management/ai-imaging/analyze',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || response.message || 'Analysis failed.');
      }

      return response.data;
    },
    onError: (error) => {
      setErrorText(extractErrorMessage(error));
    },
    onSuccess: (data) => {
      setErrorText('');
      setReportData(data);
    },
  });

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'aiImaging', isCurrent: true, label: tSidebar('aiImaging') },
        ]}
      />
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-6">
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                AI Imaging Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload dental images (X-ray, OPG, CBCT, intraoral photo) for a preliminary AI report.
                This does not replace clinical diagnosis.
              </p>

              <div className="space-y-2">
                <label htmlFor="modality" className="text-sm font-medium">
                  Modality
                </label>
                <select
                  id="modality"
                  value={modality}
                  onChange={(event) => {
                    setModality(event.target.value);
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {MODALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="image" className="text-sm font-medium">
                  Image File
                </label>
                <Input
                  id="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
                  onChange={(event) => {
                    setReportData(null);
                    setImageMetrics({
                      naturalHeight: 0,
                      naturalWidth: 0,
                      renderedHeight: 0,
                      renderedWidth: 0,
                    });
                    const selectedFile = event.target.files?.[0] ?? null;
                    setFile(selectedFile);
                  }}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="context" className="text-sm font-medium">
                  Optional Clinical Context
                </label>
                <textarea
                  id="context"
                  value={patientContext}
                  onChange={(event) => {
                    setPatientContext(event.target.value);
                  }}
                  placeholder="Symptoms, tooth area, pain history, prior treatment..."
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>

              {errorText ? (
                <p className="text-sm text-destructive">{errorText}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    analyzeMutation.mutate();
                  }}
                  disabled={!file || analyzeMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="me-2 size-4 animate-spin" />
                      Analyzing
                    </>
                  ) : (
                    'Analyze Image'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.open(`/${locale}/dental-management/ai-imaging`, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Open In New Tab
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Image Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {previewUrl ? (
                <div className="relative inline-block w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={previewImageRef}
                    src={previewUrl}
                    alt="Uploaded dental image preview"
                    onLoad={() => {
                      updateImageMetrics();
                    }}
                    className="max-h-[380px] w-full rounded-md border border-border object-contain bg-background"
                  />
                  {reportData?.detections && reportData.detections.length > 0 && imageMetrics.naturalWidth > 0 && imageMetrics.renderedWidth > 0 ? (
                    <div
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
                      style={{
                        height: `${imageMetrics.renderedHeight}px`,
                        width: `${imageMetrics.renderedWidth}px`,
                      }}
                    >
                      {reportData.detections.map((detection, index) => {
                        const left = (detection.x1 / imageMetrics.naturalWidth) * imageMetrics.renderedWidth;
                        const top = (detection.y1 / imageMetrics.naturalHeight) * imageMetrics.renderedHeight;
                        const width = ((detection.x2 - detection.x1) / imageMetrics.naturalWidth) * imageMetrics.renderedWidth;
                        const height = ((detection.y2 - detection.y1) / imageMetrics.naturalHeight) * imageMetrics.renderedHeight;

                        const color = detection.label.toLowerCase() === 'healthy' ? '#16a34a' : '#ef4444';

                        return (
                          <div
                            key={`${detection.label}-${detection.x1}-${detection.y1}-${index}`}
                            className="absolute"
                            style={{
                              border: `2px solid ${color}`,
                              height: `${Math.max(height, 2)}px`,
                              left: `${left}px`,
                              top: `${top}px`,
                              width: `${Math.max(width, 2)}px`,
                            }}
                          >
                            <span
                              className="absolute left-0 top-0 -translate-y-full rounded px-1 py-0.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: color }}
                            >
                              {detection.label} {Math.round(detection.confidence * 100)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                  No image selected.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 border-border bg-card">
          <CardHeader>
            <CardTitle>AI Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!reportData ? (
              <p className="text-sm text-muted-foreground">Run analysis to generate a report.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Model: <span className="text-foreground">{reportData.model}</span> | Modality:{' '}
                  <span className="text-foreground">{reportData.modality}</span> | Provider:{' '}
                  <span className="text-foreground">{reportData.provider || 'unknown'}</span>
                </p>
                {reportData.detectorModel ? (
                  <p className="text-sm text-muted-foreground">
                    Detector: <span className="text-foreground">{reportData.detectorModel}</span>
                  </p>
                ) : null}
                {reportData.detectorMeta ? (
                  <p className="text-sm text-muted-foreground">
                    Variant: <span className="text-foreground">{reportData.detectorMeta.variantUsed || 'original'}</span>
                    {' '}| Conf Used:{' '}
                    <span className="text-foreground">
                      {reportData.detectorMeta.confUsed ? `${Math.round(reportData.detectorMeta.confUsed * 100)}%` : 'n/a'}
                    </span>
                  </p>
                ) : null}
                {reportData.detectorWarning ? (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    {reportData.detectorWarning}
                  </p>
                ) : null}
                <p className="rounded-md border border-border bg-background p-3 text-sm">
                  <span className="font-semibold">Summary: </span>
                  {reportData.report.summary || 'No summary provided.'}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="mb-1 text-sm font-semibold">Findings</p>
                    <ul className="list-disc ps-5 text-sm text-muted-foreground">
                      {reportData.report.findings.length > 0 ? (
                        reportData.report.findings.map((item) => (
                          <li key={item}>{item}</li>
                        ))
                      ) : (
                        <li>No findings listed.</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="mb-1 text-sm font-semibold">Concerns</p>
                    <ul className="list-disc ps-5 text-sm text-muted-foreground">
                      {reportData.report.concerns.length > 0 ? (
                        reportData.report.concerns.map((item) => (
                          <li key={item}>{item}</li>
                        ))
                      ) : (
                        <li>No concerns listed.</li>
                      )}
                    </ul>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="mb-1 text-sm font-semibold">Recommendations</p>
                  <ul className="list-disc ps-5 text-sm text-muted-foreground">
                    {reportData.report.recommendations.length > 0 ? (
                      reportData.report.recommendations.map((item) => (
                        <li key={item}>{item}</li>
                      ))
                    ) : (
                      <li>No recommendations listed.</li>
                    )}
                  </ul>
                </div>
                {groupedDetections.length > 0 ? (
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="mb-1 text-sm font-semibold">Condition Overview</p>
                    <ul className="list-disc ps-5 text-sm text-muted-foreground">
                      {groupedDetections.map((group) => (
                        <li key={group.label}>
                          {group.label}: detected in {group.count} region(s), average confidence {group.avgConfidence}%
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {reportData.detections && reportData.detections.length > 0 ? (
                  <details className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                    <summary className="cursor-pointer font-semibold text-foreground">
                      Technical Detection Boxes
                    </summary>
                    <ul className="mt-2 list-disc ps-5">
                      {reportData.detections.map((detection, index) => (
                        <li key={`${detection.label}-${detection.x1}-${detection.y1}-${index}`}>
                          {detection.label} ({Math.round(detection.confidence * 100)}%) [{detection.x1},{detection.y1}] to [{detection.x2},{detection.y2}]
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Confidence: <span className="text-foreground">{reportData.report.confidence}%</span> | Urgency:{' '}
                  <span className="text-foreground">{reportData.report.urgency}</span>
                </p>
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {reportData.disclaimer || reportData.report.disclaimer}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
