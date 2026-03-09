<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

final class ReportReadService
{
    public function __construct(
        private readonly ReportDashboardService $dashboardService,
        private readonly ReportSubpageService $subpageService,
    ) {}

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function filterOptions(array $filters): array
    {
        return $this->dashboardService->filterOptions($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function executive(array $filters): array
    {
        return $this->dashboardService->executive($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function financial(array $filters): array
    {
        return $this->dashboardService->financial($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function clinical(array $filters): array
    {
        return $this->dashboardService->clinical($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function inventory(array $filters): array
    {
        return $this->dashboardService->inventory($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function audit(array $filters): array
    {
        return $this->dashboardService->audit($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function dailyExpenses(array $filters): array
    {
        return $this->subpageService->dailyExpenses($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function clinicalExpenses(array $filters): array
    {
        return $this->subpageService->clinicalExpenses($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function debts(array $filters): array
    {
        return $this->subpageService->debts($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function safe(array $filters): array
    {
        return $this->subpageService->safe($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function salaries(array $filters): array
    {
        return $this->subpageService->salaries($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function shareholders(array $filters): array
    {
        return $this->subpageService->shareholders($filters);
    }
}
