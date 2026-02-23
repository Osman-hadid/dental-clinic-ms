<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Payment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdatePaymentRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'invoiceId' => 'required|integer|exists:invoices,id',
            'paymentDate' => 'required|date_format:Y-m-d',
            'amount' => 'required|numeric|gt:0',
            'method' => 'required|string|in:cash,card,insurance',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
