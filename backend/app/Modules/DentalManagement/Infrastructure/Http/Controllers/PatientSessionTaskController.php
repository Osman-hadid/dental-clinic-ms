<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientSessionTask\StorePatientSessionTaskRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientSessionTask\UpdatePatientSessionTaskRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\PatientSessionTaskResource;
use Illuminate\Http\JsonResponse;

final class PatientSessionTaskController extends BaseApiController
{
    public function index(int $patientId): JsonResponse
    {
        $patient = Patient::query()->findOrFail($patientId);
        $this->authorize('view', $patient);

        $tasks = $patient->sessionTasks()
            ->orderByDesc('created_at')
            ->get();

        return $this->successResponse(
            data: $tasks->map(fn ($task): array => (new PatientSessionTaskResource($task))->toArray(request()))->values()->all(),
            message: __('DentalManagement::messages.session_tasks.fetched')
        );
    }

    public function store(StorePatientSessionTaskRequest $request, int $patientId): JsonResponse
    {
        $patient = Patient::query()->findOrFail($patientId);
        $this->authorize('update', $patient);

        $validated = $request->validated();
        $userId = $this->authenticatedUserId();

        $task = $patient->sessionTasks()->create([
            'title' => $validated['title'],
            'mark' => $validated['mark'],
            'status' => $validated['status'],
            'notes' => $validated['notes'] ?? null,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);

        return $this->successResponse(
            data: new PatientSessionTaskResource($task),
            message: __('DentalManagement::messages.session_task.created'),
            code: 201
        );
    }

    public function update(UpdatePatientSessionTaskRequest $request, int $patientId, int $taskId): JsonResponse
    {
        $patient = Patient::query()->findOrFail($patientId);
        $this->authorize('update', $patient);

        $task = $patient->sessionTasks()->findOrFail($taskId);
        $validated = $request->validated();

        $payload = [];
        if (\array_key_exists('title', $validated)) {
            $payload['title'] = $validated['title'];
        }
        if (\array_key_exists('mark', $validated)) {
            $payload['mark'] = $validated['mark'];
        }
        if (\array_key_exists('status', $validated)) {
            $payload['status'] = $validated['status'];
        }
        if (\array_key_exists('notes', $validated)) {
            $payload['notes'] = $validated['notes'];
        }

        if ($payload !== []) {
            $payload['updated_by'] = $this->authenticatedUserId();
            $task->update($payload);
        }

        return $this->successResponse(
            data: new PatientSessionTaskResource($task->fresh()),
            message: __('DentalManagement::messages.session_task.updated')
        );
    }

    public function destroy(int $patientId, int $taskId): JsonResponse
    {
        $patient = Patient::query()->findOrFail($patientId);
        $this->authorize('update', $patient);

        $task = $patient->sessionTasks()->findOrFail($taskId);
        $task->delete();

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.session_task.deleted')
        );
    }

    private function authenticatedUserId(): ?int
    {
        $userId = auth()->id();

        return $userId !== null ? (int) $userId : null;
    }
}
