<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Invoice;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdateInvoiceRequest extends BaseFormRequest
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
            'totalAmount' => 'required|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'netAmount' => 'required|numeric|min:0',
            'invoiceDate' => 'required|date_format:Y-m-d',
            'status' => 'nullable|string|in:unpaid,partially_paid,paid,cancelled',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
