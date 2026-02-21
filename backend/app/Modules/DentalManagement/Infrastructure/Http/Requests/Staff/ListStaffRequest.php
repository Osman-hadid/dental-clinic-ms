<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Staff;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;

final class ListStaffRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'full_name',
            'role',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [];
    }

    protected static function filters(): array
    {
        return [];
    }

    protected static function searchableColumns(): array
    {
        return [
            'fullName' => 'full_name',
            'specialization' => 'specialization',
            'contactNumber' => 'contact_number',
            'email' => 'email',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'fullName' => 'full_name',
            'role' => 'role',
            'specialization' => 'specialization',
            'contactNumber' => 'contact_number',
            'email' => 'email',
            'hireDate' => 'hire_date',
            'enabled' => 'enabled',
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
