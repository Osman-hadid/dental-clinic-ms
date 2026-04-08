<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\DentalManagement\Domain\Entities\Expense;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Services\CurrencyService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Expense\ListExpensesRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Expense\StoreExpenseRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Expense\UpdateExpenseRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\ExpenseResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final class ExpenseController extends BaseApiController
{
    public function __construct(private readonly CurrencyService $currencyService) {}

    public function index(ListExpensesRequest $listExpensesRequest): JsonResponse
    {
        $queryData = $listExpensesRequest->validated();
        $filters = $queryData['filters'] ?? [];

        $query = Expense::query()
            ->with($queryData['include'] ?? []);

        if (($queryData['search'] ?? null) !== null) {
            $search = trim((string) $queryData['search']);
            if ($search !== '') {
                $query->where(function ($builder) use ($search): void {
                    $builder->where('title', 'ilike', "%{$search}%")
                        ->orWhere('notes', 'ilike', "%{$search}%")
                        ->orWhere('vendor', 'ilike', "%{$search}%")
                        ->orWhere('category', 'ilike', "%{$search}%");
                });
            }
        }

        $this->applyTrashedFilter($query, (string) ($filters['trashed'] ?? 'without'));
        $this->applyExactFilter($query, 'expense_type', $filters['expenseType'] ?? null);
        $this->applyExactFilter($query, 'category', $filters['category'] ?? null);
        $this->applyExactFilter($query, 'staff_id', $filters['staffId'] ?? null);
        $this->applyExactFilter($query, 'currency', $filters['currency'] ?? null);
        $this->applyDateFilter($query, 'expense_date', $filters['dateFrom'] ?? null, '>=');
        $this->applyDateFilter($query, 'expense_date', $filters['dateTo'] ?? null, '<=');

        $query->orderBy((string) ($queryData['sortBy'] ?? 'created_at'), (string) ($queryData['sortDirection'] ?? 'desc'));

        $paginated = $query->paginate((int) ($queryData['perPage'] ?? 10), ['*'], 'page', (int) ($queryData['page'] ?? 1));

        return $this->successResponse(
            data: new PaginatedResource($paginated, ExpenseResource::class),
            message: 'Expenses fetched successfully.'
        );
    }

    public function store(StoreExpenseRequest $storeExpenseRequest): JsonResponse
    {
        $data = $this->toDatabasePayload($storeExpenseRequest->validated());

        $expense = DB::transaction(function () use ($data): Expense {
            $expense = Expense::query()->create($data);
            $this->syncSafeTransaction($expense);

            return $expense->load('staff');
        });

        return $this->successResponse(
            data: new ExpenseResource($expense),
            message: 'Expense created successfully.',
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $expense = Expense::query()->with('staff')->findOrFail($id);

        return $this->successResponse(
            data: new ExpenseResource($expense),
            message: 'Expense fetched successfully.'
        );
    }

    public function update(UpdateExpenseRequest $updateExpenseRequest, int $id): JsonResponse
    {
        $data = $this->toDatabasePayload($updateExpenseRequest->validated());

        $expense = DB::transaction(function () use ($data, $id): Expense {
            $expense = Expense::query()->findOrFail($id);
            $expense->fill($data);
            $expense->save();
            $this->syncSafeTransaction($expense);

            return $expense->load('staff');
        });

        return $this->successResponse(
            data: new ExpenseResource($expense),
            message: 'Expense updated successfully.'
        );
    }

    public function destroy(int $id): JsonResponse
    {
        DB::transaction(function () use ($id): void {
            $expense = Expense::query()->findOrFail($id);
            $expense->delete();
            SafeTransaction::query()
                ->where('source_type', 'expense')
                ->where('source_id', $expense->id)
                ->delete();
        });

        return $this->successResponse(
            data: null,
            message: 'Expense deleted successfully.'
        );
    }

    private function syncSafeTransaction(Expense $expense): void
    {
        $entry = SafeTransaction::withTrashed()
            ->firstOrNew([
                'source_type' => 'expense',
                'source_id' => $expense->id,
            ]);

        $currency = strtoupper((string) ($expense->currency ?? 'AFN')) === 'USD' ? 'USD' : 'AFN';
        $requestedAmount = round((float) ($expense->amount_input ?? $expense->amount ?? 0), 2);
        $currentBalance = SafeTransaction::currentBalanceForCurrency($currency, $entry->exists ? $entry->id : null);
        if ($currentBalance < $requestedAmount) {
            throw new ApiException(
                errorCode: 'SAFE_BALANCE_INSUFFICIENT',
                message: 'Safe balance is not enough for this expense.',
                details: [
                    'currentBalance' => $currentBalance,
                    'currency' => $currency,
                    'requestedAmount' => $requestedAmount,
                ],
                httpCode: 422,
            );
        }

        $entry->fill([
            'transaction_date' => $expense->expense_date,
            'entry_type' => 'expense',
            'direction' => 'out',
            'amount' => $expense->amount,
            'amount_input' => $requestedAmount,
            'currency' => $currency,
            'exchange_rate' => round((float) ($expense->exchange_rate ?? 1), 6),
            'notes' => $expense->title,
            'picked_by_staff_id' => $expense->staff_id,
        ]);
        $entry->deleted_at = null;
        $entry->save();
    }

    private function toDatabasePayload(array $data): array
    {
        $quantity = isset($data['quantity']) ? (int) $data['quantity'] : null;
        $unitCostInput = isset($data['unitCost']) ? round((float) $data['unitCost'], 2) : null;
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
        $unitCost = $unitCostInput !== null
            ? $this->currencyService->toUsd(
                amountInput: $unitCostInput,
                currency: $resolvedCurrency['currency'],
                exchangeRate: (float) $resolvedCurrency['exchangeRate'],
            )
            : null;

        return [
            'expense_type' => $data['expenseType'] ?? 'daily',
            'title' => trim((string) ($data['title'] ?? '')),
            'category' => trim((string) ($data['category'] ?? 'Other')),
            'amount' => $amount,
            'amount_input' => $amountInput,
            'currency' => $resolvedCurrency['currency'],
            'exchange_rate' => $resolvedCurrency['exchangeRate'],
            'expense_date' => $data['expenseDate'] ?? now()->format('Y-m-d'),
            'payment_method' => $data['paymentMethod'] ?? null,
            'vendor' => $data['vendor'] ?? null,
            'quantity' => $quantity,
            'unit_cost' => $unitCost,
            'unit_cost_input' => $unitCostInput,
            'notes' => $data['notes'] ?? null,
            'source_id' => $data['sourceId'] ?? null,
            'source_type' => $data['sourceType'] ?? null,
            'staff_id' => $data['staffId'] ?? null,
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
        if (is_array($value)) {
            return $value[0] ?? null;
        }

        return $value;
    }
}
