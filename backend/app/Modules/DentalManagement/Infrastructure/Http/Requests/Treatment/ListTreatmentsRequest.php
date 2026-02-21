<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Treatment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;

final class ListTreatmentsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'name',
            'category',
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
            'name' => 'name',
            'category' => 'category',
            'description' => 'description',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'name' => 'name',
            'category' => 'category',
            'defaultPrice' => 'default_price',
            'durationMinutes' => 'duration_minutes',
            'description' => 'description',
            'enabled' => 'enabled',
            'createdBy' => 'created_by',
            'updatedBy' => 'updated_by',
            'deletedBy' => 'deleted_by',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
