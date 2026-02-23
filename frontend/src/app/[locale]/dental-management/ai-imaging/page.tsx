'use client';

import { JSX, useEffect, useMemo, useState } from 'react';
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

  const previewUrl = useMemo(() => {
    if (!file) return '';
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    setReportData(null);
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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Uploaded dental image preview"
                  className="max-h-[380px] w-full rounded-md border border-border object-contain bg-background"
                />
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
                {reportData.detections && reportData.detections.length > 0 ? (
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="mb-1 text-sm font-semibold">Detections</p>
                    <ul className="list-disc ps-5 text-sm text-muted-foreground">
                      {reportData.detections.map((detection, index) => (
                        <li key={`${detection.label}-${detection.x1}-${detection.y1}-${index}`}>
                          {detection.label} ({Math.round(detection.confidence * 100)}%) [{detection.x1},{detection.y1}] to [{detection.x2},{detection.y2}]
                        </li>
                      ))}
                    </ul>
                  </div>
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
