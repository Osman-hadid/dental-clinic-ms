<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Repositories\VisitTreatmentRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment\ListVisitTreatmentsRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentVisitTreatmentRepository extends BaseEloquentRepository implements VisitTreatmentRepositoryInterface
{
    protected string $model = VisitTreatment::class;

    protected string $requestClass = ListVisitTreatmentsRequest::class;

    public function find(int $id): VisitTreatment
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?VisitTreatment
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): VisitTreatment
    {
        return VisitTreatment::create(attributes: $data);
    }

    public function update(int $id, array $data): VisitTreatment
    {
        $visitTreatment = $this->find($id);
        $visitTreatment->update(attributes: $data);

        return $visitTreatment;
    }

    public function delete(int $id): void
    {
        $visitTreatment = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($visitTreatment);
        $visitTreatment->delete();
    }

    public function forceDelete(int $id): void
    {
        $visitTreatment = VisitTreatment::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($visitTreatment);
        $visitTreatment->forceDelete();
    }

    public function restore(int $id): VisitTreatment
    {
        $visitTreatment = VisitTreatment::withTrashed()->findOrFail($id);
        $visitTreatment->restore();

        return $visitTreatment;
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

    private function guardAgainstRelatedRecords(VisitTreatment $visitTreatment): void
    {
        if (method_exists($visitTreatment, 'hasRelatedRecords') && $visitTreatment->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'VISIT_TREATMENT_IN_USE',
                message: 'Cannot delete visit_treatment because it has related records.',
                httpCode: 409
            );
        }
    }
}
