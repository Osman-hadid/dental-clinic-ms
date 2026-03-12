<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\PatientSessionTask;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientSessionTask\StorePatientSessionTaskRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientSessionTask\UpdatePatientSessionTaskRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\PatientSessionTaskResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PatientSessionTaskController extends BaseApiController
{
    public function list(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Patient::class);

        $validated = $request->validate([
            'perPage' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
            'sortBy' => 'nullable|in:id,createdAt,updatedAt',
            'sortDirection' => 'nullable|in:asc,desc',
            'filter' => 'nullable|array',
            'filter.patientId' => 'nullable',
            'filter.patientId.*' => 'integer',
            'filter.status' => 'nullable|string|max:50',
            'filter.dateFrom' => 'nullable|date',
            'filter.dateTo' => 'nullable|date',
        ]);

        $filters = $validated['filter'] ?? [];
        $sortBy = match ((string) ($validated['sortBy'] ?? 'createdAt')) {
            'id' => 'id',
            'updatedAt' => 'updated_at',
            default => 'created_at',
        };
        $sortDirection = strtolower((string) ($validated['sortDirection'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        $query = PatientSessionTask::query();

        $patientIds = $filters['patientId'] ?? null;
        if ($patientIds !== null) {
            $resolvedIds = array_values(array_filter(
                array_map(
                    static fn ($value): int => (int) $value,
                    \is_array($patientIds) ? $patientIds : [$patientIds]
                ),
                static fn (int $value): bool => $value > 0
            ));

            if ($resolvedIds !== []) {
                $query->whereIn('patient_id', $resolvedIds);
            }
        }

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '') {
            $query->where('status', $status);
        }

        $dateFrom = trim((string) ($filters['dateFrom'] ?? ''));
        if ($dateFrom !== '') {
            $query->where('created_at', '>=', "{$dateFrom} 00:00:00");
        }

        $dateTo = trim((string) ($filters['dateTo'] ?? ''));
        if ($dateTo !== '') {
            $query->where('created_at', '<=', "{$dateTo} 23:59:59");
        }

        $paginated = $query
            ->orderBy($sortBy, $sortDirection)
            ->paginate(
                (int) ($validated['perPage'] ?? 100),
                ['*'],
                'page',
                (int) ($validated['page'] ?? 1)
            );

        return $this->successResponse(
            data: new PaginatedResource($paginated, PatientSessionTaskResource::class),
            message: __('DentalManagement::messages.session_tasks.fetched')
        );
    }

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
            'implant_company_id' => $validated['implantCompanyId'] ?? null,
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
        if (\array_key_exists('implantCompanyId', $validated)) {
            $payload['implant_company_id'] = $validated['implantCompanyId'];
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
