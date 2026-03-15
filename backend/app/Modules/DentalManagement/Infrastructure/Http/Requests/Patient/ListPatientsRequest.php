<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Patient;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListPatientsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'patient_code',
            'first_name',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'questionnaireResponses',
            'questionnaireResponses.question',
        ];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::exact('gender', 'gender', true),
            AllowedFilter::exact('status', 'status', true),
            AllowedFilter::exact('enabled', 'enabled', true),
            AllowedFilter::trashed(),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'id' => 'id',
            'patientCode' => 'patient_code',
            'firstName' => 'first_name',
            'lastName' => 'last_name',
            'contactNumber' => 'contact_number',
            'email' => 'email',
            'address' => 'address',
            'bloodGroup' => 'blood_group',
            'emergencyContact' => 'emergency_contact',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'patientCode' => 'patient_code',
            'firstName' => 'first_name',
            'lastName' => 'last_name',
            'gender' => 'gender',
            'dateOfBirth' => 'date_of_birth',
            'contactNumber' => 'contact_number',
            'email' => 'email',
            'address' => 'address',
            'bloodGroup' => 'blood_group',
            'emergencyContact' => 'emergency_contact',
            'enabled' => 'enabled',
            'status' => 'status',
            'remarks' => 'remarks',
            'createdBy' => 'created_by',
            'updatedBy' => 'updated_by',
            'deletedBy' => 'deleted_by',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
