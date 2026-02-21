<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Tooth;
use App\Modules\DentalManagement\Domain\Repositories\ToothRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ToothService
{
    public function __construct(private ToothRepositoryInterface $toothRepository) {}

    public function listTeeth(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->toothRepository->paginate($querySpecification);
    }

    public function getTooth(int $id): Tooth
    {
        return $this->toothRepository->find(id: $id);
    }

    public function restoreTooth(int $id): Tooth
    {
        return tap(
            $this->toothRepository->restore($id),
            fn () => $this->toothRepository->invalidateCache()
        );
    }

    public function createTooth(array $data): Tooth
    {
        return tap(
            $this->toothRepository->create(data: $data),
            fn () => $this->toothRepository->invalidateCache()
        );
    }

    public function updateTooth(int $id, array $data): Tooth
    {
        return tap(
            $this->toothRepository->update(id: $id, data: $data),
            fn () => $this->toothRepository->invalidateCache()
        );
    }

    public function deleteTooth(int $id): void
    {
        $this->toothRepository->delete(id: $id);
        $this->toothRepository->invalidateCache();
    }

    public function forceDeleteTooth(int $id): void
    {
        $permission = $this->toothRepository->findTrashed($id) ?? $this->toothRepository->find($id);
        $this->toothRepository->forceDelete($permission->id);
        $this->toothRepository->invalidateCache();
    }

    public function bulkDeleteTeeth(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $tooth = $this->toothRepository->find($id);

            if (method_exists($tooth, 'hasRelatedRecords') && $tooth->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->toothRepository->delete(id: $id);
            $deleted[] = $id;
        }

        $this->toothRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }
}
