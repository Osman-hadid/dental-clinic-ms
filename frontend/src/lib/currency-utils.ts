import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';

export type CurrencyCode = 'AFN' | 'USD';

export const DEFAULT_AFN_PER_USD = 1;
export const DEFAULT_CURRENCY: CurrencyCode = 'AFN';

const normalizeExchangeRate = (value: number): number => {
  const rate = Math.round(value * 1_000_000) / 1_000_000;
  return rate > 0 ? rate : DEFAULT_AFN_PER_USD;
};

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

/** Convert an entered amount to the AFN ledger base amount. */
export const convertInputToAfn = (
  amountInput: number,
  currency: CurrencyCode,
  afnPerUsd: number
): number => {
  if (currency === 'USD') {
    return roundMoney(amountInput * normalizeExchangeRate(afnPerUsd));
  }

  return roundMoney(amountInput);
};

/** @deprecated Use convertInputToAfn; the ledger base currency is AFN. */
export const convertInputToUsd = convertInputToAfn;

/** Convert an AFN ledger amount into the selected display/input currency. */
export const convertAfnToInput = (
  amountAfn: number,
  currency: CurrencyCode,
  afnPerUsd: number
): number => {
  if (currency === 'USD') {
    return roundMoney(amountAfn / normalizeExchangeRate(afnPerUsd));
  }

  return roundMoney(amountAfn);
};

/** @deprecated Use convertAfnToInput; the source amount is AFN. */
export const convertUsdToInput = convertAfnToInput;

export const formatCurrency = (value: number, currency: CurrencyCode): string => {
  const fractionDigits = currency === 'AFN' ? 0 : 2;

  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'fa-AF', {
    currency,
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    style: 'currency',
  }).format(value);
};

export const formatDualFromAfn = (amountAfn: number, afnPerUsd: number): string => {
  const normalizedAmount = roundMoney(amountAfn);
  const usdEquivalent = convertAfnToInput(normalizedAmount, 'USD', afnPerUsd);

  return `${formatCurrency(normalizedAmount, 'AFN')} / ${formatCurrency(usdEquivalent, 'USD')}`;
};

/** @deprecated Use formatDualFromAfn; the source amount is AFN. */
export const formatDualFromUsd = formatDualFromAfn;

export const getExchangeRate = async (client: AxiosClient): Promise<number> => {
  const response = await client.get<{ afnPerUsd: number }>(
    '/api/v1/dental-management/financial-settings/exchange-rate'
  );

  return normalizeExchangeRate(Number(response.data?.afnPerUsd ?? DEFAULT_AFN_PER_USD));
};

export const updateExchangeRate = async (
  client: AxiosClient,
  afnPerUsd: number
): Promise<number> => {
  const normalizedRate = normalizeExchangeRate(afnPerUsd);
  const response = await client.put<{ afnPerUsd: number }>(
    '/api/v1/dental-management/financial-settings/exchange-rate',
    { afnPerUsd: normalizedRate }
  );

  return normalizeExchangeRate(Number(response.data?.afnPerUsd ?? normalizedRate));
};
