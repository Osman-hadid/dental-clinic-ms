<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Models\User;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Services\ReportAccessLogService;
use App\Modules\DentalManagement\Domain\Services\ReportExportService;
use App\Modules\DentalManagement\Domain\Services\ReportReadService;
use App\Modules\DentalManagement\Domain\Services\ReportSnapshotService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports\ClinicalExpenseReportRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports\DailyExpenseReportRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports\DebtReportRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports\MetricReportRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports\ReportExportRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports\SafeReportRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports\SalaryReportRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports\ShareholderReportRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports\StoreReportSnapshotRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports\UpdateReportSnapshotScheduleRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ReportController extends BaseApiController
{
    public function __construct(
        private readonly ReportAccessLogService $reportAccessLogService,
        private readonly ReportExportService $reportExportService,
        private readonly ReportReadService $reportReadService,
        private readonly ReportSnapshotService $reportSnapshotService,
    ) {}

    public function filterOptions(MetricReportRequest $request): JsonResponse
    {
        return $this->reportResponse('reports', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->filterOptions($filters), 'Report filter options fetched successfully.');
    }

    public function executive(MetricReportRequest $request): JsonResponse
    {
        return $this->reportResponse('executive', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->executive($filters), 'Executive report fetched successfully.');
    }

    public function financial(MetricReportRequest $request): JsonResponse
    {
        return $this->reportResponse('financial', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->financial($filters), 'Financial report fetched successfully.');
    }

    public function clinical(MetricReportRequest $request): JsonResponse
    {
        return $this->reportResponse('clinical', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->clinical($filters), 'Clinical report fetched successfully.');
    }

    public function inventory(MetricReportRequest $request): JsonResponse
    {
        return $this->reportResponse('inventory', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->inventory($filters), 'Inventory report fetched successfully.');
    }

    public function audit(MetricReportRequest $request): JsonResponse
    {
        return $this->reportResponse('audit', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->audit($filters), 'Audit report fetched successfully.');
    }

    public function dailyExpenses(DailyExpenseReportRequest $request): JsonResponse
    {
        return $this->reportResponse('daily-expenses', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->dailyExpenses($filters), 'Daily expenses report fetched successfully.');
    }

    public function clinicalExpenses(ClinicalExpenseReportRequest $request): JsonResponse
    {
        return $this->reportResponse('clinical-expenses', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->clinicalExpenses($filters), 'Clinical expenses report fetched successfully.');
    }

    public function debts(DebtReportRequest $request): JsonResponse
    {
        return $this->reportResponse('debts', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->debts($filters), 'Debt report fetched successfully.');
    }

    public function safe(SafeReportRequest $request): JsonResponse
    {
        return $this->reportResponse('safe', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->safe($filters), 'Safe report fetched successfully.');
    }

    public function salaries(SalaryReportRequest $request): JsonResponse
    {
        return $this->reportResponse('salaries', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->salaries($filters), 'Salary report fetched successfully.');
    }

    public function shareholders(ShareholderReportRequest $request): JsonResponse
    {
        return $this->reportResponse('shareholders', 'view', $request->validated(), fn (array $filters): array => $this->reportReadService->shareholders($filters), 'Shareholder report fetched successfully.');
    }

    public function export(ReportExportRequest $request, string $type): StreamedResponse
    {
        $this->authorizeReports();
        $filters = $request->validated();
        $this->reportAccessLogService->log(
            user: $this->currentUser(),
            reportKey: $type,
            action: 'export',
            filters: $filters,
            meta: ['format' => (string) ($filters['format'] ?? 'csv')],
        );

        return $this->reportExportService->streamCsv($type, $filters);
    }

    public function snapshots(Request $request): JsonResponse
    {
        $this->authorizeReports();
        $user = $this->currentUser();
        abort_unless($user !== null, 403);

        $reportKey = trim((string) $request->query('reportKey', 'executive')) ?: 'executive';
        $limit = max(1, min(100, (int) $request->query('limit', 60)));
        $filters = ['limit' => $limit, 'reportKey' => $reportKey];

        $this->reportAccessLogService->log($user, $reportKey, 'view', $filters);

        return $this->successResponse(
            data: $this->reportSnapshotService->list($user, $reportKey, $limit),
            message: 'Report snapshots fetched successfully.'
        );
    }

    public function storeSnapshot(StoreReportSnapshotRequest $request): JsonResponse
    {
        $this->authorizeReports();
        $user = $this->currentUser();
        abort_unless($user !== null, 403);

        $validated = $request->validated();
        $snapshot = $this->reportSnapshotService->capture(
            user: $user,
            filters: (array) ($validated['filters'] ?? []),
            reportKey: (string) ($validated['reportKey'] ?? 'executive'),
            reason: (string) ($validated['reason'] ?? 'manual'),
        );

        return $this->successResponse(
            data: $this->reportSnapshotService->snapshotPayload($snapshot),
            message: 'Report snapshot created successfully.',
            code: 201
        );
    }

    public function snapshotSchedule(Request $request): JsonResponse
    {
        $this->authorizeReports();
        $user = $this->currentUser();
        abort_unless($user !== null, 403);

        $reportKey = trim((string) $request->query('reportKey', 'executive')) ?: 'executive';
        $schedule = $this->reportSnapshotService->schedule($user, $reportKey);

        return $this->successResponse(
            data: $this->reportSnapshotService->schedulePayload($schedule),
            message: 'Report snapshot schedule fetched successfully.'
        );
    }

    public function updateSnapshotSchedule(UpdateReportSnapshotScheduleRequest $request): JsonResponse
    {
        $this->authorizeReports();
        $user = $this->currentUser();
        abort_unless($user !== null, 403);

        $schedule = $this->reportSnapshotService->updateSchedule($user, $request->validated());

        return $this->successResponse(
            data: $this->reportSnapshotService->schedulePayload($schedule),
            message: 'Report snapshot schedule updated successfully.'
        );
    }

    /**
     * @param array<string, mixed> $filters
     * @param \Closure(array<string, mixed>): array<string, mixed> $callback
     */
    private function reportResponse(string $reportKey, string $action, array $filters, \Closure $callback, string $message): JsonResponse
    {
        $this->authorizeReports();
        $this->reportAccessLogService->log(
            user: $this->currentUser(),
            reportKey: $reportKey,
            action: $action,
            filters: $filters,
        );

        return $this->successResponse(
            data: $callback($filters),
            message: $message
        );
    }

    private function authorizeReports(): void
    {
        abort_unless($this->currentUser()?->can('dental-management.view'), 403);
    }

    private function currentUser(): ?User
    {
        $user = auth()->user();

        return $user instanceof User ? $user : null;
    }
}
