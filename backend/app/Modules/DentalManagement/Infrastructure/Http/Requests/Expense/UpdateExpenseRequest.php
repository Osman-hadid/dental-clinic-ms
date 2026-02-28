<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Expense;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdateExpenseRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expenseType' => 'required|string|in:daily,clinical',
            'title' => 'required|string|max:120',
            'category' => 'required|string|max:120',
            'amount' => 'required|numeric|gt:0',
            'currency' => 'nullable|string|in:AFN',
            'exchangeRate' => 'nullable|numeric|gt:0',
            'expenseDate' => 'required|date_format:Y-m-d',
            'paymentMethod' => 'nullable|string|max:40',
            'vendor' => 'nullable|string|max:160',
            'quantity' => 'nullable|integer|min:1',
            'unitCost' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:255',
            'sourceId' => 'nullable|integer',
            'sourceType' => 'nullable|string|max:60',
            'staffId' => 'nullable|integer|exists:staff,id',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
