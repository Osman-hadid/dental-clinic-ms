<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\FinancialSetting;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdateExchangeRateRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'afnPerUsd' => 'required|numeric|gt:0|max:999999',
        ];
    }
}
