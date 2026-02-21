<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Visit;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;

final class ListVisitsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'visit_date',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'appointment',
            'patient',
            'dentist',
        ];
    }

    protected static function filters(): array
    {
        return [];
    }

    protected static function searchableColumns(): array
    {
        return [
            'diagnosisNotes' => 'diagnosis_notes',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'appointmentId' => 'appointment_id',
            'patientId' => 'patient_id',
            'dentistId' => 'dentist_id',
            'visitDate' => 'visit_date',
            'diagnosisNotes' => 'diagnosis_notes',
            'nextVisitDate' => 'next_visit_date',
            'createdBy' => 'created_by',
            'updatedBy' => 'updated_by',
            'deletedBy' => 'deleted_by',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
