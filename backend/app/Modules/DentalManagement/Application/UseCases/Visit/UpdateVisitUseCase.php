<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Visit;

use App\Modules\DentalManagement\Application\DTOs\VisitData;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Services\VisitService;

final readonly class UpdateVisitUseCase
{
    public function __construct(private VisitService $visitService) {}

    public function execute(int $id, VisitData $visitData): Visit
    {
        return $this->visitService->updateVisit(id: $id, data: $visitData->toArray());
    }
}
