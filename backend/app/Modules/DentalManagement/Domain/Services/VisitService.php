<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
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
        $visit = $this->visitRepository->restore($id);
        $this->syncAppointmentStatus($visit->appointment_id);
        $this->visitRepository->invalidateCache();

        return $visit;
    }

    public function createVisit(array $data): Visit
    {
        $visit = $this->visitRepository->create(data: $data);
        $this->syncAppointmentStatus($visit->appointment_id);
        $this->visitRepository->invalidateCache();

        return $visit;
    }

    public function updateVisit(int $id, array $data): Visit
    {
        $existingVisit = $this->visitRepository->find($id);
        $previousAppointmentId = $existingVisit->appointment_id;

        $visit = $this->visitRepository->update(id: $id, data: $data);
        $currentAppointmentId = $visit->appointment_id;

        $this->syncAppointmentStatus($previousAppointmentId);
        if ($currentAppointmentId !== $previousAppointmentId) {
            $this->syncAppointmentStatus($currentAppointmentId);
        }

        $this->visitRepository->invalidateCache();

        return $visit;
    }

    public function deleteVisit(int $id): void
    {
        $visit = $this->visitRepository->find($id);
        $appointmentId = $visit->appointment_id;

        $this->visitRepository->delete(id: $id);
        $this->syncAppointmentStatus($appointmentId);
        $this->visitRepository->invalidateCache();
    }

    public function forceDeleteVisit(int $id): void
    {
        $visit = $this->visitRepository->findTrashed($id) ?? $this->visitRepository->find($id);
        $appointmentId = $visit->appointment_id;

        $this->visitRepository->forceDelete($visit->id);
        $this->syncAppointmentStatus($appointmentId);
        $this->visitRepository->invalidateCache();
    }

    public function bulkDeleteVisits(array $ids): array
    {
        $deleted = [];
        $skipped = [];
        $appointmentsToSync = [];

        foreach ($ids as $id) {
            $visit = $this->visitRepository->find($id);

            if (method_exists($visit, 'hasRelatedRecords') && $visit->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->visitRepository->delete(id: $id);
            if ($visit->appointment_id !== null) {
                $appointmentsToSync[] = (int) $visit->appointment_id;
            }
            $deleted[] = $id;
        }

        foreach (array_unique($appointmentsToSync) as $appointmentId) {
            $this->syncAppointmentStatus($appointmentId);
        }

        $this->visitRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }

    private function syncAppointmentStatus(?int $appointmentId): void
    {
        if ($appointmentId === null) {
            return;
        }

        $appointment = Appointment::query()->find($appointmentId);
        if (!$appointment) {
            return;
        }

        $hasActiveVisits = Visit::query()
            ->where('appointment_id', $appointmentId)
            ->whereNull('deleted_at')
            ->exists();

        $nextStatus = null;
        if ($hasActiveVisits) {
            $nextStatus = 'completed';
        } elseif ($appointment->status === 'completed') {
            $nextStatus = 'scheduled';
        }

        if ($nextStatus !== null && $appointment->status !== $nextStatus) {
            $appointment->forceFill(['status' => $nextStatus])->save();
        }
    }
}
