<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Services\CurrencyService;
use App\Modules\DentalManagement\Domain\Services\WorkflowAccessService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\FinancialSetting\UpdateExchangeRateRequest;
use Illuminate\Http\JsonResponse;

final class FinancialSettingController extends BaseApiController
{
    public function __construct(
        private readonly CurrencyService $currencyService,
        private readonly WorkflowAccessService $workflowAccessService,
    ) {}

    public function showExchangeRate(): JsonResponse
    {
        abort_unless($this->workflowAccessService->canViewFinancialReports(auth()->user()), 403);

        return $this->successResponse(
            data: [
                'afnPerUsd' => $this->currencyService->getDefaultAfnPerUsd(),
            ],
            message: 'Exchange rate fetched successfully.'
        );
    }

    public function updateExchangeRate(UpdateExchangeRateRequest $request): JsonResponse
    {
        abort_unless($this->workflowAccessService->canUpdateExchangeRate($request->user()), 403);

        $rate = $this->currencyService->setDefaultAfnPerUsd((float) $request->validated('afnPerUsd'));

        return $this->successResponse(
            data: [
                'afnPerUsd' => $rate,
            ],
            message: 'Exchange rate updated successfully.'
        );
    }
}
