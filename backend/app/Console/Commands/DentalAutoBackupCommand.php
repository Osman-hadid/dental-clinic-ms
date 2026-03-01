<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Modules\DentalManagement\Domain\Services\DentalBackupService;
use Illuminate\Console\Command;
use Throwable;

final class DentalAutoBackupCommand extends Command
{
    protected $signature = 'dental:backup:auto-run';

    protected $description = 'Run scheduled dental backups when due';

    public function __construct(private readonly DentalBackupService $backupService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        try {
            $backup = $this->backupService->runAutomaticBackupIfDue();
            if ($backup === null) {
                $this->info('No automatic dental backup is due right now.');

                return self::SUCCESS;
            }

            $this->info("Automatic dental backup completed: {$backup->file_path}");

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->error("Automatic dental backup failed: {$exception->getMessage()}");

            return self::FAILURE;
        }
    }
}
