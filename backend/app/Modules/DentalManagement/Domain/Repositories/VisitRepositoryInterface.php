<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Repositories;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface VisitRepositoryInterface
{
    public function paginate(QuerySpecification $querySpecification): LengthAwarePaginator;

    public function find(int $id): Visit;

    public function findTrashed(int $id): ?Visit;

    public function create(array $data): Visit;

    public function update(int $id, array $data): Visit;

    public function delete(int $id): void;

    public function forceDelete(int $id): void;

    public function restore(int $id): Visit;

    public function invalidateCache(): void;
}
