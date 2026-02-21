<?php

declare(strict_types=1);

namespace App\Modules\Settings\Infrastructure\Http\Requests\Module;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdateModuleRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nameEn' => 'required|string|max:255',
            'namePs' => 'nullable|string|max:255',
            'nameDr' => 'nullable|string|max:255',
            'url' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'sortOrder' => 'nullable|integer',
        ];
    }
}
