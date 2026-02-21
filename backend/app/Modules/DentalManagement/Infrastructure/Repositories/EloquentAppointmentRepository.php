<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Repositories\AppointmentRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Appointment\ListAppointmentsRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentAppointmentRepository extends BaseEloquentRepository implements AppointmentRepositoryInterface
{
    protected string $model = Appointment::class;

    protected string $requestClass = ListAppointmentsRequest::class;

    public function find(int $id): Appointment
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?Appointment
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): Appointment
    {
        return Appointment::create(attributes: $data);
    }

    public function update(int $id, array $data): Appointment
    {
        $appointment = $this->find($id);
        $appointment->update(attributes: $data);

        return $appointment;
    }

    public function delete(int $id): void
    {
        $appointment = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($appointment);
        $appointment->delete();
    }

    public function forceDelete(int $id): void
    {
        $appointment = Appointment::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($appointment);
        $appointment->forceDelete();
    }

    public function restore(int $id): Appointment
    {
        $appointment = Appointment::withTrashed()->findOrFail($id);
        $appointment->restore();

        return $appointment;
    }

    private function getAllowedFields(): array
    {
        $fields = request()->input('fields');
        if (!$fields) {
            return [];
        }

        $allowed = array_keys($this->requestClass::getFieldableColumns());
        $requested = array_filter(explode(',', (string) $fields));

        return array_intersect($requested, $allowed);
    }

    private function guardAgainstRelatedRecords(Appointment $appointment): void
    {
        if (method_exists($appointment, 'hasRelatedRecords') && $appointment->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'APPOINTMENT_IN_USE',
                message: 'Cannot delete appointment because it has related records.',
                httpCode: 409
            );
        }
    }
}
