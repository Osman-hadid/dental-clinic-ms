<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Staff;

use App\Modules\DentalManagement\Domain\Services\StaffService;

final readonly class BulkDeleteStaffUseCase
{
    public function __construct(private StaffService $staffService) {}

    public function execute(array $ids): array
    {
        return $this->staffService->bulkDeleteStaff($ids);
    }
}
