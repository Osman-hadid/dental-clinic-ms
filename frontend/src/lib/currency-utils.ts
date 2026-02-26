import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';

export type CurrencyCode = 'AFN' | 'USD';

export const DEFAULT_AFN_PER_USD = 70;

export const parseMoney = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export const convertInputToUsd = (
  amountInput: number,
  currency: CurrencyCode,
  afnPerUsd: number
): number => {
  if (currency === 'AFN') {
    return roundMoney(amountInput / Math.max(afnPerUsd, 0.000001));
  }

  return roundMoney(amountInput);
};

export const convertUsdToInput = (
  amountUsd: number,
  currency: CurrencyCode,
  afnPerUsd: number
): number => {
  if (currency === 'AFN') {
    return roundMoney(amountUsd * Math.max(afnPerUsd, 0.000001));
  }

  return roundMoney(amountUsd);
};

export const formatCurrency = (value: number, currency: CurrencyCode): string => {
  const fractionDigits = currency === 'AFN' ? 0 : 2;

  return new Intl.NumberFormat('en-US', {
    currency,
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    style: 'currency',
  }).format(value);
};

export const formatDualFromUsd = (amountUsd: number, afnPerUsd: number): string => {
  return `${formatCurrency(amountUsd, 'USD')} / ${formatCurrency(amountUsd * afnPerUsd, 'AFN')}`;
};

export const getExchangeRate = async (client: AxiosClient): Promise<number> => {
  try {
    const response = await client.get<{ afnPerUsd?: number }>('/api/v1/dental-management/financial-settings/exchange-rate');
    const rate = Number(response.data?.afnPerUsd ?? DEFAULT_AFN_PER_USD);
    return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_AFN_PER_USD;
  } catch {
    return DEFAULT_AFN_PER_USD;
  }
};

export const updateExchangeRate = async (client: AxiosClient, afnPerUsd: number): Promise<number> => {
  const response = await client.put<{ afnPerUsd?: number }>(
    '/api/v1/dental-management/financial-settings/exchange-rate',
    { afnPerUsd }
  );
  const rate = Number(response.data?.afnPerUsd ?? afnPerUsd);
  return Number.isFinite(rate) && rate > 0 ? rate : afnPerUsd;
};
