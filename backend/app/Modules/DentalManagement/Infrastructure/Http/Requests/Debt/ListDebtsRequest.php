<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Debt;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListDebtsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'invoice_date',
            'debt_amount',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'patient',
            'invoice',
        ];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::exact('status', 'status', true),
            AllowedFilter::exact('invoiceId', 'invoice_id', true),
            AllowedFilter::exact('patientId', 'patient_id', true),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'status' => 'status',
            'invoiceId' => 'invoice_id',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'invoiceId' => 'invoice_id',
            'patientId' => 'patient_id',
            'invoiceDate' => 'invoice_date',
            'netAmount' => 'net_amount',
            'paidAmount' => 'paid_amount',
            'debtAmount' => 'debt_amount',
            'status' => 'status',
            'currency' => 'currency',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
        ];
    }
}

