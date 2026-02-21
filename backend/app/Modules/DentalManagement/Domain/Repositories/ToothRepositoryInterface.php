<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Repositories;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Tooth;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface ToothRepositoryInterface
{
    public function paginate(QuerySpecification $querySpecification): LengthAwarePaginator;

    public function find(int $id): Tooth;

    public function findTrashed(int $id): ?Tooth;

    public function create(array $data): Tooth;

    public function update(int $id, array $data): Tooth;

    public function delete(int $id): void;

    public function forceDelete(int $id): void;

    public function restore(int $id): Tooth;

    public function invalidateCache(): void;
}
