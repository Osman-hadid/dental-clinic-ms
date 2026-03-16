<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Reports;

final class MetricReportRequest extends BaseReportRequest
{
    protected function extraRules(): array
    {
        return [
            'summaryOnly' => 'nullable|boolean',
        ];
    }
}
