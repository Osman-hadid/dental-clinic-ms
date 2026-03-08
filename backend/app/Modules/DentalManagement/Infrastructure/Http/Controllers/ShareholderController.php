<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Domain\Entities\Shareholder;
use App\Modules\DentalManagement\Domain\Services\CurrencyService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Shareholder\ListShareholdersRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Shareholder\StoreShareholderRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Shareholder\UpdateShareholderRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\ShareholderResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final class ShareholderController extends BaseApiController
{
    public function __construct(private readonly CurrencyService $currencyService) {}

    public function index(ListShareholdersRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Shareholder::class);

        $queryData = $request->validated();
        $filters = $queryData['filters'] ?? [];
        $search = trim((string) ($queryData['search'] ?? ''));

        $query = Shareholder::query()
            ->with($queryData['include'] ?? [])
            ->withSum(['transactions as total_contribution_amount' => function ($builder): void {
                $builder->where('transaction_type', 'contribution');
            }], 'amount')
            ->withSum(['transactions as total_distribution_amount' => function ($builder): void {
                $builder->where('transaction_type', 'distribution');
            }], 'amount');

        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('full_name', 'ilike', "%{$search}%")
                    ->orWhere('contact_number', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('address', 'ilike', "%{$search}%")
                    ->orWhere('notes', 'ilike', "%{$search}%");
            });
        }

        $this->applyTrashedFilter($query, (string) ($filters['trashed'] ?? 'without'));
        $this->applyExactFilter($query, 'status', $filters['status'] ?? null);
        $this->applyExactFilter($query, 'currency', $filters['currency'] ?? null);
        $this->applyDateFilter($query, 'joined_date', $filters['dateFrom'] ?? null, '>=');
        $this->applyDateFilter($query, 'joined_date', $filters['dateTo'] ?? null, '<=');

        $query->orderBy((string) ($queryData['sortBy'] ?? 'created_at'), (string) ($queryData['sortDirection'] ?? 'desc'));

        $paginated = $query->paginate((int) ($queryData['perPage'] ?? 10), ['*'], 'page', (int) ($queryData['page'] ?? 1));

        return $this->successResponse(
            data: new PaginatedResource($paginated, ShareholderResource::class),
            message: __('DentalManagement::messages.shareholders.fetched')
        );
    }

    public function store(StoreShareholderRequest $request): JsonResponse
    {
        $this->authorize('create', Shareholder::class);

        $payload = $this->toDatabasePayload($request->validated());

        $shareholder = DB::transaction(function () use ($payload): Shareholder {
            $created = Shareholder::query()->create($payload);

            return $this->hydrateShareholder((int) $created->id);
        });

        return $this->successResponse(
            data: new ShareholderResource($shareholder),
            message: __('DentalManagement::messages.shareholder.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $shareholder = $this->hydrateShareholder($id, withTransactions: true);
        $this->authorize('view', $shareholder);

        return $this->successResponse(
            data: new ShareholderResource($shareholder),
            message: __('DentalManagement::messages.shareholder.fetched')
        );
    }

    public function update(UpdateShareholderRequest $request, int $id): JsonResponse
    {
        $shareholder = Shareholder::query()->findOrFail($id);
        $this->authorize('update', $shareholder);

        $payload = $this->toDatabasePayload($request->validated());

        $updated = DB::transaction(function () use ($id, $payload): Shareholder {
            $model = Shareholder::query()->findOrFail($id);
            $model->fill($payload);
            $model->save();

            return $this->hydrateShareholder($id);
        });

        return $this->successResponse(
            data: new ShareholderResource($updated),
            message: __('DentalManagement::messages.shareholder.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $shareholder = Shareholder::query()->findOrFail($id);
        $this->authorize('delete', $shareholder);

        $shareholder->delete();

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.shareholder.deleted')
        );
    }

    private function hydrateShareholder(int $id, bool $withTransactions = false): Shareholder
    {
        $query = Shareholder::query()
            ->withSum(['transactions as total_contribution_amount' => function ($builder): void {
                $builder->where('transaction_type', 'contribution');
            }], 'amount')
            ->withSum(['transactions as total_distribution_amount' => function ($builder): void {
                $builder->where('transaction_type', 'distribution');
            }], 'amount');

        if ($withTransactions) {
            $query->with(['transactions' => function ($builder): void {
                $builder->with('safeTransaction')
                    ->orderByDesc('transaction_date')
                    ->orderByDesc('id');
            }]);
        }

        return $query->findOrFail($id);
    }

    private function toDatabasePayload(array $data): array
    {
        $resolvedCurrency = $this->currencyService->normalizeCurrency(
            currency: (string) ($data['currency'] ?? 'AFN'),
            exchangeRate: isset($data['exchangeRate']) ? (float) $data['exchangeRate'] : null,
        );

        $initialCapitalInput = round((float) ($data['initialCapital'] ?? 0), 2);
        $initialCapital = $this->currencyService->toUsd(
            amountInput: $initialCapitalInput,
            currency: $resolvedCurrency['currency'],
            exchangeRate: (float) $resolvedCurrency['exchangeRate'],
        );

        return [
            'full_name' => trim((string) ($data['fullName'] ?? '')),
            'contact_number' => trim((string) ($data['contactNumber'] ?? '')) ?: null,
            'email' => trim((string) ($data['email'] ?? '')) ?: null,
            'address' => trim((string) ($data['address'] ?? '')) ?: null,
            'ownership_percentage' => round((float) ($data['ownershipPercentage'] ?? 0), 2),
            'initial_capital' => $initialCapital,
            'initial_capital_input' => $initialCapitalInput,
            'currency' => $resolvedCurrency['currency'],
            'exchange_rate' => $resolvedCurrency['exchangeRate'],
            'joined_date' => (string) ($data['joinedDate'] ?? '') !== '' ? (string) $data['joinedDate'] : null,
            'status' => (string) ($data['status'] ?? 'active'),
            'notes' => trim((string) ($data['notes'] ?? '')) ?: null,
            'created_by' => $data['createdBy'] ?? null,
            'updated_by' => $data['updatedBy'] ?? null,
            'deleted_by' => $data['deletedBy'] ?? null,
        ];
    }

    private function applyTrashedFilter($query, string $trashedFilter): void
    {
        if ($trashedFilter === 'with') {
            $query->withTrashed();
            return;
        }

        if ($trashedFilter === 'only') {
            $query->onlyTrashed();
        }
    }

    private function applyExactFilter($query, string $column, mixed $value): void
    {
        $resolved = $this->resolveFilterValue($value);
        if ($resolved === null || $resolved === '') {
            return;
        }

        $query->where($column, $resolved);
    }

    private function applyDateFilter($query, string $column, mixed $value, string $operator): void
    {
        $resolved = $this->resolveFilterValue($value);
        if ($resolved === null || $resolved === '') {
            return;
        }

        $query->where($column, $operator, (string) $resolved);
    }

    private function resolveFilterValue(mixed $value): mixed
    {
        if (\is_array($value)) {
            return $value[0] ?? null;
        }

        return $value;
    }
}
