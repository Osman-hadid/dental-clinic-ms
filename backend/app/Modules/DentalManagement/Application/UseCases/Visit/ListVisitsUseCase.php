<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Visit;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Services\VisitService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListVisitsUseCase
{
    public function __construct(private VisitService $visitService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->visitService->listVisits($querySpecification);
    }
}
