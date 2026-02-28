<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Repositories\PatientRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\QueryException;
use RuntimeException;

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
        unset($data['patient_code']);

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $data['patient_code'] = $this->generatePatientCode();

            try {
                return tap(
                    $this->patientRepository->create(data: $data),
                    fn () => $this->patientRepository->invalidateCache()
                );
            } catch (QueryException $exception) {
                if (!$this->isDuplicatePatientCodeException($exception)) {
                    throw $exception;
                }
            }
        }

        throw new RuntimeException('Failed to generate a unique patient code.');
    }

    public function updatePatient(int $id, array $data): Patient
    {
        unset($data['patient_code']);

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

    private function generatePatientCode(): string
    {
        $today = now()->format('Y-m-d');
        $pattern = "/^P#(\\d+)-".preg_quote($today, '/')."$/";

        $maxSequence = Patient::withTrashed()
            ->where('patient_code', 'like', "P#%-{$today}")
            ->pluck('patient_code')
            ->reduce(function (int $max, mixed $value) use ($pattern): int {
                if (!is_string($value)) {
                    return $max;
                }

                if (!preg_match($pattern, $value, $matches)) {
                    return $max;
                }

                return max($max, (int) $matches[1]);
            }, 0);

        return "P#".($maxSequence + 1)."-{$today}";
    }

    private function isDuplicatePatientCodeException(QueryException $exception): bool
    {
        if ((string) $exception->getCode() !== '23000') {
            return false;
        }

        $message = strtolower((string) $exception->getMessage());

        return str_contains($message, 'patient_code') || str_contains($message, 'patients_patient_code_unique');
    }
}
