<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\Tooth;
use App\Modules\DentalManagement\Domain\Repositories\ToothRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Tooth\ListTeethRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentToothRepository extends BaseEloquentRepository implements ToothRepositoryInterface
{
    protected string $model = Tooth::class;

    protected string $requestClass = ListTeethRequest::class;

    public function find(int $id): Tooth
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?Tooth
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): Tooth
    {
        return Tooth::create(attributes: $data);
    }

    public function update(int $id, array $data): Tooth
    {
        $tooth = $this->find($id);
        $tooth->update(attributes: $data);

        return $tooth;
    }

    public function delete(int $id): void
    {
        $tooth = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($tooth);
        $tooth->delete();
    }

    public function forceDelete(int $id): void
    {
        $tooth = Tooth::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($tooth);
        $tooth->forceDelete();
    }

    public function restore(int $id): Tooth
    {
        $tooth = Tooth::withTrashed()->findOrFail($id);
        $tooth->restore();

        return $tooth;
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

    private function guardAgainstRelatedRecords(Tooth $tooth): void
    {
        if (method_exists($tooth, 'hasRelatedRecords') && $tooth->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'TOOTH_IN_USE',
                message: 'Cannot delete tooth because it has related records.',
                httpCode: 409
            );
        }
    }
}
