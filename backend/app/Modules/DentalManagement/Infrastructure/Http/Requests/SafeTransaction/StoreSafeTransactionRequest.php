<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\SafeTransaction;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreSafeTransactionRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'transactionDate' => 'required|date_format:Y-m-d',
            'entryType' => 'required|string|in:income,expense,salary,withdrawal,deposit,adjustment',
            'direction' => 'required|string|in:in,out',
            'amount' => 'required|numeric|gt:0',
            'currency' => 'nullable|string|in:AFN',
            'exchangeRate' => 'nullable|numeric|gt:0',
            'sourceId' => 'nullable|integer',
            'sourceType' => 'nullable|string|max:60',
            'pickedByStaffId' => 'nullable|integer|exists:staff,id',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
