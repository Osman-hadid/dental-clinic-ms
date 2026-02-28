<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\DentalManagement\Domain\Entities\FinancialSetting;

final class CurrencyService
{
    private const DEFAULT_AFN_PER_USD = 1.0;

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
        if ($normalizedCurrency !== 'AFN') {
            throw new ApiException(
                errorCode: 'UNSUPPORTED_CURRENCY',
                message: 'Only AFN is supported.',
                httpCode: 422,
            );
        }

        return [
            'currency' => 'AFN',
            'exchangeRate' => 1.0,
        ];
    }

    public function toUsd(float $amountInput, string $currency, float $exchangeRate): float
    {
        return round($amountInput, 2);
    }
}
