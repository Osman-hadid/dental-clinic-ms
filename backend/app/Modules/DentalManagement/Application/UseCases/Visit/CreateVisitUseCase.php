<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Visit;

use App\Modules\DentalManagement\Application\DTOs\VisitData;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Services\VisitService;

final readonly class CreateVisitUseCase
{
    public function __construct(
        private VisitService $visitService
    ) {}

    public function execute(VisitData $visitData): Visit
    {
        return $this->visitService->createVisit(data: $visitData->toArray());
    }
}
