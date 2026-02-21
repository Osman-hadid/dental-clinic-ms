<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Repositories;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface StaffRepositoryInterface
{
    public function paginate(QuerySpecification $querySpecification): LengthAwarePaginator;

    public function find(int $id): Staff;

    public function findTrashed(int $id): ?Staff;

    public function create(array $data): Staff;

    public function update(int $id, array $data): Staff;

    public function delete(int $id): void;

    public function forceDelete(int $id): void;

    public function restore(int $id): Staff;

    public function invalidateCache(): void;
}
