<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\DentalManagement\Domain\Entities\FinancialSetting;

final class CurrencyService
{
    private const DEFAULT_AFN_PER_USD = 70.0;

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
        if (!\in_array($normalizedCurrency, ['USD', 'AFN'], true)) {
            throw new ApiException(
                errorCode: 'UNSUPPORTED_CURRENCY',
                message: 'Only USD and AFN are supported.',
                httpCode: 422,
            );
        }

        if ($normalizedCurrency === 'USD') {
            return [
                'currency' => 'USD',
                'exchangeRate' => 1.0,
            ];
        }

        $resolvedRate = $exchangeRate ?? $this->getDefaultAfnPerUsd();
        $resolvedRate = round($resolvedRate, 6);

        if ($resolvedRate <= 0) {
            throw new ApiException(
                errorCode: 'INVALID_EXCHANGE_RATE',
                message: 'Exchange rate must be greater than zero.',
                httpCode: 422,
            );
        }

        return [
            'currency' => 'AFN',
            'exchangeRate' => $resolvedRate,
        ];
    }

    public function toUsd(float $amountInput, string $currency, float $exchangeRate): float
    {
        $amount = round($amountInput, 2);

        if ($currency === 'AFN') {
            return round($amount / $exchangeRate, 2);
        }

        return $amount;
    }
}
