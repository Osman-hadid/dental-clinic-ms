<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Repositories\VisitTreatmentRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class VisitTreatmentService
{
    public function __construct(private VisitTreatmentRepositoryInterface $visitTreatmentRepository) {}

    public function listVisitTreatments(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->visitTreatmentRepository->paginate($querySpecification);
    }

    public function getVisitTreatment(int $id): VisitTreatment
    {
        return $this->visitTreatmentRepository->find(id: $id);
    }

    public function restoreVisitTreatment(int $id): VisitTreatment
    {
        return tap(
            $this->visitTreatmentRepository->restore($id),
            fn () => $this->visitTreatmentRepository->invalidateCache()
        );
    }

    public function createVisitTreatment(array $data): VisitTreatment
    {
        return tap(
            $this->visitTreatmentRepository->create(data: $data),
            fn () => $this->visitTreatmentRepository->invalidateCache()
        );
    }

    public function updateVisitTreatment(int $id, array $data): VisitTreatment
    {
        return tap(
            $this->visitTreatmentRepository->update(id: $id, data: $data),
            fn () => $this->visitTreatmentRepository->invalidateCache()
        );
    }

    public function deleteVisitTreatment(int $id): void
    {
        $this->visitTreatmentRepository->delete(id: $id);
        $this->visitTreatmentRepository->invalidateCache();
    }

    public function forceDeleteVisitTreatment(int $id): void
    {
        $permission = $this->visitTreatmentRepository->findTrashed($id) ?? $this->visitTreatmentRepository->find($id);
        $this->visitTreatmentRepository->forceDelete($permission->id);
        $this->visitTreatmentRepository->invalidateCache();
    }

    public function bulkDeleteVisitTreatments(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $visitTreatment = $this->visitTreatmentRepository->find($id);

            if (method_exists($visitTreatment, 'hasRelatedRecords') && $visitTreatment->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->visitTreatmentRepository->delete(id: $id);
            $deleted[] = $id;
        }

        $this->visitTreatmentRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }
}
