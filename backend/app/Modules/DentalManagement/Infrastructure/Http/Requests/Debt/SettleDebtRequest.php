<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Debt;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class SettleDebtRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => 'required|numeric|gt:0',
            'paymentDate' => 'required|date_format:Y-m-d',
            'method' => 'required|string|in:cash,card,insurance',
            'notes' => 'nullable|string|max:255',
        ];
    }
}
