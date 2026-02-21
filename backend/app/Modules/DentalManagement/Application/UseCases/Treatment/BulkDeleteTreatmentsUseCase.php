<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Treatment;

use App\Modules\DentalManagement\Domain\Services\TreatmentService;

final readonly class BulkDeleteTreatmentsUseCase
{
    public function __construct(private TreatmentService $treatmentService) {}

    public function execute(array $ids): array
    {
        return $this->treatmentService->bulkDeleteTreatments($ids);
    }
}
