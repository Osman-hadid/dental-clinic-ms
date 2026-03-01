<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Backup;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdateDentalBackupScheduleRequest extends BaseFormRequest
{
    protected array $booleanFields = ['isActive'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'frequency' => 'required|string|in:none,daily,weekly,monthly,yearly',
            'runAtTime' => 'required|date_format:H:i',
            'runDayOfWeek' => 'nullable|integer|min:0|max:6|required_if:frequency,weekly',
            'runDayOfMonth' => 'nullable|integer|min:1|max:31|required_if:frequency,monthly,yearly',
            'runMonth' => 'nullable|integer|min:1|max:12|required_if:frequency,yearly',
            'isActive' => 'nullable|boolean',
        ];
    }
}
