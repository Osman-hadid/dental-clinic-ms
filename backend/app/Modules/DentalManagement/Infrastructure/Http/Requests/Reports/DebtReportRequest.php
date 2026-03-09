<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports;

final class DebtReportRequest extends BaseReportRequest
{
    protected function sortableColumns(): array
    {
        return ['invoiceDate', 'debtAmount', 'netAmount', 'paidAmount', 'createdAt'];
    }

    protected function extraRules(): array
    {
        return [
            'invoiceId' => 'nullable|string|max:255',
            'debtAgingBucket' => 'nullable|in:all,0-30 days,31-60 days,61-90 days,90+ days',
        ];
    }
}
