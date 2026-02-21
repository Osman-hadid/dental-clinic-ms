<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\VisitTreatment;

use App\Modules\DentalManagement\Application\DTOs\VisitTreatmentData;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Services\VisitTreatmentService;

final readonly class CreateVisitTreatmentUseCase
{
    public function __construct(
        private VisitTreatmentService $visitTreatmentService
    ) {}

    public function execute(VisitTreatmentData $visitTreatmentData): VisitTreatment
    {
        return $this->visitTreatmentService->createVisitTreatment(data: $visitTreatmentData->toArray());
    }
}
