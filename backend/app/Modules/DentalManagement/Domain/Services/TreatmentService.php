<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Treatment;
use App\Modules\DentalManagement\Domain\Repositories\TreatmentRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class TreatmentService
{
    public function __construct(private TreatmentRepositoryInterface $treatmentRepository) {}

    public function listTreatments(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->treatmentRepository->paginate($querySpecification);
    }

    public function getTreatment(int $id): Treatment
    {
        return $this->treatmentRepository->find(id: $id);
    }

    public function restoreTreatment(int $id): Treatment
    {
        return tap(
            $this->treatmentRepository->restore($id),
            fn () => $this->treatmentRepository->invalidateCache()
        );
    }

    public function createTreatment(array $data): Treatment
    {
        return tap(
            $this->treatmentRepository->create(data: $data),
            fn () => $this->treatmentRepository->invalidateCache()
        );
    }

    public function updateTreatment(int $id, array $data): Treatment
    {
        return tap(
            $this->treatmentRepository->update(id: $id, data: $data),
            fn () => $this->treatmentRepository->invalidateCache()
        );
    }

    public function deleteTreatment(int $id): void
    {
        $this->treatmentRepository->delete(id: $id);
        $this->treatmentRepository->invalidateCache();
    }

    public function forceDeleteTreatment(int $id): void
    {
        $permission = $this->treatmentRepository->findTrashed($id) ?? $this->treatmentRepository->find($id);
        $this->treatmentRepository->forceDelete($permission->id);
        $this->treatmentRepository->invalidateCache();
    }

    public function bulkDeleteTreatments(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $treatment = $this->treatmentRepository->find($id);

            if (method_exists($treatment, 'hasRelatedRecords') && $treatment->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->treatmentRepository->delete(id: $id);
            $deleted[] = $id;
        }

        $this->treatmentRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }
}
