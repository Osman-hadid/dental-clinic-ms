<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Repositories\StaffRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class StaffService
{
    public function __construct(private StaffRepositoryInterface $staffRepository) {}

    public function listStaff(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->staffRepository->paginate($querySpecification);
    }

    public function getStaff(int $id): Staff
    {
        return $this->staffRepository->find(id: $id);
    }

    public function restoreStaff(int $id): Staff
    {
        return tap(
            $this->staffRepository->restore($id),
            fn () => $this->staffRepository->invalidateCache()
        );
    }

    public function createStaff(array $data): Staff
    {
        return tap(
            $this->staffRepository->create(data: $data),
            fn () => $this->staffRepository->invalidateCache()
        );
    }

    public function updateStaff(int $id, array $data): Staff
    {
        return tap(
            $this->staffRepository->update(id: $id, data: $data),
            fn () => $this->staffRepository->invalidateCache()
        );
    }

    public function deleteStaff(int $id): void
    {
        $this->staffRepository->delete(id: $id);
        $this->staffRepository->invalidateCache();
    }

    public function forceDeleteStaff(int $id): void
    {
        $permission = $this->staffRepository->findTrashed($id) ?? $this->staffRepository->find($id);
        $this->staffRepository->forceDelete($permission->id);
        $this->staffRepository->invalidateCache();
    }

    public function bulkDeleteStaff(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $staff = $this->staffRepository->find($id);

            if (method_exists($staff, 'hasRelatedRecords') && $staff->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->staffRepository->delete(id: $id);
            $deleted[] = $id;
        }

        $this->staffRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }
}
