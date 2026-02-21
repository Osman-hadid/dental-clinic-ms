<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\VisitTreatment;

use App\Modules\DentalManagement\Domain\Services\VisitTreatmentService;

final readonly class BulkDeleteVisitTreatmentsUseCase
{
    public function __construct(private VisitTreatmentService $visitTreatmentService) {}

    public function execute(array $ids): array
    {
        return $this->visitTreatmentService->bulkDeleteVisitTreatments($ids);
    }
}
