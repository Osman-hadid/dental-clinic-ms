import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';

export type CurrencyCode = 'AFN';

export const DEFAULT_AFN_PER_USD = 1;

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
  _currency: CurrencyCode,
  _afnPerUsd: number
): number => {
  void _currency;
  void _afnPerUsd;
  return roundMoney(amountInput);
};

export const convertUsdToInput = (
  amountUsd: number,
  _currency: CurrencyCode,
  _afnPerUsd: number
): number => {
  void _currency;
  void _afnPerUsd;
  return roundMoney(amountUsd);
};

export const formatCurrency = (value: number, currency: CurrencyCode): string => {
  const fractionDigits = currency === 'AFN' ? 0 : 2;

  return new Intl.NumberFormat('af-AF', {
    currency,
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    style: 'currency',
  }).format(value);
};

export const formatDualFromUsd = (amountUsd: number, _afnPerUsd: number): string => {
  void _afnPerUsd;
  return formatCurrency(amountUsd, 'AFN');
};

export const getExchangeRate = async (_client: AxiosClient): Promise<number> => {
  void _client;
  return DEFAULT_AFN_PER_USD;
};

export const updateExchangeRate = async (_client: AxiosClient, _afnPerUsd: number): Promise<number> => {
  void _client;
  void _afnPerUsd;
  return DEFAULT_AFN_PER_USD;
};
