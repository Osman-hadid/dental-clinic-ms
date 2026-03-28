<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Services\FinancialControlService;
use App\Modules\DentalManagement\Domain\Services\WorkflowAccessService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class FinancialControlController extends BaseApiController
{
    public function __construct(
        private readonly FinancialControlService $financialControlService,
        private readonly WorkflowAccessService $workflowAccessService,
    ) {}

    public function show(Request $request): JsonResponse
    {
        abort_unless($this->workflowAccessService->canViewFinancialControl($request->user()), 403);

        $validated = $request->validate([
            'closingDate' => 'nullable|date',
        ]);

        $closingDate = CarbonImmutable::parse((string) ($validated['closingDate'] ?? now()->format('Y-m-d')))->startOfDay();

        return $this->successResponse(
            data: $this->financialControlService->buildDashboard($closingDate),
            message: 'Financial control dashboard fetched successfully.'
        );
    }

    public function closeDay(Request $request): JsonResponse
    {
        abort_unless($this->workflowAccessService->canCloseFinancialDay($request->user()), 403);

        $validated = $request->validate([
            'closingDate' => 'required|date',
            'countedBalance' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:2000',
        ]);

        $closingDate = CarbonImmutable::parse((string) $validated['closingDate'])->startOfDay();
        $this->financialControlService->closeDay(
            closingDate: $closingDate,
            countedBalance: (float) $validated['countedBalance'],
            notes: isset($validated['notes']) ? (string) $validated['notes'] : null,
            closedBy: (int) ($request->user()?->id ?? 0) ?: null,
        );

        return $this->successResponse(
            data: $this->financialControlService->buildDashboard($closingDate),
            message: 'Day closing saved successfully.'
        );
    }
}
