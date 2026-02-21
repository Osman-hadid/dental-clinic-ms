<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Repositories;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface AppointmentRepositoryInterface
{
    public function paginate(QuerySpecification $querySpecification): LengthAwarePaginator;

    public function find(int $id): Appointment;

    public function findTrashed(int $id): ?Appointment;

    public function create(array $data): Appointment;

    public function update(int $id, array $data): Appointment;

    public function delete(int $id): void;

    public function forceDelete(int $id): void;

    public function restore(int $id): Appointment;

    public function invalidateCache(): void;
}
