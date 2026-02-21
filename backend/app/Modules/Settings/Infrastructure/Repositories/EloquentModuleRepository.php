<?php

declare(strict_types=1);

namespace App\Modules\Settings\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\Settings\Domain\Entities\Module;
use App\Modules\Settings\Domain\Repositories\ModuleRepositoryInterface;
use App\Modules\Settings\Infrastructure\Http\Requests\Module\ListModulesRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentModuleRepository extends BaseEloquentRepository implements ModuleRepositoryInterface
{
    protected string $model = Module::class;

    protected string $requestClass = ListModulesRequest::class;

    public function find(int $id): Module
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?Module
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): Module
    {
        return Module::create(attributes: $data);
    }

    public function update(int $id, array $data): Module
    {
        $module = $this->find($id);
        $module->update(attributes: $data);

        return $module;
    }

    public function delete(int $id): void
    {
        $module = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($module);
        $module->delete();
    }

    public function forceDelete(int $id): void
    {
        $module = Module::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($module);
        $module->forceDelete();
    }

    public function restore(int $id): Module
    {
        $module = Module::withTrashed()->findOrFail($id);
        $module->restore();

        return $module;
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

    private function guardAgainstRelatedRecords(Module $module): void
    {
        if (method_exists($module, 'hasRelatedRecords') && $module->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'MODULE_IN_USE',
                message: 'Cannot delete module because it has related records.',
                httpCode: 409
            );
        }
    }
}
