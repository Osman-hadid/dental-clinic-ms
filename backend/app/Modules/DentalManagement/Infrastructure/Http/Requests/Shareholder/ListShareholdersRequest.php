<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Shareholder;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListShareholdersRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'full_name',
            'ownership_percentage',
            'joined_date',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'transactions',
            'transactions.safeTransaction',
        ];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::exact('status', 'status', true),
            AllowedFilter::exact('currency', 'currency', true),
            AllowedFilter::trashed(),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'fullName' => 'full_name',
            'contactNumber' => 'contact_number',
            'email' => 'email',
            'address' => 'address',
            'notes' => 'notes',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'fullName' => 'full_name',
            'contactNumber' => 'contact_number',
            'email' => 'email',
            'address' => 'address',
            'ownershipPercentage' => 'ownership_percentage',
            'initialCapital' => 'initial_capital',
            'initialCapitalInput' => 'initial_capital_input',
            'currency' => 'currency',
            'exchangeRate' => 'exchange_rate',
            'joinedDate' => 'joined_date',
            'status' => 'status',
            'notes' => 'notes',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
