<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientSessionTask;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StorePatientSessionTaskRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'mark' => 'required|string|in:green,blue,yellow,orange,red,purple',
            'status' => 'required|string|in:pending,in_progress,done',
            'notes' => 'nullable|string|max:2000',
        ];
    }
}
