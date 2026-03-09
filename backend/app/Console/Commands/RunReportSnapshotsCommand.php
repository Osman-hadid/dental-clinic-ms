<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Modules\DentalManagement\Domain\Services\ReportSnapshotService;
use Illuminate\Console\Command;

final class RunReportSnapshotsCommand extends Command
{
    protected $signature = 'reports:snapshots:run';

    protected $description = 'Capture scheduled report snapshots that are due';

    public function __construct(private readonly ReportSnapshotService $reportSnapshotService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $count = $this->reportSnapshotService->runDueSchedules();
        $this->info("Captured {$count} scheduled report snapshot(s).");

        return self::SUCCESS;
    }
}
