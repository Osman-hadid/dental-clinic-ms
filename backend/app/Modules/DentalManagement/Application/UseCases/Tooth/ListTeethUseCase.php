<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Tooth;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Services\ToothService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListTeethUseCase
{
    public function __construct(private ToothService $toothService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->toothService->listTeeth($querySpecification);
    }
}
