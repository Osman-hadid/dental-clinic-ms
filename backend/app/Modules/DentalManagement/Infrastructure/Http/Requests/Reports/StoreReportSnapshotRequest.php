<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports;

use Illuminate\Foundation\Http\FormRequest;

final class StoreReportSnapshotRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reportKey' => 'nullable|string|max:100',
            'reason' => 'nullable|in:manual,scheduled',
            'filters' => 'nullable|array',
            'filters.startDate' => 'nullable|date',
            'filters.endDate' => 'nullable|date',
            'filters.granularity' => 'nullable|in:day,month,year',
            'filters.statusFilter' => 'nullable|in:all,cancelled,completed,pending',
            'filters.dentistFilter' => 'nullable|string|max:255',
            'filters.treatmentFilter' => 'nullable|string|max:255',
            'filters.paymentMethodFilter' => 'nullable|string|max:255',
            'filters.patientFilter' => 'nullable|string|max:255',
        ];
    }

    public function validated($key = null, $default = null): mixed
    {
        $data = parent::validated();
        $validated = array_merge([
            'reportKey' => 'executive',
            'reason' => 'manual',
            'filters' => [],
        ], $data);

        if ($key !== null) {
            return $validated[$key] ?? $default;
        }

        return $validated;
    }
}
