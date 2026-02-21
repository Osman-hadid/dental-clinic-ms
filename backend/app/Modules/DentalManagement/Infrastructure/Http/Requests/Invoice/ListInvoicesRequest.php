<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Invoice;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;

final class ListInvoicesRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'invoice_date',
            'net_amount',
            'status',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'patient',
            'visit',
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
            'patientId' => 'patient_id',
            'visitId' => 'visit_id',
            'totalAmount' => 'total_amount',
            'discount' => 'discount',
            'netAmount' => 'net_amount',
            'invoiceDate' => 'invoice_date',
            'status' => 'status',
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
