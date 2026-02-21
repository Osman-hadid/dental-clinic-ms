<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Staff;

use App\Modules\DentalManagement\Domain\Services\StaffService;

final readonly class DeleteStaffUseCase
{
    public function __construct(private StaffService $staffService) {}

    public function execute(int $id): void
    {
        $this->staffService->deleteStaff(id: $id);
    }
}
