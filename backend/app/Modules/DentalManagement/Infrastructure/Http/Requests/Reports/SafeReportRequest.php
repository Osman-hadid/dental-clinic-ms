<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports;

final class SafeReportRequest extends BaseReportRequest
{
    protected function sortableColumns(): array
    {
        return ['transactionDate', 'createdAt', 'amountInput', 'entryType', 'direction'];
    }

    protected function extraRules(): array
    {
        return [
            'direction' => 'nullable|in:in,out',
            'entryType' => 'nullable|string|max:255',
            'staffId' => 'nullable|integer|min:1',
        ];
    }
}
