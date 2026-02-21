<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Visit;

use App\Modules\DentalManagement\Domain\Services\VisitService;

final readonly class BulkDeleteVisitsUseCase
{
    public function __construct(private VisitService $visitService) {}

    public function execute(array $ids): array
    {
        return $this->visitService->bulkDeleteVisits($ids);
    }
}
