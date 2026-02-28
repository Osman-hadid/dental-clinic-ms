<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Services\CurrencyService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\SafeTransaction\ListSafeTransactionsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\SafeTransaction\StoreSafeTransactionRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\SafeTransaction\UpdateSafeTransactionRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\SafeTransactionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final class SafeTransactionController extends BaseApiController
{
    public function __construct(private readonly CurrencyService $currencyService) {}

    public function index(ListSafeTransactionsRequest $request): JsonResponse
    {
        $queryData = $request->validated();
        $filters = $queryData['filters'] ?? [];

        $query = SafeTransaction::query()->with($queryData['include'] ?? []);

        if (($queryData['search'] ?? null) !== null) {
            $search = trim((string) $queryData['search']);
            if ($search !== '') {
                $query->where(function ($builder) use ($search): void {
                    $builder->where('notes', 'ilike', "%{$search}%")
                        ->orWhere('source_type', 'ilike', "%{$search}%")
                        ->orWhere('entry_type', 'ilike', "%{$search}%");
                });
            }
        }

        $this->applyTrashedFilter($query, (string) ($filters['trashed'] ?? 'without'));
        $this->applyExactFilter($query, 'direction', $filters['direction'] ?? null);
        $this->applyExactFilter($query, 'entry_type', $filters['entryType'] ?? null);
        $this->applyExactFilter($query, 'picked_by_staff_id', $filters['pickedByStaffId'] ?? null);
        $this->applyExactFilter($query, 'currency', $filters['currency'] ?? null);
        $this->applyDateFilter($query, 'transaction_date', $filters['dateFrom'] ?? null, '>=');
        $this->applyDateFilter($query, 'transaction_date', $filters['dateTo'] ?? null, '<=');

        $query->orderBy((string) ($queryData['sortBy'] ?? 'created_at'), (string) ($queryData['sortDirection'] ?? 'desc'));

        $paginated = $query->paginate((int) ($queryData['perPage'] ?? 10), ['*'], 'page', (int) ($queryData['page'] ?? 1));

        return $this->successResponse(
            data: new PaginatedResource($paginated, SafeTransactionResource::class),
            message: 'Safe transactions fetched successfully.'
        );
    }

    public function store(StoreSafeTransactionRequest $request): JsonResponse
    {
        $payload = $this->toDatabasePayload($request->validated());

        $entry = DB::transaction(function () use ($payload): SafeTransaction {
            $this->assertBalanceAllowsOutTransaction(
                direction: (string) $payload['direction'],
                amount: (float) $payload['amount']
            );

            $entry = SafeTransaction::query()->create($payload);

            return $entry->load('pickedByStaff');
        });

        return $this->successResponse(
            data: new SafeTransactionResource($entry),
            message: 'Safe transaction created successfully.',
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $entry = SafeTransaction::query()->with('pickedByStaff')->findOrFail($id);

        return $this->successResponse(
            data: new SafeTransactionResource($entry),
            message: 'Safe transaction fetched successfully.'
        );
    }

    public function update(UpdateSafeTransactionRequest $request, int $id): JsonResponse
    {
        $payload = $this->toDatabasePayload($request->validated());

        $entry = DB::transaction(function () use ($id, $payload): SafeTransaction {
            $entry = SafeTransaction::query()->findOrFail($id);

            if ($entry->source_type !== null) {
                throw new ApiException(
                    errorCode: 'SAFE_TRANSACTION_READ_ONLY',
                    message: 'System generated safe entries cannot be edited manually.',
                    httpCode: 422,
                );
            }

            $this->assertBalanceAllowsOutTransaction(
                direction: (string) $payload['direction'],
                amount: (float) $payload['amount'],
                excludingId: $entry->id
            );

            $entry->fill($payload);
            $entry->save();

            return $entry->load('pickedByStaff');
        });

        return $this->successResponse(
            data: new SafeTransactionResource($entry),
            message: 'Safe transaction updated successfully.'
        );
    }

    public function destroy(int $id): JsonResponse
    {
        DB::transaction(function () use ($id): void {
            $entry = SafeTransaction::query()->findOrFail($id);
            if ($entry->source_type !== null) {
                throw new ApiException(
                    errorCode: 'SAFE_TRANSACTION_READ_ONLY',
                    message: 'System generated safe entries cannot be deleted manually.',
                    httpCode: 422,
                );
            }
            $entry->delete();
        });

        return $this->successResponse(
            data: null,
            message: 'Safe transaction deleted successfully.'
        );
    }

    public function balance(): JsonResponse
    {
        $sumIn = (float) SafeTransaction::query()->where('direction', 'in')->sum('amount');
        $sumOut = (float) SafeTransaction::query()->where('direction', 'out')->sum('amount');
        $balance = round($sumIn - $sumOut, 2);

        return $this->successResponse(
            data: [
                'balance' => $balance,
                'totalIn' => round($sumIn, 2),
                'totalOut' => round($sumOut, 2),
                'afnPerUsd' => $this->currencyService->getDefaultAfnPerUsd(),
            ],
            message: 'Safe balance fetched successfully.'
        );
    }

    private function assertBalanceAllowsOutTransaction(string $direction, float $amount, ?int $excludingId = null): void
    {
        if ($direction !== 'out') {
            return;
        }

        $balance = SafeTransaction::currentBalance($excludingId);
        if ($balance < $amount) {
            throw new ApiException(
                errorCode: 'SAFE_BALANCE_INSUFFICIENT',
                message: 'Safe balance is not enough for this transaction.',
                details: [
                    'currentBalance' => $balance,
                    'requestedAmount' => $amount,
                ],
                httpCode: 422,
            );
        }
    }

    private function toDatabasePayload(array $data): array
    {
        $resolvedCurrency = $this->currencyService->normalizeCurrency(
            currency: (string) ($data['currency'] ?? 'AFN'),
            exchangeRate: isset($data['exchangeRate']) ? (float) $data['exchangeRate'] : null,
        );
        $amountInput = round((float) ($data['amount'] ?? 0), 2);
        $amount = $this->currencyService->toUsd(
            amountInput: $amountInput,
            currency: $resolvedCurrency['currency'],
            exchangeRate: (float) $resolvedCurrency['exchangeRate'],
        );

        return [
            'transaction_date' => $data['transactionDate'] ?? now()->format('Y-m-d'),
            'entry_type' => $data['entryType'] ?? 'adjustment',
            'direction' => $data['direction'] ?? 'in',
            'amount' => $amount,
            'amount_input' => $amountInput,
            'currency' => $resolvedCurrency['currency'],
            'exchange_rate' => $resolvedCurrency['exchangeRate'],
            'source_id' => $data['sourceId'] ?? null,
            'source_type' => $data['sourceType'] ?? null,
            'picked_by_staff_id' => $data['pickedByStaffId'] ?? null,
            'notes' => $data['notes'] ?? null,
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

        $query->whereDate($column, $operator, (string) $resolved);
    }

    private function resolveFilterValue(mixed $value): mixed
    {
        if (is_array($value)) {
            return $value[0] ?? null;
        }

        return $value;
    }
}
