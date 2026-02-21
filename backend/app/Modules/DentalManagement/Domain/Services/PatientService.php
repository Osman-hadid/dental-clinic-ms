<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Repositories\PatientRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class PatientService
{
    public function __construct(private PatientRepositoryInterface $patientRepository) {}

    public function listPatients(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->patientRepository->paginate($querySpecification);
    }

    public function getPatient(int $id): Patient
    {
        return $this->patientRepository->find(id: $id);
    }

    public function restorePatient(int $id): Patient
    {
        return tap(
            $this->patientRepository->restore($id),
            fn () => $this->patientRepository->invalidateCache()
        );
    }

    public function createPatient(array $data): Patient
    {
        return tap(
            $this->patientRepository->create(data: $data),
            fn () => $this->patientRepository->invalidateCache()
        );
    }

    public function updatePatient(int $id, array $data): Patient
    {
        return tap(
            $this->patientRepository->update(id: $id, data: $data),
            fn () => $this->patientRepository->invalidateCache()
        );
    }

    public function deletePatient(int $id): void
    {
        $this->patientRepository->delete(id: $id);
        $this->patientRepository->invalidateCache();
    }

    public function forceDeletePatient(int $id): void
    {
        $permission = $this->patientRepository->findTrashed($id) ?? $this->patientRepository->find($id);
        $this->patientRepository->forceDelete($permission->id);
        $this->patientRepository->invalidateCache();
    }

    public function bulkDeletePatients(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $patient = $this->patientRepository->find($id);

            if (method_exists($patient, 'hasRelatedRecords') && $patient->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->patientRepository->delete(id: $id);
            $deleted[] = $id;
        }

        $this->patientRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }
}
