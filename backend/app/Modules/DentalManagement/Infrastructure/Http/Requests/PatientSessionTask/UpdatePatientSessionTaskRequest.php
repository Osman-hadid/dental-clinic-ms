<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientSessionTask;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdatePatientSessionTaskRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (!$this->has('implantCompanyId') && $this->has('implant_company_id')) {
            $this->merge(['implantCompanyId' => $this->input('implant_company_id')]);
        }
    }

    public function rules(): array
    {
        return [
            'title' => 'sometimes|required|string|max:255',
            'mark' => 'sometimes|required|string|in:green,blue,yellow,orange,red,purple',
            'status' => 'sometimes|required|string|in:pending,in_progress,done',
            'notes' => 'nullable|string|max:2000',
            'implantCompanyId' => 'nullable|integer|exists:implant_companies,id',
        ];
    }
}
