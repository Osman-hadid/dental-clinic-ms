<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Staff;

use App\Modules\DentalManagement\Application\DTOs\StaffData;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Services\StaffService;

final readonly class CreateStaffUseCase
{
    public function __construct(
        private StaffService $staffService
    ) {}

    public function execute(StaffData $staffData): Staff
    {
        return $this->staffService->createStaff(data: $staffData->toArray());
    }
}
