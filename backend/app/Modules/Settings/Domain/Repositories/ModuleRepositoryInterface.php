<?php

declare(strict_types=1);

namespace App\Modules\Settings\Domain\Repositories;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Settings\Domain\Entities\Module;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface ModuleRepositoryInterface
{
    public function paginate(QuerySpecification $querySpecification): LengthAwarePaginator;

    public function find(int $id): Module;

    public function findTrashed(int $id): ?Module;

    public function create(array $data): Module;

    public function update(int $id, array $data): Module;

    public function delete(int $id): void;

    public function forceDelete(int $id): void;

    public function restore(int $id): Module;

    public function invalidateCache(): void;
}
