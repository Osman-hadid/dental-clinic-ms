<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\Treatment;
use App\Modules\DentalManagement\Domain\Repositories\TreatmentRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Treatment\ListTreatmentsRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentTreatmentRepository extends BaseEloquentRepository implements TreatmentRepositoryInterface
{
    protected string $model = Treatment::class;

    protected string $requestClass = ListTreatmentsRequest::class;

    public function find(int $id): Treatment
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?Treatment
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): Treatment
    {
        return Treatment::create(attributes: $data);
    }

    public function update(int $id, array $data): Treatment
    {
        $treatment = $this->find($id);
        $treatment->update(attributes: $data);

        return $treatment;
    }

    public function delete(int $id): void
    {
        $treatment = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($treatment);
        $treatment->delete();
    }

    public function forceDelete(int $id): void
    {
        $treatment = Treatment::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($treatment);
        $treatment->forceDelete();
    }

    public function restore(int $id): Treatment
    {
        $treatment = Treatment::withTrashed()->findOrFail($id);
        $treatment->restore();

        return $treatment;
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

    private function guardAgainstRelatedRecords(Treatment $treatment): void
    {
        if (method_exists($treatment, 'hasRelatedRecords') && $treatment->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'TREATMENT_IN_USE',
                message: 'Cannot delete treatment because it has related records.',
                httpCode: 409
            );
        }
    }
}
