<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Repositories\VisitRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class VisitService
{
    public function __construct(private VisitRepositoryInterface $visitRepository) {}

    public function listVisits(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->visitRepository->paginate($querySpecification);
    }

    public function getVisit(int $id): Visit
    {
        return $this->visitRepository->find(id: $id);
    }

    public function restoreVisit(int $id): Visit
    {
        return tap(
            $this->visitRepository->restore($id),
            fn () => $this->visitRepository->invalidateCache()
        );
    }

    public function createVisit(array $data): Visit
    {
        return tap(
            $this->visitRepository->create(data: $data),
            fn () => $this->visitRepository->invalidateCache()
        );
    }

    public function updateVisit(int $id, array $data): Visit
    {
        return tap(
            $this->visitRepository->update(id: $id, data: $data),
            fn () => $this->visitRepository->invalidateCache()
        );
    }

    public function deleteVisit(int $id): void
    {
        $this->visitRepository->delete(id: $id);
        $this->visitRepository->invalidateCache();
    }

    public function forceDeleteVisit(int $id): void
    {
        $permission = $this->visitRepository->findTrashed($id) ?? $this->visitRepository->find($id);
        $this->visitRepository->forceDelete($permission->id);
        $this->visitRepository->invalidateCache();
    }

    public function bulkDeleteVisits(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $visit = $this->visitRepository->find($id);

            if (method_exists($visit, 'hasRelatedRecords') && $visit->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->visitRepository->delete(id: $id);
            $deleted[] = $id;
        }

        $this->visitRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }
}
