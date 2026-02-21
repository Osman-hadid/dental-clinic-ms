<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\VisitTreatment;

use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Services\VisitTreatmentService;

final readonly class GetVisitTreatmentUseCase
{
    public function __construct(private VisitTreatmentService $visitTreatmentService) {}

    public function execute(int $id): VisitTreatment
    {
        return $this->visitTreatmentService->getVisitTreatment(id: $id);
    }
}
