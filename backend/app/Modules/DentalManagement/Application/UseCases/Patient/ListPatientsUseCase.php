<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Patient;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Services\PatientService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListPatientsUseCase
{
    public function __construct(private PatientService $patientService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->patientService->listPatients($querySpecification);
    }
}
