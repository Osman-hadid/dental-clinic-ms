'use client';

import { JSX, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { useMutation } from '@tanstack/react-query';
import { BrainCircuit, FileText, Loader2 } from 'lucide-react';

type AiImagingReport = {
  confidence: number;
  concerns: string[];
  disclaimer: string;
  findings: string[];
  recommendations: string[];
  summary: string;
  urgency: string;
};

type AiImagingResponse = {
  analysisWarning?: string | null;
  disclaimer: string;
  modality: string;
  model: string;
  provider?: string;
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

    return (
      axiosLike.response?.data?.error?.message ||
      axiosLike.response?.data?.message ||
      axiosLike.message ||
      'Failed to analyze image.'
    );
  }

  return 'Failed to analyze image.';
};

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
      <div className="flex flex-1 flex-col gap-4 px-4 pb-6 lg:px-6">
        <Card className="overflow-hidden border-border bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_34%),linear-gradient(140deg,_rgba(15,23,42,0.98),_rgba(8,47,73,0.96))] text-white">
          <CardContent className="grid gap-5 py-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                <BrainCircuit className="size-3.5" />
                DentalGemma Workflow
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">AI imaging now focuses on report generation</h2>
                <p className="max-w-2xl text-sm text-cyan-50/85">
                  The old overlay and detection workflow has been removed from this page. Upload a
                  dental image to generate a narrative AI report designed for clinical review.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Preferred model</p>
                <p className="mt-2 text-sm font-semibold">DentalGemma 1.5 4B IT</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Fallback</p>
                <p className="mt-2 text-sm font-semibold">Gemini report mode</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Output</p>
                <p className="mt-2 text-sm font-semibold">Human-readable report</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="size-4 text-primary" />
                Report Intake
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a dental image and optional context. The AI will return a narrative report,
                concerns, and next-step recommendations rather than boxes or segmentation masks.
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
                    setErrorText('');
                    setFile(event.target.files?.[0] ?? null);
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
                  placeholder="Symptoms, suspected tooth, pain history, referral question..."
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>

              {errorText ? <p className="text-sm text-destructive">{errorText}</p> : null}

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
                      Generating Report
                    </>
                  ) : (
                    'Generate Report'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.open(
                      `/${locale}/dental-management/ai-imaging`,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }}
                >
                  Open In New Tab
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Image Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewUrl ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Uploaded dental image preview"
                    className="max-h-[420px] w-full rounded-xl border border-border object-contain bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    The uploaded image is used to generate a report. This page no longer draws
                    detection boxes or segmentation overlays.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                  Upload an image to preview it here.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>AI Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!reportData ? (
              <p className="text-sm text-muted-foreground">Generate a report to view the AI interpretation.</p>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Provider</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {reportData.provider || 'unknown'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Model</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{reportData.model}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Modality</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{reportData.modality}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Confidence</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {reportData.report.confidence}%
                    </p>
                  </div>
                </div>

                {reportData.analysisWarning ? (
                  <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    {reportData.analysisWarning}
                  </p>
                ) : null}

                <p className="rounded-2xl border border-border bg-background p-4 text-sm">
                  <span className="font-semibold">Summary: </span>
                  {reportData.report.summary || 'No summary provided.'}
                </p>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">Findings</p>
                    <ul className="list-disc ps-5 text-sm text-muted-foreground">
                      {reportData.report.findings.length > 0 ? (
                        reportData.report.findings.map((item) => <li key={item}>{item}</li>)
                      ) : (
                        <li>No findings listed.</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">Concerns</p>
                    <ul className="list-disc ps-5 text-sm text-muted-foreground">
                      {reportData.report.concerns.length > 0 ? (
                        reportData.report.concerns.map((item) => <li key={item}>{item}</li>)
                      ) : (
                        <li>No concerns listed.</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="mb-2 text-sm font-semibold text-foreground">Recommendations</p>
                  <ul className="list-disc ps-5 text-sm text-muted-foreground">
                    {reportData.report.recommendations.length > 0 ? (
                      reportData.report.recommendations.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No recommendations listed.</li>
                    )}
                  </ul>
                </div>

                <p className="text-sm text-muted-foreground">
                  Urgency: <span className="capitalize text-foreground">{reportData.report.urgency}</span>
                </p>

                {reportData.rawText ? (
                  <details className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    <summary className="cursor-pointer font-semibold text-foreground">
                      Raw Model Output
                    </summary>
                    <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
                      {reportData.rawText}
                    </pre>
                  </details>
                ) : null}

                <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
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
