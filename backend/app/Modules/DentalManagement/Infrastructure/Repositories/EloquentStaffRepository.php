<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Repositories\StaffRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Staff\ListStaffRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentStaffRepository extends BaseEloquentRepository implements StaffRepositoryInterface
{
    protected string $model = Staff::class;

    protected string $requestClass = ListStaffRequest::class;

    public function find(int $id): Staff
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?Staff
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): Staff
    {
        return Staff::create(attributes: $data);
    }

    public function update(int $id, array $data): Staff
    {
        $staff = $this->find($id);
        $staff->update(attributes: $data);

        return $staff;
    }

    public function delete(int $id): void
    {
        $staff = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($staff);
        $staff->delete();
    }

    public function forceDelete(int $id): void
    {
        $staff = Staff::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($staff);
        $staff->forceDelete();
    }

    public function restore(int $id): Staff
    {
        $staff = Staff::withTrashed()->findOrFail($id);
        $staff->restore();

        return $staff;
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

    private function guardAgainstRelatedRecords(Staff $staff): void
    {
        if (method_exists($staff, 'hasRelatedRecords') && $staff->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'STAFF_IN_USE',
                message: 'Cannot delete staff because it has related records.',
                httpCode: 409
            );
        }
    }
}
