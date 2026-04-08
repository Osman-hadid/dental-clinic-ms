<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\Shareholder;
use App\Modules\DentalManagement\Domain\Entities\ShareholderTransaction;
use App\Modules\DentalManagement\Domain\Services\CurrencyService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\ShareholderTransaction\ListShareholderTransactionsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\ShareholderTransaction\StoreShareholderTransactionRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\ShareholderTransaction\UpdateShareholderTransactionRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\ShareholderTransactionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final class ShareholderTransactionController extends BaseApiController
{
    public function __construct(private readonly CurrencyService $currencyService) {}

    public function index(ListShareholderTransactionsRequest $request): JsonResponse
    {
        $this->authorize('viewAny', ShareholderTransaction::class);

        $queryData = $request->validated();
        $filters = $queryData['filters'] ?? [];
        $search = trim((string) ($queryData['search'] ?? ''));

        $query = ShareholderTransaction::query()->with($queryData['include'] ?? []);

        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('transaction_type', 'ilike', "%{$search}%")
                    ->orWhere('notes', 'ilike', "%{$search}%")
                    ->orWhereHas('shareholder', function ($relationBuilder) use ($search): void {
                        $relationBuilder->where('full_name', 'ilike', "%{$search}%");
                    });
            });
        }

        $this->applyTrashedFilter($query, (string) ($filters['trashed'] ?? 'without'));
        $this->applyExactFilter($query, 'transaction_type', $filters['transactionType'] ?? null);
        $this->applyExactFilter($query, 'shareholder_id', $filters['shareholderId'] ?? null);
        $this->applyExactFilter($query, 'currency', $filters['currency'] ?? null);
        $this->applyDateFilter($query, 'transaction_date', $filters['dateFrom'] ?? null, '>=');
        $this->applyDateFilter($query, 'transaction_date', $filters['dateTo'] ?? null, '<=');

        $query->orderBy((string) ($queryData['sortBy'] ?? 'transaction_date'), (string) ($queryData['sortDirection'] ?? 'desc'));

        $paginated = $query->paginate((int) ($queryData['perPage'] ?? 10), ['*'], 'page', (int) ($queryData['page'] ?? 1));

        return $this->successResponse(
            data: new PaginatedResource($paginated, ShareholderTransactionResource::class),
            message: __('DentalManagement::messages.shareholder_transactions.fetched')
        );
    }

    public function store(StoreShareholderTransactionRequest $request): JsonResponse
    {
        $this->authorize('create', ShareholderTransaction::class);

        $payload = $this->toDatabasePayload($request->validated());

        $transaction = DB::transaction(function () use ($payload): ShareholderTransaction {
            $created = ShareholderTransaction::query()->create($payload);
            $this->syncSafeTransaction($created);

            return $this->hydrateTransaction((int) $created->id);
        });

        return $this->successResponse(
            data: new ShareholderTransactionResource($transaction),
            message: __('DentalManagement::messages.shareholder_transaction.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $transaction = $this->hydrateTransaction($id);
        $this->authorize('view', $transaction);

        return $this->successResponse(
            data: new ShareholderTransactionResource($transaction),
            message: __('DentalManagement::messages.shareholder_transaction.fetched')
        );
    }

    public function update(UpdateShareholderTransactionRequest $request, int $id): JsonResponse
    {
        $existing = ShareholderTransaction::query()->findOrFail($id);
        $this->authorize('update', $existing);

        $payload = $this->toDatabasePayload($request->validated());

        $transaction = DB::transaction(function () use ($id, $payload): ShareholderTransaction {
            $model = ShareholderTransaction::query()->findOrFail($id);
            $model->fill($payload);
            $model->save();
            $this->syncSafeTransaction($model);

            return $this->hydrateTransaction($id);
        });

        return $this->successResponse(
            data: new ShareholderTransactionResource($transaction),
            message: __('DentalManagement::messages.shareholder_transaction.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $transaction = ShareholderTransaction::query()->findOrFail($id);
        $this->authorize('delete', $transaction);

        DB::transaction(function () use ($transaction): void {
            $safeEntry = $this->resolveSafeEntry($transaction);
            $transaction->delete();

            if ($safeEntry !== null) {
                $safeEntry->delete();
            }
        });

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.shareholder_transaction.deleted')
        );
    }

    private function hydrateTransaction(int $id): ShareholderTransaction
    {
        return ShareholderTransaction::query()
            ->with(['shareholder', 'safeTransaction'])
            ->findOrFail($id);
    }

    private function syncSafeTransaction(ShareholderTransaction $transaction): void
    {
        $shareholder = Shareholder::query()->findOrFail((int) $transaction->shareholder_id);
        $entry = $this->resolveSafeEntry($transaction);

        $isContribution = $transaction->transaction_type === 'contribution';
        $direction = $isContribution ? 'in' : 'out';
        $entryType = $isContribution ? 'deposit' : 'withdrawal';
        $amount = round((float) ($transaction->amount ?? 0), 2);
        $currency = strtoupper((string) ($transaction->currency ?? 'AFN')) === 'USD' ? 'USD' : 'AFN';
        $requestedAmount = round((float) ($transaction->amount_input ?? $transaction->amount ?? 0), 2);

        if ($direction === 'out') {
            $existingId = $entry?->id;
            $currentBalance = SafeTransaction::currentBalanceForCurrency($currency, $existingId);
            if ($currentBalance < $requestedAmount) {
                throw new ApiException(
                    errorCode: 'SAFE_BALANCE_INSUFFICIENT',
                    message: 'Safe balance is not enough for this shareholder distribution.',
                    details: [
                        'currentBalance' => $currentBalance,
                        'currency' => $currency,
                        'requestedAmount' => $requestedAmount,
                    ],
                    httpCode: 422,
                );
            }
        }

        $entry ??= new SafeTransaction();
        $entry->fill([
            'source_type' => 'shareholder_transaction',
            'source_id' => $transaction->id,
            'transaction_date' => $transaction->transaction_date,
            'entry_type' => $entryType,
            'direction' => $direction,
            'amount' => $amount,
            'amount_input' => $requestedAmount,
            'currency' => $currency,
            'exchange_rate' => round((float) ($transaction->exchange_rate ?? 1), 6),
            'notes' => $transaction->notes ?: "Shareholder {$transaction->transaction_type} - {$shareholder->full_name}",
        ]);
        $entry->deleted_at = null;
        $entry->save();

        if ((int) ($transaction->safe_transaction_id ?? 0) !== (int) $entry->id) {
            $transaction->safe_transaction_id = (int) $entry->id;
            $transaction->saveQuietly();
        }
    }

    private function resolveSafeEntry(ShareholderTransaction $transaction): ?SafeTransaction
    {
        $safeTransactionId = (int) ($transaction->safe_transaction_id ?? 0);
        if ($safeTransactionId > 0) {
            return SafeTransaction::withTrashed()->find($safeTransactionId);
        }

        return SafeTransaction::withTrashed()
            ->where('source_type', 'shareholder_transaction')
            ->where('source_id', $transaction->id)
            ->first();
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
            'shareholder_id' => (int) ($data['shareholderId'] ?? 0),
            'transaction_date' => (string) ($data['transactionDate'] ?? now()->format('Y-m-d')),
            'transaction_type' => (string) ($data['transactionType'] ?? 'contribution'),
            'amount' => $amount,
            'amount_input' => $amountInput,
            'currency' => $resolvedCurrency['currency'],
            'exchange_rate' => $resolvedCurrency['exchangeRate'],
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
