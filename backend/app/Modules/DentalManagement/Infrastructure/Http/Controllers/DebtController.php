<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Domain\Entities\Debt;
use App\Modules\DentalManagement\Domain\Services\DebtService;
use App\Modules\DentalManagement\Domain\Services\DebtSettlementService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Debt\ListDebtsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Debt\SettleDebtRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\DebtResource;
use Illuminate\Http\JsonResponse;

final class DebtController extends BaseApiController
{
    public function __construct(
        private readonly DebtService $debtService,
        private readonly DebtSettlementService $debtSettlementService,
    ) {}

    public function index(ListDebtsRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Debt::class);

        $queryData = $request->validated();
        $filters = $queryData['filters'] ?? [];

        $query = Debt::query()->with($queryData['include'] ?? []);

        if (($queryData['search'] ?? null) !== null) {
            $search = trim((string) $queryData['search']);
            if ($search !== '') {
                $query->where(function ($builder) use ($search): void {
                    $builder->where('status', 'ilike', "%{$search}%")
                        ->orWhere('invoice_id', 'ilike', "%{$search}%")
                        ->orWhereHas('patient', function ($relationQuery) use ($search): void {
                            $relationQuery
                                ->where('first_name', 'ilike', "%{$search}%")
                                ->orWhere('last_name', 'ilike', "%{$search}%")
                                ->orWhere('patient_code', 'ilike', "%{$search}%");
                        });
                });
            }
        }

        $status = $this->resolveFilterValue($filters['status'] ?? 'open');
        if ($status !== null && $status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $this->applyExactFilter($query, 'invoice_id', $filters['invoiceId'] ?? null);
        $this->applyExactFilter($query, 'patient_id', $filters['patientId'] ?? null);
        $this->applyDateFilter($query, 'invoice_date', $filters['dateFrom'] ?? null, '>=');
        $this->applyDateFilter($query, 'invoice_date', $filters['dateTo'] ?? null, '<=');

        $query->orderBy((string) ($queryData['sortBy'] ?? 'invoice_date'), (string) ($queryData['sortDirection'] ?? 'desc'));

        $paginated = $query->paginate((int) ($queryData['perPage'] ?? 10), ['*'], 'page', (int) ($queryData['page'] ?? 1));

        return $this->successResponse(
            data: new PaginatedResource($paginated, DebtResource::class),
            message: 'Debts fetched successfully.'
        );
    }

    public function rebuild(): JsonResponse
    {
        $this->authorize('update', Debt::class);

        $this->debtService->syncAll();

        return $this->successResponse(
            data: null,
            message: 'Debts rebuilt successfully.'
        );
    }

    public function settle(SettleDebtRequest $request, int $id): JsonResponse
    {
        $this->authorize('create', Debt::class);

        $result = $this->debtSettlementService->settleDebt($id, $request->validated());

        return $this->successResponse(
            data: [
                'paymentId' => (int) $result['payment']->id,
                'settlementInvoiceId' => (int) $result['settlementInvoice']->id,
                'sourceInvoiceId' => (int) $result['sourceInvoice']->id,
            ],
            message: 'Debt settled and settlement invoice generated successfully.'
        );
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
