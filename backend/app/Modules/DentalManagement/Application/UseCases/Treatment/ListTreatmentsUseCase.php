<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Treatment;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Services\TreatmentService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListTreatmentsUseCase
{
    public function __construct(private TreatmentService $treatmentService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->treatmentService->listTreatments($querySpecification);
    }
}
