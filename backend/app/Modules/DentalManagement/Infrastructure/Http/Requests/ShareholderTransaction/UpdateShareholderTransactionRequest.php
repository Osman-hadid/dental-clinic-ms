<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\ShareholderTransaction;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdateShareholderTransactionRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'shareholderId' => 'required|integer|exists:shareholders,id',
            'transactionDate' => 'required|date_format:Y-m-d',
            'transactionType' => 'required|string|in:contribution,distribution',
            'amount' => 'required|numeric|gt:0',
            'currency' => 'nullable|string|in:AFN',
            'exchangeRate' => 'nullable|numeric|gt:0',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
