<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientQuestion;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StorePatientQuestionRequest extends BaseFormRequest
{
    protected array $booleanFields = ['isRequired', 'isActive'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'questionText' => 'required|string|max:5000',
            'answerType' => 'required|string|in:text,textarea,number,yes_no,date',
            'helpText' => 'nullable|string|max:5000',
            'sortOrder' => 'nullable|integer|min:0|max:999999',
            'isRequired' => 'nullable|boolean',
            'isActive' => 'nullable|boolean',
        ];
    }
}
