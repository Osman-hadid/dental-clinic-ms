<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Patient;

use App\Modules\DentalManagement\Domain\Services\PatientService;

final readonly class BulkDeletePatientsUseCase
{
    public function __construct(private PatientService $patientService) {}

    public function execute(array $ids): array
    {
        return $this->patientService->bulkDeletePatients($ids);
    }
}
