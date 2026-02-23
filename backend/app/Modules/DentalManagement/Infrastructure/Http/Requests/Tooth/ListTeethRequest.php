<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Tooth;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListTeethRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'tooth_number',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::trashed(),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'toothNumber' => 'tooth_number',
            'description' => 'description',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'toothNumber' => 'tooth_number',
            'description' => 'description',
            'createdBy' => 'created_by',
            'updatedBy' => 'updated_by',
            'deletedBy' => 'deleted_by',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
