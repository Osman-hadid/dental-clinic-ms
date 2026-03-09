<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports;

final class ReportExportRequest extends BaseReportRequest
{
    protected function extraRules(): array
    {
        return [
            'format' => 'nullable|in:csv',
        ];
    }
}
