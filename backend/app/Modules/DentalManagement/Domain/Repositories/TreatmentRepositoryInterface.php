<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Repositories;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Treatment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface TreatmentRepositoryInterface
{
    public function paginate(QuerySpecification $querySpecification): LengthAwarePaginator;

    public function find(int $id): Treatment;

    public function findTrashed(int $id): ?Treatment;

    public function create(array $data): Treatment;

    public function update(int $id, array $data): Treatment;

    public function delete(int $id): void;

    public function forceDelete(int $id): void;

    public function restore(int $id): Treatment;

    public function invalidateCache(): void;
}
