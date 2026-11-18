<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\SalaryPayment;
use App\Modules\DentalManagement\Domain\Services\CurrencyService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\SalaryPayment\ListSalaryPaymentsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\SalaryPayment\StoreSalaryPaymentRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\SalaryPayment\UpdateSalaryPaymentRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\SalaryPaymentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final class SalaryPaymentController extends BaseApiController
{
    public function __construct(private readonly CurrencyService $currencyService) {}

    public function index(ListSalaryPaymentsRequest $request): JsonResponse
    {
        $this->authorize('viewAny', SalaryPayment::class);
        $queryData = $request->validated();
        $filters = $queryData['filters'] ?? [];

        $query = SalaryPayment::query()->with($queryData['include'] ?? []);

        if (($queryData['search'] ?? null) !== null) {
            $search = trim((string) $queryData['search']);
            if ($search !== '') {
                $query->where(function ($builder) use ($search): void {
                    $builder->where('salary_month', 'ilike', "%{$search}%")
                        ->orWhere('notes', 'ilike', "%{$search}%");
                });
            }
        }

        $this->applyTrashedFilter($query, (string) ($filters['trashed'] ?? 'without'));
        $this->applyExactFilter($query, 'status', $filters['status'] ?? null);
        $this->applyExactFilter($query, 'staff_id', $filters['staffId'] ?? null);
        $this->applyExactFilter($query, 'currency', $filters['currency'] ?? null);
        $this->applyDateFilter($query, 'payment_date', $filters['dateFrom'] ?? null, '>=');
        $this->applyDateFilter($query, 'payment_date', $filters['dateTo'] ?? null, '<=');

        $query->orderBy((string) ($queryData['sortBy'] ?? 'created_at'), (string) ($queryData['sortDirection'] ?? 'desc'));

        $paginated = $query->paginate((int) ($queryData['perPage'] ?? 10), ['*'], 'page', (int) ($queryData['page'] ?? 1));

        return $this->successResponse(
            data: new PaginatedResource($paginated, SalaryPaymentResource::class),
            message: 'Salary payments fetched successfully.'
        );
    }

    public function store(StoreSalaryPaymentRequest $request): JsonResponse
    {
        $this->authorize('create', SalaryPayment::class);
        $payload = $this->toDatabasePayload($request->validated());

        $salary = DB::transaction(function () use ($payload): SalaryPayment {
            $salary = SalaryPayment::query()->create($payload);
            $this->syncSafeTransaction($salary);

            return $salary->load('staff');
        });

        return $this->successResponse(
            data: new SalaryPaymentResource($salary),
            message: 'Salary payment created successfully.',
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $this->authorize('view', SalaryPayment::class);
        $salary = SalaryPayment::query()->with('staff')->findOrFail($id);

        return $this->successResponse(
            data: new SalaryPaymentResource($salary),
            message: 'Salary payment fetched successfully.'
        );
    }

    public function update(UpdateSalaryPaymentRequest $request, int $id): JsonResponse
    {
        $this->authorize('update', SalaryPayment::class);
        $payload = $this->toDatabasePayload($request->validated());

        $salary = DB::transaction(function () use ($id, $payload): SalaryPayment {
            $salary = SalaryPayment::query()->findOrFail($id);
            $salary->fill($payload);
            $salary->save();
            $this->syncSafeTransaction($salary);

            return $salary->load('staff');
        });

        return $this->successResponse(
            data: new SalaryPaymentResource($salary),
            message: 'Salary payment updated successfully.'
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', SalaryPayment::class);
        DB::transaction(function () use ($id): void {
            $salary = SalaryPayment::query()->findOrFail($id);
            $salary->delete();
            SafeTransaction::query()
                ->where('source_type', 'salary_payment')
                ->where('source_id', $salary->id)
                ->delete();
        });

        return $this->successResponse(
            data: null,
            message: 'Salary payment deleted successfully.'
        );
    }

    private function syncSafeTransaction(SalaryPayment $salary): void
    {
        $entry = SafeTransaction::withTrashed()
            ->where('source_type', 'salary_payment')
            ->where('source_id', $salary->id)
            ->first();

        if (!$salary->paid_from_safe || $salary->status === 'pending') {
            if ($entry) {
                $entry->delete();
            }

            return;
        }

        $existingId = $entry?->id;
        $currency = strtoupper((string) ($salary->currency ?? 'AFN')) === 'USD' ? 'USD' : 'AFN';
        $requestedAmount = round((float) ($salary->net_amount_input ?? $salary->net_amount ?? 0), 2);
        $currentBalance = SafeTransaction::currentBalanceForCurrency($currency, $existingId);
        if ($currentBalance < $requestedAmount) {
            throw new ApiException(
                errorCode: 'SAFE_BALANCE_INSUFFICIENT',
                message: 'Safe balance is not enough for this salary payment.',
                details: [
                    'currentBalance' => $currentBalance,
                    'currency' => $currency,
                    'requestedAmount' => $requestedAmount,
                ],
                httpCode: 422,
            );
        }

        $entry ??= new SafeTransaction;
        $entry->fill([
            'source_type' => 'salary_payment',
            'source_id' => $salary->id,
            'transaction_date' => $salary->payment_date,
            'entry_type' => 'salary',
            'direction' => 'out',
            'amount' => $salary->net_amount,
            'amount_input' => $requestedAmount,
            'currency' => $currency,
            'exchange_rate' => round((float) ($salary->exchange_rate ?? 1), 6),
            'picked_by_staff_id' => $salary->staff_id,
            'notes' => "Salary {$salary->salary_month}",
        ]);
        $entry->deleted_at = null;
        $entry->save();
    }

    private function toDatabasePayload(array $data): array
    {
        $resolvedCurrency = $this->currencyService->normalizeCurrency(
            currency: (string) ($data['currency'] ?? 'AFN'),
            exchangeRate: isset($data['exchangeRate']) ? (float) $data['exchangeRate'] : null,
        );

        $grossInput = round((float) ($data['grossAmount'] ?? 0), 2);
        $bonusInput = round((float) ($data['bonusAmount'] ?? 0), 2);
        $deductionInput = round((float) ($data['deductionAmount'] ?? 0), 2);
        $netInput = array_key_exists('netAmount', $data)
            ? round((float) $data['netAmount'], 2)
            : round(max(0, $grossInput + $bonusInput - $deductionInput), 2);

        $gross = $this->currencyService->toAfn($grossInput, $resolvedCurrency['currency'], (float) $resolvedCurrency['exchangeRate']);
        $bonus = $this->currencyService->toAfn($bonusInput, $resolvedCurrency['currency'], (float) $resolvedCurrency['exchangeRate']);
        $deduction = $this->currencyService->toAfn($deductionInput, $resolvedCurrency['currency'], (float) $resolvedCurrency['exchangeRate']);
        $net = $this->currencyService->toAfn($netInput, $resolvedCurrency['currency'], (float) $resolvedCurrency['exchangeRate']);

        return [
            'staff_id' => (int) ($data['staffId'] ?? 0),
            'salary_month' => (string) ($data['salaryMonth'] ?? now()->format('Y-m')),
            'payment_date' => (string) ($data['paymentDate'] ?? now()->format('Y-m-d')),
            'gross_amount' => $gross,
            'gross_amount_input' => $grossInput,
            'bonus_amount' => $bonus,
            'bonus_amount_input' => $bonusInput,
            'deduction_amount' => $deduction,
            'deduction_amount_input' => $deductionInput,
            'net_amount' => $net,
            'net_amount_input' => $netInput,
            'currency' => $resolvedCurrency['currency'],
            'exchange_rate' => $resolvedCurrency['exchangeRate'],
            'status' => (string) ($data['status'] ?? 'pending'),
            'paid_from_safe' => (bool) ($data['paidFromSafe'] ?? true),
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
