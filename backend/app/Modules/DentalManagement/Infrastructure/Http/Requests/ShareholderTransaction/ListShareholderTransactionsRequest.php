<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\ShareholderTransaction;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListShareholderTransactionsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'transaction_date',
            'amount',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'shareholder',
            'safeTransaction',
        ];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::exact('transactionType', 'transaction_type', true),
            AllowedFilter::exact('shareholderId', 'shareholder_id', true),
            AllowedFilter::exact('currency', 'currency', true),
            AllowedFilter::trashed(),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'transactionType' => 'transaction_type',
            'notes' => 'notes',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'shareholderId' => 'shareholder_id',
            'transactionDate' => 'transaction_date',
            'transactionType' => 'transaction_type',
            'amount' => 'amount',
            'amountInput' => 'amount_input',
            'currency' => 'currency',
            'exchangeRate' => 'exchange_rate',
            'safeTransactionId' => 'safe_transaction_id',
            'notes' => 'notes',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
