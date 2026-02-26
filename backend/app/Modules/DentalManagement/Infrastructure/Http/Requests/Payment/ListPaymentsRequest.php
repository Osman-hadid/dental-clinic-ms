<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Payment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListPaymentsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'payment_date',
            'amount',
            'currency',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'invoice',
        ];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::exact('method', 'method', true),
            AllowedFilter::exact('currency', 'currency', true),
            AllowedFilter::trashed(),
        ];
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
            'invoiceId' => 'invoice_id',
            'paymentDate' => 'payment_date',
            'amount' => 'amount',
            'amountInput' => 'amount_input',
            'currency' => 'currency',
            'exchangeRate' => 'exchange_rate',
            'method' => 'method',
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
