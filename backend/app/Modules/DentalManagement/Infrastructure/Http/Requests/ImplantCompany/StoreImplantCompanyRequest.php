<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\ImplantCompany;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreImplantCompanyRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('companyName')) {
            $this->merge(['companyName' => trim((string) $this->input('companyName'))]);
        }
        if ($this->has('implantType')) {
            $this->merge(['implantType' => trim((string) $this->input('implantType'))]);
        }
        if ($this->has('note')) {
            $this->merge(['note' => trim((string) $this->input('note'))]);
        }
    }

    public function rules(): array
    {
        return [
            'companyName' => 'required|string|max:160',
            'implantType' => 'required|string|max:160',
            'recordDate' => 'nullable|date',
            'note' => 'nullable|string|max:500',
        ];
    }
}
