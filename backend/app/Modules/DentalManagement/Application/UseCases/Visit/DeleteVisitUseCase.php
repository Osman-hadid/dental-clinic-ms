<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Visit;

use App\Modules\DentalManagement\Domain\Services\VisitService;

final readonly class DeleteVisitUseCase
{
    public function __construct(private VisitService $visitService) {}

    public function execute(int $id): void
    {
        $this->visitService->deleteVisit(id: $id);
    }
}
