<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Backup;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class RunDentalBackupRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'mode' => 'nullable|string|in:full,date_range',
            'startDate' => 'required_if:mode,date_range|date_format:Y-m-d',
            'endDate' => 'required_if:mode,date_range|date_format:Y-m-d|after_or_equal:startDate',
        ];
    }
}
