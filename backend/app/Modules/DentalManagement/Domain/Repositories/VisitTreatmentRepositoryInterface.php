<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Repositories;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface VisitTreatmentRepositoryInterface
{
    public function paginate(QuerySpecification $querySpecification): LengthAwarePaginator;

    public function find(int $id): VisitTreatment;

    public function findTrashed(int $id): ?VisitTreatment;

    public function create(array $data): VisitTreatment;

    public function update(int $id, array $data): VisitTreatment;

    public function delete(int $id): void;

    public function forceDelete(int $id): void;

    public function restore(int $id): VisitTreatment;

    public function invalidateCache(): void;
}
