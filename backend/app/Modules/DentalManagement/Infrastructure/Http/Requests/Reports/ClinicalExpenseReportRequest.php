<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports;

final class ClinicalExpenseReportRequest extends BaseReportRequest
{
    protected function sortableColumns(): array
    {
        return ['expenseDate', 'createdAt', 'amountInput', 'title', 'category'];
    }

    protected function extraRules(): array
    {
        return [
            'category' => 'nullable|string|max:255',
            'staffId' => 'nullable|integer|min:1',
        ];
    }
}
