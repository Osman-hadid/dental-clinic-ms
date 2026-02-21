<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;

final class ListVisitTreatmentsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'price',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'visit',
            'treatment',
            'tooth',
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
            'notes' => 'notes',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'visitId' => 'visit_id',
            'treatmentId' => 'treatment_id',
            'toothId' => 'tooth_id',
            'dentistId' => 'dentist_id',
            'price' => 'price',
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
