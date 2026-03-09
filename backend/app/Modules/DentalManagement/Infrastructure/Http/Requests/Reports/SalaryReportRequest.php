<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports;

final class SalaryReportRequest extends BaseReportRequest
{
    protected function sortableColumns(): array
    {
        return ['salaryMonth', 'paymentDate', 'netAmountInput', 'status', 'createdAt'];
    }

    protected function extraRules(): array
    {
        return [
            'staffId' => 'nullable|integer|min:1',
        ];
    }
}
