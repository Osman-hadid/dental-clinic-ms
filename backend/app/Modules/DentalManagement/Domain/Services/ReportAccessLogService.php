<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\ReportAccessLog;

final class ReportAccessLogService
{
    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $meta
     */
    public function log(
        ?User $user,
        string $reportKey,
        string $action,
        array $filters = [],
        array $meta = []
    ): ReportAccessLog {
        return ReportAccessLog::query()->create([
            'user_id' => $user?->id,
            'report_key' => $reportKey,
            'action' => $action,
            'filters' => $filters,
            'meta' => $meta,
        ]);
    }
}
