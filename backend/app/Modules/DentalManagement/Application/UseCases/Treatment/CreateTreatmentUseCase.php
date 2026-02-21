<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Treatment;

use App\Modules\DentalManagement\Application\DTOs\TreatmentData;
use App\Modules\DentalManagement\Domain\Entities\Treatment;
use App\Modules\DentalManagement\Domain\Services\TreatmentService;

final readonly class CreateTreatmentUseCase
{
    public function __construct(
        private TreatmentService $treatmentService
    ) {}

    public function execute(TreatmentData $treatmentData): Treatment
    {
        return $this->treatmentService->createTreatment(data: $treatmentData->toArray());
    }
}
