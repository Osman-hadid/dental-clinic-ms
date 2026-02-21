<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Patient;

use App\Modules\DentalManagement\Domain\Services\PatientService;

final readonly class DeletePatientUseCase
{
    public function __construct(private PatientService $patientService) {}

    public function execute(int $id): void
    {
        $this->patientService->deletePatient(id: $id);
    }
}
