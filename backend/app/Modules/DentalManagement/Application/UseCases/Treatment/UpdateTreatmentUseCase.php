<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Treatment;

use App\Modules\DentalManagement\Application\DTOs\TreatmentData;
use App\Modules\DentalManagement\Domain\Entities\Treatment;
use App\Modules\DentalManagement\Domain\Services\TreatmentService;

final readonly class UpdateTreatmentUseCase
{
    public function __construct(private TreatmentService $treatmentService) {}

    public function execute(int $id, TreatmentData $treatmentData): Treatment
    {
        return $this->treatmentService->updateTreatment(id: $id, data: $treatmentData->toArray());
    }
}
