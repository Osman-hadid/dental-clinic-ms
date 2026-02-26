<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\SafeTransaction;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListSafeTransactionsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'transaction_date',
            'amount',
            'currency',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'pickedByStaff',
        ];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::exact('direction', 'direction', true),
            AllowedFilter::exact('entryType', 'entry_type', true),
            AllowedFilter::exact('pickedByStaffId', 'picked_by_staff_id', true),
            AllowedFilter::exact('currency', 'currency', true),
            AllowedFilter::trashed(),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'notes' => 'notes',
            'sourceType' => 'source_type',
            'entryType' => 'entry_type',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'transactionDate' => 'transaction_date',
            'entryType' => 'entry_type',
            'direction' => 'direction',
            'amount' => 'amount',
            'amountInput' => 'amount_input',
            'currency' => 'currency',
            'exchangeRate' => 'exchange_rate',
            'sourceId' => 'source_id',
            'sourceType' => 'source_type',
            'pickedByStaffId' => 'picked_by_staff_id',
            'notes' => 'notes',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
