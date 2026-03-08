import { type AxiosRequestConfig } from 'axios';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';

type PaginatedRowsResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: {
    currentPage?: number;
    lastPage?: number;
  };
};

const PARALLEL_PAGE_BATCH_SIZE = 4;

const appendQueryValue = (
  queryParams: URLSearchParams,
  key: string,
  value: unknown
): void => {
  if (value === null || value === undefined || (typeof value === 'string' && value === '')) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      appendQueryValue(queryParams, `${key}[]`, item);
    });
    return;
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([nestedKey, nestedValue]) => {
      appendQueryValue(queryParams, `${key}[${nestedKey}]`, nestedValue);
    });
    return;
  }

  queryParams.append(key, String(value));
};

const toQueryParams = (
  params: Record<string, unknown>,
  page: number,
  perPage: number
): URLSearchParams => {
  const queryParams = new URLSearchParams();

  Object.entries({
    ...params,
    page,
    perPage,
  }).forEach(([key, value]) => {
    appendQueryValue(queryParams, key, value);
  });

  return queryParams;
};

const fetchPage = async (
  client: AxiosClient,
  endpoint: string,
  params: Record<string, unknown>,
  page: number,
  perPage: number,
  config?: AxiosRequestConfig
): Promise<PaginatedRowsResponse> => {
  const response = await client.get<PaginatedRowsResponse>(endpoint, {
    ...config,
    params: toQueryParams(params, page, perPage),
  });

  return response.data ?? {};
};

export const fetchAllRows = async (
  client: AxiosClient,
  endpoint: string,
  params: Record<string, unknown> = {},
  perPage: number = 100,
  config?: AxiosRequestConfig
): Promise<Array<Record<string, unknown>>> => {
  const firstPagePayload = await fetchPage(client, endpoint, params, 1, perPage, config);
  const firstPageRows = Array.isArray(firstPagePayload.data) ? firstPagePayload.data : [];
  const currentPage = Number(firstPagePayload.meta?.currentPage ?? 1);
  const lastPage = Number(firstPagePayload.meta?.lastPage ?? currentPage);

  if (firstPageRows.length === 0 || currentPage >= lastPage) {
    return firstPageRows;
  }

  const rows = [...firstPageRows];
  const remainingPages = Array.from({ length: Math.max(0, lastPage - currentPage) }, (_, index) => currentPage + index + 1);

  for (let index = 0; index < remainingPages.length; index += PARALLEL_PAGE_BATCH_SIZE) {
    const pageBatch = remainingPages.slice(index, index + PARALLEL_PAGE_BATCH_SIZE);
    const payloads = await Promise.all(
      pageBatch.map((page) => fetchPage(client, endpoint, params, page, perPage, config))
    );

    payloads.forEach((payload) => {
      const pageRows = Array.isArray(payload.data) ? payload.data : [];
      rows.push(...pageRows);
    });
  }

  return rows;
};
