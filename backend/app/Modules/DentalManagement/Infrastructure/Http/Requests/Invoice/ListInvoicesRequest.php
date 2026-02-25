<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Invoice;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListInvoicesRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'invoice_date',
            'net_amount',
            'status',
            'payment_type',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'patient',
            'visit',
            'payments',
        ];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::exact('patientId', 'patient_id', true),
            AllowedFilter::exact('visitId', 'visit_id', true),
            AllowedFilter::exact('status', 'status', true),
            AllowedFilter::exact('paymentType', 'payment_type', true),
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
            'patientId' => 'patient_id',
            'visitId' => 'visit_id',
            'sourceVisitIds' => 'source_visit_ids',
            'totalAmount' => 'total_amount',
            'discount' => 'discount',
            'netAmount' => 'net_amount',
            'invoiceDate' => 'invoice_date',
            'status' => 'status',
            'paymentType' => 'payment_type',
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
