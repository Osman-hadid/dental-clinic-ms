<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\SalaryPayment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreSalaryPaymentRequest extends BaseFormRequest
{
    protected array $booleanFields = [
        'paidFromSafe',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'staffId' => 'required|integer|exists:staff,id',
            'salaryMonth' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'paymentDate' => 'required|date_format:Y-m-d',
            'grossAmount' => 'required|numeric|min:0',
            'bonusAmount' => 'nullable|numeric|min:0',
            'deductionAmount' => 'nullable|numeric|min:0',
            'netAmount' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|in:AFN',
            'exchangeRate' => 'nullable|numeric|gt:0',
            'status' => 'required|string|in:pending,paid,partial',
            'paidFromSafe' => 'nullable|boolean',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
