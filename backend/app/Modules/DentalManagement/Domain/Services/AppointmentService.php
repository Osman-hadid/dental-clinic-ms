<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\Exceptions\ApiException;
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
        $this->assertNoScheduleConflict($data);

        return tap(
            $this->appointmentRepository->create(data: $data),
            fn () => $this->appointmentRepository->invalidateCache()
        );
    }

    public function updateAppointment(int $id, array $data): Appointment
    {
        $this->assertNoScheduleConflict($data, $id);

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

    private function assertNoScheduleConflict(array $data, ?int $ignoreId = null): void
    {
        if (!isset($data['dentist_id'], $data['appointment_date'], $data['start_time'], $data['end_time'])) {
            return;
        }

        $start = (string) $data['start_time'];
        $end = (string) $data['end_time'];

        $conflictExists = Appointment::query()
            ->where('dentist_id', (int) $data['dentist_id'])
            ->whereDate('appointment_date', (string) $data['appointment_date'])
            ->when($ignoreId !== null, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->whereRaw('start_time < ? AND COALESCE(end_time, start_time) > ?', [$end, $start])
            ->exists();

        if ($conflictExists) {
            throw new ApiException(
                errorCode: 'APPOINTMENT_TIME_CONFLICT',
                message: 'The selected dentist already has an appointment in this time slot.',
                details: [
                    'appointmentDate' => (string) $data['appointment_date'],
                    'dentistId' => (int) $data['dentist_id'],
                    'endTime' => $end,
                    'startTime' => $start,
                ],
                httpCode: 409,
            );
        }
    }
}
