<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Entities\DentalBackup;
use App\Modules\DentalManagement\Domain\Services\DentalBackupService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Backup\RunDentalBackupRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Backup\UpdateDentalBackupScheduleRequest;
use Illuminate\Http\JsonResponse;
use Throwable;

final class DentalBackupController extends BaseApiController
{
    public function __construct(private readonly DentalBackupService $backupService) {}

    public function showSchedule(): JsonResponse
    {
        $this->authorize('viewAny', DentalBackup::class);

        try {
            $schedule = $this->backupService->getSchedule();
            $latestBackup = $this->backupService->latestBackup();

            return $this->successResponse(
                data: [
                    'schedule' => $this->backupService->schedulePayload($schedule),
                    'latestBackup' => $latestBackup ? $this->backupService->backupPayload($latestBackup) : null,
                ],
                message: 'Backup settings fetched successfully.'
            );
        } catch (Throwable $exception) {
            return $this->errorResponse(
                code: 'BACKUP_SETTINGS_UNAVAILABLE',
                message: 'Backup settings are unavailable.',
                details: ['error' => [$exception->getMessage()]],
                httpCode: 500
            );
        }
    }

    public function updateSchedule(UpdateDentalBackupScheduleRequest $request): JsonResponse
    {
        $this->authorize('update', DentalBackup::class);

        try {
            $userId = auth()->id();
            $schedule = $this->backupService->updateSchedule(
                input: $request->validated(),
                userId: $userId !== null ? (int) $userId : null
            );

            return $this->successResponse(
                data: ['schedule' => $this->backupService->schedulePayload($schedule)],
                message: 'Backup schedule updated successfully.'
            );
        } catch (Throwable $exception) {
            return $this->errorResponse(
                code: 'BACKUP_SCHEDULE_UPDATE_FAILED',
                message: 'Backup schedule update failed.',
                details: ['error' => [$exception->getMessage()]],
                httpCode: 500
            );
        }
    }

    public function run(RunDentalBackupRequest $request): JsonResponse
    {
        $this->authorize('create', DentalBackup::class);

        try {
            $userId = auth()->id();
            $backup = $this->backupService->runManualBackup(
                input: $request->validated(),
                triggeredBy: $userId !== null ? (int) $userId : null
            );

            return $this->successResponse(
                data: ['backup' => $this->backupService->backupPayload($backup)],
                message: 'Backup completed successfully.'
            );
        } catch (Throwable $exception) {
            return $this->errorResponse(
                code: 'BACKUP_RUN_FAILED',
                message: 'Failed to run backup.',
                details: ['error' => [$exception->getMessage()]],
                httpCode: 500
            );
        }
    }
}
