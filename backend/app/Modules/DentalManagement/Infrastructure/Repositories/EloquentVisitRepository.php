<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Repositories\VisitRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Visit\ListVisitsRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentVisitRepository extends BaseEloquentRepository implements VisitRepositoryInterface
{
    protected string $model = Visit::class;

    protected string $requestClass = ListVisitsRequest::class;

    public function find(int $id): Visit
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?Visit
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): Visit
    {
        return Visit::create(attributes: $data);
    }

    public function update(int $id, array $data): Visit
    {
        $visit = $this->find($id);
        $visit->update(attributes: $data);

        return $visit;
    }

    public function delete(int $id): void
    {
        $visit = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($visit);
        $visit->delete();
    }

    public function forceDelete(int $id): void
    {
        $visit = Visit::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($visit);
        $visit->forceDelete();
    }

    public function restore(int $id): Visit
    {
        $visit = Visit::withTrashed()->findOrFail($id);
        $visit->restore();

        return $visit;
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

    private function guardAgainstRelatedRecords(Visit $visit): void
    {
        if (method_exists($visit, 'hasRelatedRecords') && $visit->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'VISIT_IN_USE',
                message: 'Cannot delete visit because it has related records.',
                httpCode: 409
            );
        }
    }
}
