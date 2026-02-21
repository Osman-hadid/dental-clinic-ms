<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\VisitTreatment;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Services\VisitTreatmentService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListVisitTreatmentsUseCase
{
    public function __construct(private VisitTreatmentService $visitTreatmentService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->visitTreatmentService->listVisitTreatments($querySpecification);
    }
}
