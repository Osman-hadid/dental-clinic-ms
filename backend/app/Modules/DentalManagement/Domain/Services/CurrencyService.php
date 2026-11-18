<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\DentalManagement\Domain\Entities\FinancialSetting;

final class CurrencyService
{
    private const DEFAULT_AFN_PER_USD = 1.0;
    private const SUPPORTED_CURRENCIES = ['AFN', 'USD'];

    public function getDefaultAfnPerUsd(): float
    {
        $value = FinancialSetting::query()
            ->where('setting_key', 'afn_per_usd')
            ->value('setting_value');

        $rate = (float) ($value ?? self::DEFAULT_AFN_PER_USD);

        return $rate > 0 ? $rate : self::DEFAULT_AFN_PER_USD;
    }

    public function setDefaultAfnPerUsd(float $rate): float
    {
        $normalized = round($rate, 6);
        if ($normalized <= 0) {
            throw new ApiException(
                errorCode: 'INVALID_EXCHANGE_RATE',
                message: 'Exchange rate must be greater than zero.',
                httpCode: 422,
            );
        }

        FinancialSetting::query()->updateOrCreate(
            ['setting_key' => 'afn_per_usd'],
            ['setting_value' => (string) $normalized]
        );

        return $normalized;
    }

    public function normalizeCurrency(string $currency, ?float $exchangeRate = null): array
    {
        $normalizedCurrency = strtoupper(trim($currency));
        if ($normalizedCurrency === '') {
            $normalizedCurrency = 'AFN';
        }

        if (!\in_array($normalizedCurrency, self::SUPPORTED_CURRENCIES, true)) {
            throw new ApiException(
                errorCode: 'UNSUPPORTED_CURRENCY',
                message: 'Only AFN and USD are supported.',
                httpCode: 422,
            );
        }

        if ($normalizedCurrency === 'AFN') {
            return [
                'currency' => 'AFN',
                'exchangeRate' => 1.0,
            ];
        }

        return [
            'currency' => 'USD',
            'exchangeRate' => $this->normalizeExchangeRate($exchangeRate ?? $this->getDefaultAfnPerUsd()),
        ];
    }

    /**
     * Convert an entered amount to the ledger's base currency (AFN).
     *
     * The old method name, toUsd(), was misleading: the database and all
     * financial reports store AFN as the base amount. Keeping the conversion
     * here prevents individual modules from applying different rules.
     */
    public function toAfn(float $amountInput, string $currency, float $exchangeRate): float
    {
        if (strtoupper(trim($currency)) === 'USD') {
            return round($amountInput * $this->normalizeExchangeRate($exchangeRate), 2);
        }

        return round($amountInput, 2);
    }

    /** @deprecated Use toAfn() so the base-currency direction is explicit. */
    public function toUsd(float $amountInput, string $currency, float $exchangeRate): float
    {
        return $this->toAfn($amountInput, $currency, $exchangeRate);
    }

    private function normalizeExchangeRate(float $value): float
    {
        $rate = round($value, 6);
        if ($rate <= 0) {
            throw new ApiException(
                errorCode: 'INVALID_EXCHANGE_RATE',
                message: 'Exchange rate must be greater than zero.',
                httpCode: 422,
            );
        }

        return $rate;
    }
}
