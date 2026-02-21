<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Visit;

use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Services\VisitService;

final readonly class RestoreVisitUseCase
{
    public function __construct(private VisitService $visitService) {}

    public function execute(int $id): Visit
    {
        return $this->visitService->restoreVisit($id);
    }
}
