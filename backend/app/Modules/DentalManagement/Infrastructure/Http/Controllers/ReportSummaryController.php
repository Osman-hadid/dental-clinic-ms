<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Services\ExecutiveReportSummaryService;
use App\Modules\DentalManagement\Domain\Services\ReportDatasetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ReportSummaryController extends BaseApiController
{
    public function __construct(
        private readonly ExecutiveReportSummaryService $executiveReportSummaryService,
        private readonly ReportDatasetService $reportDatasetService
    ) {}

    public function executive(Request $request): JsonResponse
    {
        abort_unless(auth()->user()?->can('dental-management.view'), 403);

        $validated = $this->validateSummaryFilters($request);

        return $this->successResponse(
            data: $this->executiveReportSummaryService->build($validated),
            message: 'Executive report summary fetched successfully.'
        );
    }

    public function financial(Request $request): JsonResponse
    {
        abort_unless(auth()->user()?->can('dental-management.view'), 403);

        $validated = $this->validateSummaryFilters($request);

        return $this->successResponse(
            data: $this->reportDatasetService->buildFinancial($validated),
            message: 'Financial report dataset fetched successfully.'
        );
    }

    public function clinical(Request $request): JsonResponse
    {
        abort_unless(auth()->user()?->can('dental-management.view'), 403);

        $validated = $this->validateSummaryFilters($request);

        return $this->successResponse(
            data: $this->reportDatasetService->buildClinical($validated),
            message: 'Clinical report dataset fetched successfully.'
        );
    }

    private function validateSummaryFilters(Request $request): array
    {
        return $request->validate([
            'startDate' => 'required|date',
            'endDate' => 'required|date|after_or_equal:startDate',
            'granularity' => 'nullable|in:day,month,year',
            'statusFilter' => 'nullable|in:all,cancelled,completed,pending',
            'dentistFilter' => 'nullable|string|max:255',
            'treatmentFilter' => 'nullable|string|max:255',
            'paymentMethodFilter' => 'nullable|string|max:255',
            'patientFilter' => 'nullable|string|max:255',
        ]);
    }
}
