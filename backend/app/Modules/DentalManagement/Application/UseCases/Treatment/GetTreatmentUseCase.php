<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Treatment;

use App\Modules\DentalManagement\Domain\Entities\Treatment;
use App\Modules\DentalManagement\Domain\Services\TreatmentService;

final readonly class GetTreatmentUseCase
{
    public function __construct(private TreatmentService $treatmentService) {}

    public function execute(int $id): Treatment
    {
        return $this->treatmentService->getTreatment(id: $id);
    }
}
