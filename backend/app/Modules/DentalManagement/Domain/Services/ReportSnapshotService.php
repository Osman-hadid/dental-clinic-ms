<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\ReportSnapshot;
use App\Modules\DentalManagement\Domain\Entities\ReportSnapshotSchedule;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

final class ReportSnapshotService
{
    public function __construct(
        private readonly ReportAccessLogService $reportAccessLogService,
        private readonly ReportReadService $reportReadService,
    ) {}

    /**
     * @param array<string, mixed> $filters
     */
    public function capture(User $user, array $filters, string $reportKey = 'executive', string $reason = 'manual'): ReportSnapshot
    {
        $payload = $this->buildSnapshotPayload($reportKey, $filters);

        $snapshot = ReportSnapshot::query()->create([
            'user_id' => $user->id,
            'report_key' => $reportKey,
            'reason' => $reason,
            'filters' => $filters,
            'payload' => $payload,
            'captured_at' => now(),
        ]);

        $this->reportAccessLogService->log(
            user: $user,
            reportKey: $reportKey,
            action: 'snapshot',
            filters: $filters,
            meta: ['reason' => $reason, 'snapshotId' => $snapshot->id],
        );

        return $snapshot;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function list(User $user, string $reportKey = 'executive', int $limit = 60): array
    {
        return ReportSnapshot::query()
            ->where('user_id', $user->id)
            ->where('report_key', $reportKey)
            ->orderByDesc('captured_at')
            ->limit($limit)
            ->get()
            ->map(fn (ReportSnapshot $snapshot): array => $this->snapshotPayload($snapshot))
            ->all();
    }

    public function schedule(User $user, string $reportKey = 'executive'): ReportSnapshotSchedule
    {
        return ReportSnapshotSchedule::query()->firstOrCreate(
            ['user_id' => $user->id, 'report_key' => $reportKey],
            ['cadence' => 'off', 'filters' => []]
        );
    }

    /**
     * @param array<string, mixed> $data
     */
    public function updateSchedule(User $user, array $data): ReportSnapshotSchedule
    {
        $schedule = $this->schedule($user, (string) ($data['reportKey'] ?? 'executive'));
        $schedule->fill([
            'cadence' => (string) ($data['cadence'] ?? 'off'),
            'filters' => $data['filters'] ?? [],
        ]);
        $schedule->save();

        $this->reportAccessLogService->log(
            user: $user,
            reportKey: (string) $schedule->report_key,
            action: 'schedule_update',
            filters: (array) ($schedule->filters ?? []),
            meta: ['cadence' => $schedule->cadence],
        );

        return $schedule->refresh();
    }

    public function runDueSchedules(): int
    {
        $now = CarbonImmutable::now();
        $count = 0;

        ReportSnapshotSchedule::query()
            ->with('user')
            ->where('cadence', '!=', 'off')
            ->chunkById(100, function (Collection $schedules) use (&$count, $now): void {
                /** @var ReportSnapshotSchedule $schedule */
                foreach ($schedules as $schedule) {
                    if (!$schedule->user || !$this->isDue($schedule, $now)) {
                        continue;
                    }

                    $this->capture(
                        user: $schedule->user,
                        filters: (array) ($schedule->filters ?? []),
                        reportKey: (string) $schedule->report_key,
                        reason: 'scheduled',
                    );

                    $schedule->forceFill(['last_run_at' => $now])->save();
                    $count++;
                }
            });

        return $count;
    }

    public function schedulePayload(ReportSnapshotSchedule $schedule): array
    {
        return [
            'reportKey' => (string) $schedule->report_key,
            'cadence' => (string) $schedule->cadence,
            'filters' => (array) ($schedule->filters ?? []),
            'lastRunAt' => $schedule->last_run_at?->toIso8601String(),
        ];
    }

    public function snapshotPayload(ReportSnapshot $snapshot): array
    {
        return [
            'id' => (int) $snapshot->id,
            'reportKey' => (string) $snapshot->report_key,
            'reason' => (string) $snapshot->reason,
            'filters' => (array) ($snapshot->filters ?? []),
            'payload' => (array) ($snapshot->payload ?? []),
            'capturedAt' => $snapshot->captured_at?->toIso8601String(),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    private function buildSnapshotPayload(string $reportKey, array $filters): array
    {
        if ($reportKey !== 'executive') {
            return [];
        }

        $executive = $this->reportReadService->executive($filters);

        return [
            'bankBalance' => $executive['bankBalance'] ?? 0,
            'cashInSafe' => $executive['cashInSafe'] ?? 0,
            'kpis' => $executive['kpis'] ?? [],
            'profitLoss' => $executive['profitLoss'] ?? 0,
            'treatmentAcceptanceRate' => $executive['treatmentAcceptanceRate'] ?? 0,
        ];
    }

    private function isDue(ReportSnapshotSchedule $schedule, CarbonImmutable $now): bool
    {
        if ($schedule->last_run_at === null) {
            return true;
        }

        $lastRun = CarbonImmutable::instance($schedule->last_run_at);

        return match ((string) $schedule->cadence) {
            'daily' => $lastRun->lt($now->startOfDay()),
            'weekly' => $lastRun->lt($now->startOfWeek()),
            'monthly' => $lastRun->lt($now->startOfMonth()),
            default => false,
        };
    }
}
