<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\InventoryItem;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListInventoryItemsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'entry_date',
            'item_name',
            'quantity',
            'total_cost',
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
            AllowedFilter::exact('category', 'category', true),
            AllowedFilter::exact('acquisitionSource', 'acquisition_source', true),
            AllowedFilter::trashed(),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'itemName' => 'item_name',
            'category' => 'category',
            'supplier' => 'supplier',
            'lotNumber' => 'lot_number',
            'location' => 'location',
            'notes' => 'notes',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'acquisitionSource' => 'acquisition_source',
            'entryDate' => 'entry_date',
            'itemName' => 'item_name',
            'category' => 'category',
            'quantity' => 'quantity',
            'unit' => 'unit',
            'minStock' => 'min_stock',
            'unitCost' => 'unit_cost',
            'totalCost' => 'total_cost',
            'supplier' => 'supplier',
            'lotNumber' => 'lot_number',
            'expiryDate' => 'expiry_date',
            'location' => 'location',
            'notes' => 'notes',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}

