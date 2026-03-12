<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\DentalManagement\Domain\Entities\DentalBackup;
use App\Modules\DentalManagement\Domain\Entities\DentalBackupSchedule;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use PDO;
use RuntimeException;
use Symfony\Component\Process\Process;
use Throwable;

final class DentalBackupService
{
    /**
     * @var array<int, string>
     */
    private const TABLES = [
        'patients',
        'staff',
        'appointments',
        'visits',
        'teeth',
        'treatments',
        'visit_treatments',
        'invoices',
        'payments',
        'patient_session_tasks',
        'implant_companies',
        'expenses',
        'safe_transactions',
        'salary_payments',
        'financial_settings',
        'debts',
    ];

    public function getSchedule(): DentalBackupSchedule
    {
        $this->assertBackupTablesExist();

        $schedule = DentalBackupSchedule::query()->first();
        if ($schedule) {
            return $schedule;
        }

        return DentalBackupSchedule::query()->create([
            'frequency' => 'none',
            'run_at_time' => '02:00',
            'is_active' => false,
        ]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function updateSchedule(array $input, ?int $userId): DentalBackupSchedule
    {
        $schedule = $this->getSchedule();
        $frequency = (string) ($input['frequency'] ?? 'none');
        $isActive = $frequency !== 'none' && (bool) ($input['isActive'] ?? true);

        $schedule->fill([
            'frequency' => $frequency,
            'run_at_time' => (string) ($input['runAtTime'] ?? '02:00'),
            'run_day_of_week' => $frequency === 'weekly' ? (int) ($input['runDayOfWeek'] ?? 1) : null,
            'run_day_of_month' => \in_array($frequency, ['monthly', 'yearly'], true)
                ? (int) ($input['runDayOfMonth'] ?? 1)
                : null,
            'run_month' => $frequency === 'yearly' ? (int) ($input['runMonth'] ?? 1) : null,
            'is_active' => $isActive,
            'updated_by' => $userId,
        ]);
        $schedule->save();

        return $schedule->refresh();
    }

    public function latestBackup(): ?DentalBackup
    {
        return DentalBackup::query()->latest('created_at')->first();
    }

    /**
     * @param array<string, mixed> $input
     */
    public function runManualBackup(array $input, ?int $triggeredBy): DentalBackup
    {
        $this->assertBackupTablesExist();

        $mode = (string) ($input['mode'] ?? 'full');
        $startDate = $mode === 'date_range' ? (string) ($input['startDate'] ?? '') : null;
        $endDate = $mode === 'date_range' ? (string) ($input['endDate'] ?? '') : null;

        return $this->runBackup(
            mode: $mode,
            startDate: $startDate,
            endDate: $endDate,
            frequency: null,
            triggeredBy: $triggeredBy,
            notes: 'Manual backup'
        );
    }

    public function runAutomaticBackupIfDue(): ?DentalBackup
    {
        if (!Schema::hasTable('dental_backup_schedules') || !Schema::hasTable('dental_backups')) {
            return null;
        }

        $schedule = $this->getSchedule();
        if (!$schedule->is_active || $schedule->frequency === 'none') {
            return null;
        }

        $now = CarbonImmutable::now();
        if (!$this->isDue($schedule, $now)) {
            return null;
        }

        $backup = $this->runBackup(
            mode: 'full',
            startDate: null,
            endDate: null,
            frequency: (string) $schedule->frequency,
            triggeredBy: null,
            notes: 'Automatic backup'
        );

        $schedule->forceFill(['last_run_at' => $now])->save();

        return $backup;
    }

    /**
     * @return array<string, mixed>
     */
    public function schedulePayload(DentalBackupSchedule $schedule): array
    {
        return [
            'frequency' => (string) $schedule->frequency,
            'runAtTime' => (string) $schedule->run_at_time,
            'runDayOfWeek' => $schedule->run_day_of_week,
            'runDayOfMonth' => $schedule->run_day_of_month,
            'runMonth' => $schedule->run_month,
            'isActive' => (bool) $schedule->is_active,
            'lastRunAt' => $schedule->last_run_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function backupPayload(DentalBackup $backup): array
    {
        return [
            'id' => (int) $backup->id,
            'mode' => (string) $backup->mode,
            'frequency' => $backup->frequency,
            'startDate' => $backup->start_date?->format('Y-m-d'),
            'endDate' => $backup->end_date?->format('Y-m-d'),
            'status' => (string) $backup->status,
            'filePath' => $backup->file_path,
            'fileSizeBytes' => $backup->file_size_bytes,
            'summary' => $backup->summary,
            'notes' => $backup->notes,
            'completedAt' => $backup->completed_at?->toIso8601String(),
            'createdAt' => $backup->created_at?->toIso8601String(),
        ];
    }

    private function isDue(DentalBackupSchedule $schedule, CarbonImmutable $now): bool
    {
        $anchor = $this->anchorFor($schedule, $now);
        if ($anchor === null || $anchor->greaterThan($now)) {
            return false;
        }

        if ($schedule->last_run_at === null) {
            return true;
        }

        return CarbonImmutable::instance($schedule->last_run_at)->lessThan($anchor);
    }

    private function anchorFor(DentalBackupSchedule $schedule, CarbonImmutable $now): ?CarbonImmutable
    {
        $time = $this->normalizeTime((string) $schedule->run_at_time);
        $hour = (int) substr($time, 0, 2);
        $minute = (int) substr($time, 3, 2);

        return match ((string) $schedule->frequency) {
            'daily' => $now->setTime($hour, $minute),
            'weekly' => $now
                ->startOfWeek(CarbonInterface::SUNDAY)
                ->addDays((int) ($schedule->run_day_of_week ?? CarbonInterface::MONDAY))
                ->setTime($hour, $minute),
            'monthly' => $this->monthlyAnchor($schedule, $now, $hour, $minute),
            'yearly' => $this->yearlyAnchor($schedule, $now, $hour, $minute),
            default => null,
        };
    }

    private function monthlyAnchor(
        DentalBackupSchedule $schedule,
        CarbonImmutable $now,
        int $hour,
        int $minute
    ): CarbonImmutable {
        $day = max(1, (int) ($schedule->run_day_of_month ?? 1));
        $resolvedDay = min($day, $now->daysInMonth);

        return $now->day($resolvedDay)->setTime($hour, $minute);
    }

    private function yearlyAnchor(
        DentalBackupSchedule $schedule,
        CarbonImmutable $now,
        int $hour,
        int $minute
    ): CarbonImmutable {
        $month = min(max((int) ($schedule->run_month ?? 1), 1), 12);
        $day = max(1, (int) ($schedule->run_day_of_month ?? 1));
        $candidate = $now->month($month)->day(1);
        $resolvedDay = min($day, $candidate->daysInMonth);

        return $candidate->day($resolvedDay)->setTime($hour, $minute);
    }

    private function normalizeTime(string $value): string
    {
        if (!preg_match('/^\d{2}:\d{2}$/', $value)) {
            return '02:00';
        }

        return $value;
    }

    private function assertBackupTablesExist(): void
    {
        if (!Schema::hasTable('dental_backup_schedules') || !Schema::hasTable('dental_backups')) {
            throw new RuntimeException(
                'Backup tables are not available. Run the dental backup migration first.'
            );
        }
    }

    private function runBackup(
        string $mode,
        ?string $startDate,
        ?string $endDate,
        ?string $frequency,
        ?int $triggeredBy,
        string $notes
    ): DentalBackup {
        $backup = DentalBackup::query()->create([
            'mode' => $mode,
            'frequency' => $frequency,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'status' => 'running',
            'notes' => $notes,
            'triggered_by' => $triggeredBy,
        ]);

        try {
            if ($mode === 'date_range') {
                $backupResult = $this->runDateRangePostgresSqlExport($startDate, $endDate);
            } else {
                try {
                    $backupResult = $this->runPostgresDump();
                } catch (Throwable $pgDumpException) {
                    $backupResult = $this->runFullPostgresSqlExport();
                    $backupResult['summary']['fallback'] = [
                        'from' => 'pg_dump_custom',
                        'reason' => $pgDumpException->getMessage(),
                    ];
                }
            }
            $path = (string) $backupResult['path'];
            $size = Storage::disk('local')->size($path);

            $backup->forceFill([
                'status' => 'completed',
                'file_path' => $path,
                'file_size_bytes' => $size,
                'summary' => $backupResult['summary'] ?? [],
                'completed_at' => now(),
            ])->save();
        } catch (Throwable $exception) {
            $backup->forceFill([
                'status' => 'failed',
                'notes' => $exception->getMessage(),
                'completed_at' => now(),
            ])->save();

            throw $exception;
        }

        return $backup->refresh();
    }

    /**
     * @return array<string, mixed>
     */
    private function runPostgresDump(): array
    {
        $connectionName = (string) config('database.default', 'pgsql');
        $connection = config("database.connections.{$connectionName}");
        if (!\is_array($connection) || ($connection['driver'] ?? null) !== 'pgsql') {
            throw new RuntimeException('Default database connection must be PostgreSQL for pg_dump backup.');
        }

        $host = $this->resolveConnectionValue($connection, 'host', '127.0.0.1');
        $port = $this->resolveConnectionValue($connection, 'port', '5432');
        $database = $this->resolveConnectionValue($connection, 'database', '');
        $username = $this->resolveConnectionValue($connection, 'username', '');
        $password = $this->resolveConnectionValue($connection, 'password', '');
        $sslmode = $this->resolveConnectionValue($connection, 'sslmode', '');
        if ($database === '' || $username === '') {
            throw new RuntimeException('PostgreSQL connection is missing database or username.');
        }

        $fileName = sprintf('dental_backup_%s_full.dump', now()->format('Ymd_His'));
        $relativePath = "dental-backups/{$fileName}";
        Storage::disk('local')->makeDirectory('dental-backups');
        $absolutePath = Storage::disk('local')->path($relativePath);
        $binary = $this->resolvePgDumpBinary();

        $databaseDsn = $this->buildPgDumpDsn(
            host: $host,
            port: $port,
            database: $database,
            username: $username,
            password: $password,
            sslmode: $sslmode
        );

        $command = [
            $binary,
            '--format=custom',
            '--no-owner',
            '--no-privileges',
            "--file={$absolutePath}",
            "--dbname={$databaseDsn}",
        ];
        $process = new Process($command);
        $process->setTimeout(1800);

        $process->run();
        if (!$process->isSuccessful()) {
            if (file_exists($absolutePath) && filesize($absolutePath) === 0) {
                @unlink($absolutePath);
            }
            $stderr = trim($process->getErrorOutput());
            $stdout = trim($process->getOutput());
            $detailParts = array_values(array_filter([
                $stderr !== '' ? "stderr: {$stderr}" : null,
                $stdout !== '' ? "stdout: {$stdout}" : null,
            ]));
            $detail = $detailParts !== [] ? implode("\n", $detailParts) : 'no output';

            throw new RuntimeException(
                sprintf(
                    'pg_dump failed (exit: %s, binary: %s). %s',
                    (string) $process->getExitCode(),
                    $binary,
                    $detail
                )
            );
        }

        if (!file_exists($absolutePath) || filesize($absolutePath) === 0) {
            if (file_exists($absolutePath) && filesize($absolutePath) === 0) {
                @unlink($absolutePath);
            }
            throw new RuntimeException('pg_dump did not produce a valid output file.');
        }

        return [
            'path' => $relativePath,
            'summary' => [
                'engine' => 'postgresql',
                'format' => 'pg_dump_custom',
                'connection' => $connectionName,
                'database' => $database,
                'scope' => 'full',
                'generatedAt' => now()->toIso8601String(),
            ],
        ];
    }

    private function resolvePgDumpBinary(): string
    {
        $configured = (string) env('PG_DUMP_BINARY', '');
        if ($configured !== '' && is_file($configured)) {
            return $configured;
        }
        if ($configured !== '') {
            return $configured;
        }

        $candidates = [];
        if (DIRECTORY_SEPARATOR === '\\') {
            $programFiles = [
                (string) getenv('ProgramFiles'),
                (string) getenv('ProgramFiles(x86)'),
                'C:\\Program Files',
                'C:\\Program Files (x86)',
            ];

            foreach (array_unique($programFiles) as $baseDir) {
                if ($baseDir === '') {
                    continue;
                }
                $globbed = glob($baseDir.'\\PostgreSQL\\*\\bin\\pg_dump.exe');
                if (\is_array($globbed)) {
                    $candidates = [...$candidates, ...$globbed];
                }
            }
        } else {
            $globbed = glob('/usr/bin/pg_dump');
            if (\is_array($globbed)) {
                $candidates = [...$candidates, ...$globbed];
            }
            $globbed = glob('/usr/local/bin/pg_dump');
            if (\is_array($globbed)) {
                $candidates = [...$candidates, ...$globbed];
            }
        }

        $candidates = array_values(array_unique(array_filter($candidates, 'is_string')));
        if ($candidates !== []) {
            usort(
                $candidates,
                static fn (string $left, string $right): int => filemtime($right) <=> filemtime($left)
            );

            foreach ($candidates as $candidate) {
                if (is_file($candidate)) {
                    return $candidate;
                }
            }
        }

        throw new RuntimeException(
            "pg_dump binary not found. Install PostgreSQL tools or set PG_DUMP_BINARY to full path (e.g. C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe)."
        );
    }

    /**
     * @param array<string, mixed> $connection
     */
    private function resolveConnectionValue(array $connection, string $key, string $default): string
    {
        $urlValue = $this->resolveConnectionValueFromUrl($connection['url'] ?? null, $key);
        if ($urlValue !== null && $urlValue !== '') {
            return $urlValue;
        }

        $direct = $connection[$key] ?? $default;

        return (string) $direct;
    }

    /**
     * @param mixed $url
     */
    private function resolveConnectionValueFromUrl(mixed $url, string $key): ?string
    {
        if (!\is_string($url) || trim($url) === '') {
            return null;
        }

        $parts = parse_url($url);
        if (!\is_array($parts)) {
            return null;
        }

        return match ($key) {
            'host' => isset($parts['host']) ? (string) $parts['host'] : null,
            'port' => isset($parts['port']) ? (string) $parts['port'] : null,
            'username' => isset($parts['user']) ? rawurldecode((string) $parts['user']) : null,
            'password' => isset($parts['pass']) ? rawurldecode((string) $parts['pass']) : null,
            'database' => isset($parts['path']) ? ltrim(rawurldecode((string) $parts['path']), '/') : null,
            'sslmode' => isset($parts['query']) ? $this->resolveSslModeFromQuery((string) $parts['query']) : null,
            default => null,
        };
    }

    private function resolveSslModeFromQuery(string $query): ?string
    {
        if (trim($query) === '') {
            return null;
        }

        parse_str($query, $queryParts);
        $sslmode = $queryParts['sslmode'] ?? null;

        return \is_scalar($sslmode) ? (string) $sslmode : null;
    }

    private function buildPgDumpDsn(
        string $host,
        string $port,
        string $database,
        string $username,
        string $password,
        string $sslmode
    ): string
    {
        $authPart = rawurlencode($username);
        if ($password !== '') {
            $authPart .= ':'.rawurlencode($password);
        }

        $dsn = sprintf(
            'postgresql://%s@%s:%s/%s',
            $authPart,
            $host,
            $port,
            rawurlencode($database)
        );

        if ($sslmode !== '') {
            $dsn .= '?'.http_build_query(['sslmode' => $sslmode], '', '&', PHP_QUERY_RFC3986);
        }

        return $dsn;
    }

    /**
     * @return array<string, mixed>
     */
    private function runDateRangePostgresSqlExport(?string $startDate, ?string $endDate): array
    {
        if ($startDate === null || $endDate === null || $startDate === '' || $endDate === '') {
            throw new RuntimeException('Date range backup requires both start and end dates.');
        }

        $connectionName = (string) config('database.default', 'pgsql');
        $connection = DB::connection($connectionName);
        if (($connection->getConfig('driver') ?? null) !== 'pgsql') {
            throw new RuntimeException('Date range SQL export requires a PostgreSQL connection.');
        }

        $start = CarbonImmutable::createFromFormat('Y-m-d', $startDate)->startOfDay();
        $end = CarbonImmutable::createFromFormat('Y-m-d', $endDate)->endOfDay();
        if ($start->greaterThan($end)) {
            throw new RuntimeException('Start date cannot be after end date.');
        }

        Storage::disk('local')->makeDirectory('dental-backups');
        $fileName = sprintf(
            'dental_backup_%s_date_range_%s_%s.sql',
            now()->format('Ymd_His'),
            $startDate,
            $endDate
        );
        $relativePath = "dental-backups/{$fileName}";
        $absolutePath = Storage::disk('local')->path($relativePath);
        $handle = fopen($absolutePath, 'wb');
        if ($handle === false) {
            throw new RuntimeException('Unable to create backup SQL file.');
        }

        $pdo = $connection->getPdo();
        $summary = [];

        try {
            fwrite($handle, "-- PostgreSQL date-range backup\n");
            fwrite($handle, '-- Generated at: '.now()->toIso8601String()."\n");
            fwrite($handle, "-- Range: {$startDate} to {$endDate}\n\n");
            fwrite($handle, "BEGIN;\n\n");

            foreach (self::TABLES as $table) {
                if (!Schema::hasTable($table)) {
                    continue;
                }

                $query = $connection->table($table);
                $isDateFiltered = false;
                if (Schema::hasColumn($table, 'created_at')) {
                    $query->whereBetween('created_at', [$start, $end]);
                    $isDateFiltered = true;
                }

                $rows = $query->orderBy('id')->get()->map(static fn ($row): array => (array) $row)->all();
                $count = count($rows);
                $summary[$table] = [
                    'count' => $count,
                    'dateFiltered' => $isDateFiltered,
                ];

                if ($count === 0) {
                    continue;
                }

                $columns = array_keys($rows[0]);
                $columnList = implode(', ', array_map([$this, 'quoteIdentifier'], $columns));
                fwrite($handle, "-- Table: {$table}\n");

                $valueRows = [];
                foreach ($rows as $row) {
                    $literals = [];
                    foreach ($columns as $column) {
                        $literals[] = $this->toPostgresLiteral($row[$column] ?? null, $pdo);
                    }
                    $valueRows[] = '('.implode(', ', $literals).')';

                    if (count($valueRows) >= 200) {
                        fwrite(
                            $handle,
                            sprintf(
                                "INSERT INTO %s (%s) VALUES\n%s;\n",
                                $this->quoteIdentifier($table),
                                $columnList,
                                implode(",\n", $valueRows)
                            )
                        );
                        $valueRows = [];
                    }
                }

                if ($valueRows !== []) {
                    fwrite(
                        $handle,
                        sprintf(
                            "INSERT INTO %s (%s) VALUES\n%s;\n",
                            $this->quoteIdentifier($table),
                            $columnList,
                            implode(",\n", $valueRows)
                        )
                    );
                }
                fwrite($handle, "\n");
            }

            fwrite($handle, "COMMIT;\n");
        } finally {
            fclose($handle);
        }

        return [
            'path' => $relativePath,
            'summary' => [
                'engine' => 'postgresql',
                'format' => 'sql_inserts',
                'scope' => 'date_range',
                'startDate' => $startDate,
                'endDate' => $endDate,
                'generatedAt' => now()->toIso8601String(),
                'tables' => $summary,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function runFullPostgresSqlExport(): array
    {
        $connectionName = (string) config('database.default', 'pgsql');
        $connection = DB::connection($connectionName);
        if (($connection->getConfig('driver') ?? null) !== 'pgsql') {
            throw new RuntimeException('Full SQL export requires a PostgreSQL connection.');
        }

        Storage::disk('local')->makeDirectory('dental-backups');
        $fileName = sprintf(
            'dental_backup_%s_full.sql',
            now()->format('Ymd_His')
        );
        $relativePath = "dental-backups/{$fileName}";
        $absolutePath = Storage::disk('local')->path($relativePath);
        $handle = fopen($absolutePath, 'wb');
        if ($handle === false) {
            throw new RuntimeException('Unable to create full SQL backup file.');
        }

        $pdo = $connection->getPdo();
        $summary = [];

        try {
            fwrite($handle, "-- PostgreSQL full SQL backup fallback\n");
            fwrite($handle, '-- Generated at: '.now()->toIso8601String()."\n\n");
            fwrite($handle, "BEGIN;\n\n");

            foreach (self::TABLES as $table) {
                if (!Schema::hasTable($table)) {
                    continue;
                }

                $rows = $connection->table($table)
                    ->orderBy('id')
                    ->get()
                    ->map(static fn ($row): array => (array) $row)
                    ->all();
                $count = count($rows);
                $summary[$table] = [
                    'count' => $count,
                    'dateFiltered' => false,
                ];

                if ($count === 0) {
                    continue;
                }

                $columns = array_keys($rows[0]);
                $columnList = implode(', ', array_map([$this, 'quoteIdentifier'], $columns));
                fwrite($handle, "-- Table: {$table}\n");

                $valueRows = [];
                foreach ($rows as $row) {
                    $literals = [];
                    foreach ($columns as $column) {
                        $literals[] = $this->toPostgresLiteral($row[$column] ?? null, $pdo);
                    }
                    $valueRows[] = '('.implode(', ', $literals).')';

                    if (count($valueRows) >= 200) {
                        fwrite(
                            $handle,
                            sprintf(
                                "INSERT INTO %s (%s) VALUES\n%s;\n",
                                $this->quoteIdentifier($table),
                                $columnList,
                                implode(",\n", $valueRows)
                            )
                        );
                        $valueRows = [];
                    }
                }

                if ($valueRows !== []) {
                    fwrite(
                        $handle,
                        sprintf(
                            "INSERT INTO %s (%s) VALUES\n%s;\n",
                            $this->quoteIdentifier($table),
                            $columnList,
                            implode(",\n", $valueRows)
                        )
                    );
                }
                fwrite($handle, "\n");
            }

            fwrite($handle, "COMMIT;\n");
        } finally {
            fclose($handle);
        }

        return [
            'path' => $relativePath,
            'summary' => [
                'engine' => 'postgresql',
                'format' => 'sql_inserts',
                'scope' => 'full',
                'generatedAt' => now()->toIso8601String(),
                'tables' => $summary,
            ],
        ];
    }

    private function quoteIdentifier(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }

    private function toPostgresLiteral(mixed $value, PDO $pdo): string
    {
        if ($value === null) {
            return 'NULL';
        }
        if (\is_bool($value)) {
            return $value ? 'TRUE' : 'FALSE';
        }
        if (\is_int($value) || \is_float($value)) {
            return (string) $value;
        }
        if ($value instanceof DateTimeInterface) {
            $quotedDate = $pdo->quote($value->format('Y-m-d H:i:s.uP'));
            if ($quotedDate === false) {
                throw new RuntimeException('Failed to escape date value for SQL export.');
            }

            return $quotedDate;
        }
        if (\is_array($value) || \is_object($value)) {
            $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($json === false) {
                throw new RuntimeException('Failed to encode complex value for SQL export.');
            }
            $quotedJson = $pdo->quote($json);
            if ($quotedJson === false) {
                throw new RuntimeException('Failed to escape JSON value for SQL export.');
            }

            return $quotedJson;
        }

        $quoted = $pdo->quote((string) $value);
        if ($quoted === false) {
            throw new RuntimeException('Failed to escape string value for SQL export.');
        }

        return $quoted;
    }
}
