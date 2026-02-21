<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Repositories\AppointmentRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class AppointmentService
{
    public function __construct(private AppointmentRepositoryInterface $appointmentRepository) {}

    public function listAppointments(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->appointmentRepository->paginate($querySpecification);
    }

    public function getAppointment(int $id): Appointment
    {
        return $this->appointmentRepository->find(id: $id);
    }

    public function restoreAppointment(int $id): Appointment
    {
        return tap(
            $this->appointmentRepository->restore($id),
            fn () => $this->appointmentRepository->invalidateCache()
        );
    }

    public function createAppointment(array $data): Appointment
    {
        return tap(
            $this->appointmentRepository->create(data: $data),
            fn () => $this->appointmentRepository->invalidateCache()
        );
    }

    public function updateAppointment(int $id, array $data): Appointment
    {
        return tap(
            $this->appointmentRepository->update(id: $id, data: $data),
            fn () => $this->appointmentRepository->invalidateCache()
        );
    }

    public function deleteAppointment(int $id): void
    {
        $this->appointmentRepository->delete(id: $id);
        $this->appointmentRepository->invalidateCache();
    }

    public function forceDeleteAppointment(int $id): void
    {
        $permission = $this->appointmentRepository->findTrashed($id) ?? $this->appointmentRepository->find($id);
        $this->appointmentRepository->forceDelete($permission->id);
        $this->appointmentRepository->invalidateCache();
    }

    public function bulkDeleteAppointments(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $appointment = $this->appointmentRepository->find($id);

            if (method_exists($appointment, 'hasRelatedRecords') && $appointment->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->appointmentRepository->delete(id: $id);
            $deleted[] = $id;
        }

        $this->appointmentRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }
}
