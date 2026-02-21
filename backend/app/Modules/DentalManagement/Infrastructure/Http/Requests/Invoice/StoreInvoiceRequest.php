<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Invoice;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreInvoiceRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'patientId' => 'required|integer|exists:patients,id',
            'visitId' => 'required|integer|exists:visits,id',
            'totalAmount' => 'required|string|max:255',
            'discount' => 'nullable|string|max:255',
            'netAmount' => 'required|string|max:255',
            'invoiceDate' => 'required|date',
            'status' => 'nullable|nullable|string|in:unpaid,partially_paid,paid,cancelled',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
