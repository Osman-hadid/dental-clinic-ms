import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';

const apiClient = new AxiosClient();

type QueryValue = boolean | number | string | undefined;

const resolveApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  const { hostname, origin, port, protocol } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalHost && port === '3000') {
    return `${protocol}//${hostname}:8000`;
  }

  return origin;
};

export const toInputDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const createDefaultReportRange = (days = 90): { endDate: string; startDate: string } => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    endDate: toInputDate(endDate),
    startDate: toInputDate(startDate),
  };
};

export const fetchReport = async <T>(path: string, params?: Record<string, QueryValue>): Promise<T> => {
  const response = await apiClient.get<T>(path, { params });

  return (response.data ?? null) as T;
};

const buildReportSearchParams = (params: Record<string, QueryValue>): URLSearchParams => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }
    searchParams.set(key, String(value));
  });

  return searchParams;
};

const extractFileName = (contentDisposition: string | null, fallbackType: string): string => {
  const encodedMatch = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }

  const plainMatch = contentDisposition?.match(/filename="?([^"]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return `${fallbackType}.csv`;
};

export const triggerReportExport = async (type: string, params: Record<string, QueryValue>): Promise<void> => {
  if (typeof window === 'undefined') {
    return;
  }

  const searchParams = buildReportSearchParams(params);
  const href = `${resolveApiBaseUrl()}/api/v1/dental-management/reports/exports/${type}?${searchParams.toString()}`;
  const response = await fetch(href, {
    credentials: 'include',
    headers: {
      Accept: 'text/csv,application/json',
    },
  });

  if (!response.ok) {
    let message = `Export failed with status ${response.status}.`;

    try {
      const payload = (await response.json()) as { error?: { details?: string; message?: string } };
      message = payload.error?.details || payload.error?.message || message;
    } catch {
      // Ignore JSON parsing errors and use the HTTP fallback message.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = extractFileName(response.headers.get('Content-Disposition'), type);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
};
