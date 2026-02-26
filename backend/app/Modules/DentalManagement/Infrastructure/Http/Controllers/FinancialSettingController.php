<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Services\CurrencyService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\FinancialSetting\UpdateExchangeRateRequest;
use Illuminate\Http\JsonResponse;

final class FinancialSettingController extends BaseApiController
{
    public function __construct(private readonly CurrencyService $currencyService) {}

    public function showExchangeRate(): JsonResponse
    {
        return $this->successResponse(
            data: [
                'afnPerUsd' => $this->currencyService->getDefaultAfnPerUsd(),
            ],
            message: 'Exchange rate fetched successfully.'
        );
    }

    public function updateExchangeRate(UpdateExchangeRateRequest $request): JsonResponse
    {
        $rate = $this->currencyService->setDefaultAfnPerUsd((float) $request->validated('afnPerUsd'));

        return $this->successResponse(
            data: [
                'afnPerUsd' => $rate,
            ],
            message: 'Exchange rate updated successfully.'
        );
    }
}
