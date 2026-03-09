<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports;

final class ShareholderReportRequest extends BaseReportRequest
{
    protected function sortableColumns(): array
    {
        return ['transactionDate', 'createdAt', 'amountInput'];
    }

    protected function extraRules(): array
    {
        return [
            'shareholderId' => 'nullable|integer|min:1',
            'transactionType' => 'nullable|in:all,contribution,distribution',
        ];
    }
}
