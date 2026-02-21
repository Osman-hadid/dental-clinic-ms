<?php

declare(strict_types=1);

namespace App\Modules\Settings\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Settings\Domain\Entities\Module;
use App\Modules\Settings\Domain\Repositories\ModuleRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ModuleService
{
    public function __construct(private ModuleRepositoryInterface $moduleRepository) {}

    public function listModules(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->moduleRepository->paginate($querySpecification);
    }

    public function getModule(int $id): Module
    {
        return $this->moduleRepository->find(id: $id);
    }

    public function restoreModule(int $id): Module
    {
        return tap(
            $this->moduleRepository->restore($id),
            fn () => $this->moduleRepository->invalidateCache()
        );
    }

    public function createModule(array $data): Module
    {
        return tap(
            $this->moduleRepository->create(data: $data),
            fn () => $this->moduleRepository->invalidateCache()
        );
    }

    public function updateModule(int $id, array $data): Module
    {
        return tap(
            $this->moduleRepository->update(id: $id, data: $data),
            fn () => $this->moduleRepository->invalidateCache()
        );
    }

    public function deleteModule(int $id): void
    {
        $this->moduleRepository->delete(id: $id);
        $this->moduleRepository->invalidateCache();
    }

    public function forceDeleteModule(int $id): void
    {
        $permission = $this->moduleRepository->findTrashed($id) ?? $this->moduleRepository->find($id);
        $this->moduleRepository->forceDelete($permission->id);
        $this->moduleRepository->invalidateCache();
    }

    public function bulkDeleteModules(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $module = $this->moduleRepository->find($id);

            if (method_exists($module, 'hasRelatedRecords') && $module->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->moduleRepository->delete(id: $id);
            $deleted[] = $id;
        }

        $this->moduleRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }
}
