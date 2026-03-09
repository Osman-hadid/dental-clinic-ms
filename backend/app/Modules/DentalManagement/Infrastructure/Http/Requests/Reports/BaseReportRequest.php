<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

abstract class BaseReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<int, string>
     */
    protected function sortableColumns(): array
    {
        return [];
    }

    /**
     * @return array<string, mixed>
     */
    protected function extraRules(): array
    {
        return [];
    }

    protected function defaultStartDate(): string
    {
        return now()->subDays(90)->format('Y-m-d');
    }

    protected function defaultEndDate(): string
    {
        return now()->format('Y-m-d');
    }

    public function rules(): array
    {
        $sortables = $this->sortableColumns();

        $rules = [
            'startDate' => 'nullable|date',
            'endDate' => 'nullable|date',
            'granularity' => 'nullable|in:day,month,year',
            'statusFilter' => 'nullable|in:all,cancelled,completed,pending',
            'dentistFilter' => 'nullable|string|max:255',
            'treatmentFilter' => 'nullable|string|max:255',
            'paymentMethodFilter' => 'nullable|string|max:255',
            'patientFilter' => 'nullable|string|max:255',
            'page' => 'nullable|integer|min:1',
            'perPage' => 'nullable|integer|min:1|max:100',
            'sortDirection' => 'nullable|in:asc,desc',
            'search' => 'nullable|string|max:255',
        ];

        $rules['sortBy'] = $sortables !== []
            ? ['nullable', 'string', Rule::in($sortables)]
            : 'nullable|string|max:100';

        return array_merge($rules, $this->extraRules());
    }

    public function validated($key = null, $default = null): mixed
    {
        $data = parent::validated();

        $validated = array_merge([
            'startDate' => $this->defaultStartDate(),
            'endDate' => $this->defaultEndDate(),
            'granularity' => 'day',
            'statusFilter' => 'all',
            'dentistFilter' => 'all',
            'treatmentFilter' => 'all',
            'paymentMethodFilter' => 'all',
            'patientFilter' => 'all',
            'page' => 1,
            'perPage' => 10,
            'sortBy' => $this->sortableColumns()[0] ?? 'createdAt',
            'sortDirection' => 'desc',
            'search' => '',
        ], $data);

        $validated['page'] = (int) ($validated['page'] ?? 1);
        $validated['perPage'] = (int) ($validated['perPage'] ?? 10);
        $validated['search'] = trim((string) ($validated['search'] ?? ''));

        if ($key !== null) {
            return $validated[$key] ?? $default;
        }

        return $validated;
    }
}
