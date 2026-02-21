<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Repositories;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface PaymentRepositoryInterface
{
    public function paginate(QuerySpecification $querySpecification): LengthAwarePaginator;

    public function find(int $id): Payment;

    public function findTrashed(int $id): ?Payment;

    public function create(array $data): Payment;

    public function update(int $id, array $data): Payment;

    public function delete(int $id): void;

    public function forceDelete(int $id): void;

    public function restore(int $id): Payment;

    public function invalidateCache(): void;
}
