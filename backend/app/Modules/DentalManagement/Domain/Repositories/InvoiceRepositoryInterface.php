<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Repositories;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface InvoiceRepositoryInterface
{
    public function paginate(QuerySpecification $querySpecification): LengthAwarePaginator;

    public function find(int $id): Invoice;

    public function findTrashed(int $id): ?Invoice;

    public function create(array $data): Invoice;

    public function update(int $id, array $data): Invoice;

    public function delete(int $id): void;

    public function forceDelete(int $id): void;

    public function restore(int $id): Invoice;

    public function invalidateCache(): void;
}
