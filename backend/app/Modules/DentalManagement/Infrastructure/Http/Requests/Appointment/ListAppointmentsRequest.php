<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Appointment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListAppointmentsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'tag',
            'appointment_date',
            'start_time',
            'status',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'patient',
            'dentist',
        ];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::callback('dateFrom', static function ($query, $value): void {
                $resolved = \is_array($value) ? ($value[0] ?? null) : $value;
                if ($resolved === null || $resolved === '') {
                    return;
                }

                $query->where('appointment_date', '>=', (string) $resolved);
            }),
            AllowedFilter::callback('dateTo', static function ($query, $value): void {
                $resolved = \is_array($value) ? ($value[0] ?? null) : $value;
                if ($resolved === null || $resolved === '') {
                    return;
                }

                $query->where('appointment_date', '<=', (string) $resolved);
            }),
            AllowedFilter::exact('status', 'status', true),
            AllowedFilter::trashed(),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'tag' => 'tag',
            'notes' => 'notes',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'patientId' => 'patient_id',
            'dentistId' => 'dentist_id',
            'tag' => 'tag',
            'appointmentDate' => 'appointment_date',
            'startTime' => 'start_time',
            'endTime' => 'end_time',
            'status' => 'status',
            'notes' => 'notes',
            'createdBy' => 'created_by',
            'updatedBy' => 'updated_by',
            'deletedBy' => 'deleted_by',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
