<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Treatment;

use App\Modules\DentalManagement\Domain\Services\TreatmentService;

final readonly class ForceDeleteTreatmentUseCase
{
    public function __construct(private TreatmentService $treatmentService) {}

    public function execute(int $id): void
    {
        $this->treatmentService->forceDeleteTreatment($id);
    }
}
