<?php

declare(strict_types=1);

namespace App\Modules\Common\Infrastructure\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

abstract class BulkDeleteRequest extends FormRequest
{
    abstract protected function tableName(): string;

    abstract protected function entityName(): string;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'ids' => 'required|array|min:1|max:100',
            'ids.*' => [
                'required',
                'integer',
                Rule::exists($this->tableName(), 'id')->whereNull('deleted_at'),
            ],
        ];
    }

    public function validatedIds(): array
    {
        return $this->validated('ids');
    }

    public function messages(): array
    {
        return [
            'ids.max' => __('validation.bulk_delete_max', ['entity' => $this->entityName()]),
            'ids.min' => __('validation.bulk_delete_min', ['entity' => $this->entityName()]),
        ];
    }
}
