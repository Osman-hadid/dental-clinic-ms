<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Staff;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Services\StaffService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListStaffUseCase
{
    public function __construct(private StaffService $staffService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->staffService->listStaff($querySpecification);
    }
}
