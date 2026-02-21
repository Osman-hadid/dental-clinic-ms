<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Repositories\PatientRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Patient\ListPatientsRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentPatientRepository extends BaseEloquentRepository implements PatientRepositoryInterface
{
    protected string $model = Patient::class;

    protected string $requestClass = ListPatientsRequest::class;

    public function find(int $id): Patient
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?Patient
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): Patient
    {
        return Patient::create(attributes: $data);
    }

    public function update(int $id, array $data): Patient
    {
        $patient = $this->find($id);
        $patient->update(attributes: $data);

        return $patient;
    }

    public function delete(int $id): void
    {
        $patient = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($patient);
        $patient->delete();
    }

    public function forceDelete(int $id): void
    {
        $patient = Patient::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($patient);
        $patient->forceDelete();
    }

    public function restore(int $id): Patient
    {
        $patient = Patient::withTrashed()->findOrFail($id);
        $patient->restore();

        return $patient;
    }

    private function getAllowedFields(): array
    {
        $fields = request()->input('fields');
        if (!$fields) {
            return [];
        }

        $allowed = array_keys($this->requestClass::getFieldableColumns());
        $requested = array_filter(explode(',', (string) $fields));

        return array_intersect($requested, $allowed);
    }

    private function guardAgainstRelatedRecords(Patient $patient): void
    {
        if (method_exists($patient, 'hasRelatedRecords') && $patient->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'PATIENT_IN_USE',
                message: 'Cannot delete patient because it has related records.',
                httpCode: 409
            );
        }
    }
}
