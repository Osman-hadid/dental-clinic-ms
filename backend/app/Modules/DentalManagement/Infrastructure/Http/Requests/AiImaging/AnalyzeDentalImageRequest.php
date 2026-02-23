<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\AiImaging;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class AnalyzeDentalImageRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'image' => 'required|file|mimes:jpg,jpeg,png,webp|max:10240',
            'modality' => 'nullable|string|in:xray,opg,cbct,intraoral_photo,other',
            'patientContext' => 'nullable|string|max:2000',
        ];
    }
}
