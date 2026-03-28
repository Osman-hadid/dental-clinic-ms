<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\DentalManagement\Domain\Entities\DentalBackup;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Throwable;

final class OperationsHealthService
{
    private const WARNING_DISK_FREE_PERCENT = 15.0;
    private const CRITICAL_DISK_FREE_PERCENT = 5.0;
    private const WARNING_DISK_FREE_BYTES = 10737418240; // 10 GB
    private const CRITICAL_DISK_FREE_BYTES = 2147483648; // 2 GB

    public function __construct(private readonly DentalBackupService $backupService) {}

    /**
     * @return array<string, mixed>
     */
    public function buildSnapshot(int $recentLimit = 8): array
    {
        $recentLimit = max(1, $recentLimit);
        $backupTablesReady = Schema::hasTable('dental_backup_schedules') && Schema::hasTable('dental_backups');
        $schedule = $backupTablesReady ? $this->backupService->getSchedule() : null;
        $latestBackup = $backupTablesReady ? $this->backupService->latestBackup() : null;
        $lastSuccessfulBackup = $backupTablesReady ? $this->backupService->lastSuccessfulBackup() : null;
        $recentBackups = $backupTablesReady ? $this->backupService->recentBackups($recentLimit) : collect();
        $latestFailedBackup = $backupTablesReady
            ? DentalBackup::query()->where('status', 'failed')->latest('created_at')->first()
            : null;
        $failedBackupCount = $backupTablesReady
            ? DentalBackup::query()
                ->where('status', 'failed')
                ->where('created_at', '>=', now()->subDays(7))
                ->count()
            : 0;

        $localDiskRoot = Storage::disk('local')->path('');
        $backupDirectoryPath = Storage::disk('local')->path('dental-backups');
        $diskFreeBytes = $this->spaceFor(storage_path(), 'free');
        $diskTotalBytes = $this->spaceFor(storage_path(), 'total');
        $diskFreePercent = $diskTotalBytes > 0
            ? round(($diskFreeBytes / $diskTotalBytes) * 100, 1)
            : 0.0;
        $backupStorageBytes = $this->directorySize($backupDirectoryPath);
        $storageWritable = is_dir(storage_path()) && is_writable(storage_path()) && is_writable($localDiskRoot);
        $databaseReachable = $this->canReachDatabase();
        $storageLinkExists = file_exists(public_path('storage'));
        $backupDirectoryExists = is_dir($backupDirectoryPath);
        $nextScheduledRunAt = $schedule !== null
            ? $this->backupService->nextScheduledRunAt($schedule)?->toIso8601String()
            : null;
        $lowDiskWarning = $diskTotalBytes > 0 && (
            $diskFreePercent <= self::WARNING_DISK_FREE_PERCENT
            || $diskFreeBytes <= self::WARNING_DISK_FREE_BYTES
        );
        $criticalDiskWarning = $diskTotalBytes > 0 && (
            $diskFreePercent <= self::CRITICAL_DISK_FREE_PERCENT
            || $diskFreeBytes <= self::CRITICAL_DISK_FREE_BYTES
        );

        $checks = [
            [
                'action' => $backupTablesReady ? 'Ready for scheduled and manual backups.' : 'Run database migrations for backup tables.',
                'details' => $backupTablesReady
                    ? 'Backup schedule and backup history tables are available.'
                    : 'Backup tables are missing from the database.',
                'label' => 'Backup tables',
                'status' => $backupTablesReady ? 'ok' : 'critical',
                'value' => $backupTablesReady ? 'Ready' : 'Missing',
            ],
            [
                'action' => $lastSuccessfulBackup !== null
                    ? 'Latest successful backup is available for restore readiness checks.'
                    : 'Run a manual backup to establish a restore point.',
                'details' => $lastSuccessfulBackup !== null
                    ? 'Completed at '.($lastSuccessfulBackup->completed_at?->toIso8601String() ?? '-')
                    : 'No completed backups were found.',
                'label' => 'Last successful backup',
                'status' => $lastSuccessfulBackup !== null ? 'ok' : 'critical',
                'value' => $lastSuccessfulBackup?->completed_at?->toIso8601String() ?? 'Never',
            ],
            [
                'action' => $failedBackupCount > 0
                    ? 'Review the backup history and resolve the latest backup failure.'
                    : 'No recent backup failures need action.',
                'details' => $latestFailedBackup?->notes ?: 'No failed backups in the last 7 days.',
                'label' => 'Recent backup failures',
                'status' => $failedBackupCount > 0 ? 'warning' : 'ok',
                'value' => (string) $failedBackupCount,
            ],
            [
                'action' => $criticalDiskWarning || $lowDiskWarning
                    ? 'Free storage space before the next backup run.'
                    : 'Storage capacity looks healthy.',
                'details' => sprintf(
                    'Free %s of %s on storage volume.',
                    $this->formatBytes($diskFreeBytes),
                    $this->formatBytes($diskTotalBytes)
                ),
                'label' => 'Disk capacity',
                'status' => $criticalDiskWarning ? 'critical' : ($lowDiskWarning ? 'warning' : 'ok'),
                'value' => $diskTotalBytes > 0 ? "{$diskFreePercent}% free" : 'Unknown',
            ],
            [
                'action' => $storageWritable
                    ? 'Backup files can be written to local storage.'
                    : 'Check storage folder permissions for Laravel.',
                'details' => $localDiskRoot,
                'label' => 'Backup storage writable',
                'status' => $storageWritable ? 'ok' : 'critical',
                'value' => $storageWritable ? 'Writable' : 'Read only',
            ],
            [
                'action' => $backupDirectoryExists
                    ? 'Backup directory exists and can be monitored.'
                    : 'Run a backup once to create the backup directory.',
                'details' => $backupDirectoryPath,
                'label' => 'Backup directory',
                'status' => $backupDirectoryExists ? 'ok' : 'warning',
                'value' => $backupDirectoryExists ? 'Present' : 'Not created',
            ],
            [
                'action' => $storageLinkExists
                    ? 'Public storage link is available.'
                    : 'Run php artisan storage:link if public files need to be served.',
                'details' => public_path('storage'),
                'label' => 'Public storage link',
                'status' => $storageLinkExists ? 'ok' : 'warning',
                'value' => $storageLinkExists ? 'Linked' : 'Missing',
            ],
            [
                'action' => $databaseReachable
                    ? 'Database connection is healthy.'
                    : 'Check database connection settings and server availability.',
                'details' => $databaseReachable ? 'Database responded successfully.' : 'Database connection failed.',
                'label' => 'Database connection',
                'status' => $databaseReachable ? 'ok' : 'critical',
                'value' => $databaseReachable ? 'Connected' : 'Unavailable',
            ],
        ];

        $overallStatus = $this->overallStatus(array_map(
            static fn (array $row): string => (string) ($row['status'] ?? 'ok'),
            $checks
        ));
        $healthWarningCount = count(array_filter(
            $checks,
            static fn (array $row): bool => in_array((string) ($row['status'] ?? 'ok'), ['warning', 'critical'], true)
        ));

        return [
            'summary' => [
                'backupStorageBytes' => $backupStorageBytes,
                'criticalDiskWarning' => $criticalDiskWarning,
                'diskFreeBytes' => $diskFreeBytes,
                'diskFreePercent' => $diskFreePercent,
                'diskTotalBytes' => $diskTotalBytes,
                'failedBackupCount' => (int) $failedBackupCount,
                'healthWarningCount' => $healthWarningCount,
                'lastSuccessfulBackupAt' => $lastSuccessfulBackup?->completed_at?->toIso8601String(),
                'lastSuccessfulBackupId' => $lastSuccessfulBackup?->id !== null ? (int) $lastSuccessfulBackup->id : null,
                'latestBackupStatus' => $latestBackup?->status ? (string) $latestBackup->status : 'not_available',
                'latestFailureAt' => $latestFailedBackup?->completed_at?->toIso8601String(),
                'latestFailureMessage' => $latestFailedBackup?->notes,
                'lowDiskWarning' => $lowDiskWarning,
                'nextScheduledRunAt' => $nextScheduledRunAt,
                'status' => $overallStatus,
            ],
            'checks' => $checks,
            'recentBackups' => $recentBackups
                ->map(fn (DentalBackup $backup): array => $this->backupService->backupPayload($backup))
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function dashboardSummary(): array
    {
        $snapshot = $this->buildSnapshot(4);
        $summary = (array) ($snapshot['summary'] ?? []);

        return [
            'criticalDiskWarning' => (bool) ($summary['criticalDiskWarning'] ?? false),
            'diskFreePercent' => (float) ($summary['diskFreePercent'] ?? 0),
            'failedBackupCount' => (int) ($summary['failedBackupCount'] ?? 0),
            'healthWarningCount' => (int) ($summary['healthWarningCount'] ?? 0),
            'lastSuccessfulBackupAt' => $summary['lastSuccessfulBackupAt'] ?? null,
            'latestBackupStatus' => (string) ($summary['latestBackupStatus'] ?? 'not_available'),
            'lowDiskWarning' => (bool) ($summary['lowDiskWarning'] ?? false),
            'nextScheduledRunAt' => $summary['nextScheduledRunAt'] ?? null,
            'status' => (string) ($summary['status'] ?? 'warning'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function restoreReadinessPayload(DentalBackup $backup): array
    {
        $path = (string) ($backup->file_path ?? '');
        $fileExists = $path !== '' && Storage::disk('local')->exists($path);
        $fileSizeBytes = $fileExists ? (int) Storage::disk('local')->size($path) : 0;
        $summary = is_array($backup->summary) ? $backup->summary : [];
        $tableSummary = is_array($summary['tables'] ?? null) ? $summary['tables'] : [];
        $rowCountEstimate = array_sum(array_map(
            static fn (mixed $row): int => is_array($row) ? (int) ($row['count'] ?? 0) : 0,
            $tableSummary
        ));
        $format = is_string($summary['format'] ?? null) ? (string) $summary['format'] : null;

        $checks = [
            [
                'details' => 'Only completed backups should be considered for restore validation.',
                'label' => 'Backup completed',
                'status' => $backup->status === 'completed' ? 'ok' : 'critical',
                'value' => (string) $backup->status,
            ],
            [
                'details' => $path !== '' ? $path : 'No file path was recorded for this backup.',
                'label' => 'Backup file exists',
                'status' => $fileExists ? 'ok' : 'critical',
                'value' => $fileExists ? 'Present' : 'Missing',
            ],
            [
                'details' => $fileExists ? 'Backup file is readable and non-empty.' : 'Cannot check file size until the file exists.',
                'label' => 'Backup file size',
                'status' => $fileExists && $fileSizeBytes > 0 ? 'ok' : 'critical',
                'value' => $this->formatBytes($fileSizeBytes),
            ],
            [
                'details' => $format !== null
                    ? "Backup format: {$format}"
                    : 'No backup format metadata was recorded for this backup.',
                'label' => 'Backup metadata',
                'status' => $format !== null ? 'ok' : 'warning',
                'value' => $format ?? 'Unknown',
            ],
            [
                'details' => count($tableSummary) > 0
                    ? 'Row-count summary is available for restore planning.'
                    : 'Table row counts are not available for this backup format.',
                'label' => 'Restore summary',
                'status' => count($tableSummary) > 0 || $format === 'pg_dump_custom' ? 'ok' : 'warning',
                'value' => count($tableSummary) > 0 ? count($tableSummary).' tables' : 'Limited',
            ],
        ];

        $status = $this->overallStatus(array_map(
            static fn (array $row): string => (string) ($row['status'] ?? 'ok'),
            $checks
        ));

        return [
            'backupFormat' => $format,
            'checkedAt' => now()->toIso8601String(),
            'checks' => $checks,
            'fileExists' => $fileExists,
            'fileSizeBytes' => $fileSizeBytes,
            'restorable' => $status !== 'critical',
            'rowCountEstimate' => $rowCountEstimate,
            'status' => $status,
            'tableCount' => count($tableSummary),
        ];
    }

    private function canReachDatabase(): bool
    {
        try {
            DB::connection()->getPdo();

            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private function spaceFor(string $path, string $mode): int
    {
        $value = $mode === 'total' ? @disk_total_space($path) : @disk_free_space($path);

        return is_numeric($value) ? max(0, (int) $value) : 0;
    }

    private function directorySize(string $path): int
    {
        if (!is_dir($path)) {
            return 0;
        }

        $size = 0;
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $fileInfo) {
            if ($fileInfo->isFile()) {
                $size += (int) $fileInfo->getSize();
            }
        }

        return $size;
    }

    /**
     * @param array<int, string> $statuses
     */
    private function overallStatus(array $statuses): string
    {
        if (in_array('critical', $statuses, true)) {
            return 'critical';
        }

        if (in_array('warning', $statuses, true)) {
            return 'warning';
        }

        return 'ok';
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes <= 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $power = min((int) floor(log($bytes, 1024)), count($units) - 1);
        $value = $bytes / (1024 ** $power);

        return number_format($value, $power === 0 ? 0 : 1).' '.$units[$power];
    }
}
