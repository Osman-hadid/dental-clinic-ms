<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Domain\Entities\InventoryItem;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\InventoryItem\ListInventoryItemsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\InventoryItem\StoreInventoryItemRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\InventoryItem\UpdateInventoryItemRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\InventoryItemResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final class InventoryItemController extends BaseApiController
{
    public function index(ListInventoryItemsRequest $request): JsonResponse
    {
        $queryData = $request->validated();
        $filters = $queryData['filters'] ?? [];

        $query = InventoryItem::query();

        if (($queryData['search'] ?? null) !== null) {
            $search = trim((string) $queryData['search']);
            if ($search !== '') {
                $query->where(function ($builder) use ($search): void {
                    $builder
                        ->where('item_name', 'ilike', "%{$search}%")
                        ->orWhere('category', 'ilike', "%{$search}%")
                        ->orWhere('supplier', 'ilike', "%{$search}%")
                        ->orWhere('lot_number', 'ilike', "%{$search}%")
                        ->orWhere('location', 'ilike', "%{$search}%")
                        ->orWhere('notes', 'ilike', "%{$search}%");
                });
            }
        }

        $this->applyTrashedFilter($query, (string) ($filters['trashed'] ?? 'without'));
        $this->applyExactFilter($query, 'category', $filters['category'] ?? null);
        $this->applyExactFilter($query, 'acquisition_source', $filters['acquisitionSource'] ?? null);
        $this->applyDateFilter($query, 'entry_date', $filters['dateFrom'] ?? null, '>=');
        $this->applyDateFilter($query, 'entry_date', $filters['dateTo'] ?? null, '<=');

        $query->orderBy((string) ($queryData['sortBy'] ?? 'created_at'), (string) ($queryData['sortDirection'] ?? 'desc'));

        $paginated = $query->paginate((int) ($queryData['perPage'] ?? 10), ['*'], 'page', (int) ($queryData['page'] ?? 1));

        return $this->successResponse(
            data: new PaginatedResource($paginated, InventoryItemResource::class),
            message: 'Inventory items fetched successfully.'
        );
    }

    public function store(StoreInventoryItemRequest $request): JsonResponse
    {
        $payload = $this->toDatabasePayload($request->validated());

        $item = DB::transaction(function () use ($payload): InventoryItem {
            $item = InventoryItem::query()->create($payload);
            $this->syncSafeTransaction($item);
            return $item;
        });

        return $this->successResponse(
            data: new InventoryItemResource($item),
            message: 'Inventory item created successfully.',
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $item = InventoryItem::query()->findOrFail($id);

        return $this->successResponse(
            data: new InventoryItemResource($item),
            message: 'Inventory item fetched successfully.'
        );
    }

    public function update(UpdateInventoryItemRequest $request, int $id): JsonResponse
    {
        $payload = $this->toDatabasePayload($request->validated());

        $item = DB::transaction(function () use ($id, $payload): InventoryItem {
            $item = InventoryItem::query()->findOrFail($id);
            $item->fill($payload);
            $item->save();
            $this->syncSafeTransaction($item);
            return $item;
        });

        return $this->successResponse(
            data: new InventoryItemResource($item),
            message: 'Inventory item updated successfully.'
        );
    }

    public function destroy(int $id): JsonResponse
    {
        DB::transaction(function () use ($id): void {
            $item = InventoryItem::query()->findOrFail($id);
            $item->delete();

            SafeTransaction::query()
                ->where('source_type', 'inventory_item')
                ->where('source_id', $item->id)
                ->delete();
        });

        return $this->successResponse(
            data: null,
            message: 'Inventory item deleted successfully.'
        );
    }

    private function syncSafeTransaction(InventoryItem $item): void
    {
        $entry = SafeTransaction::withTrashed()
            ->firstOrNew([
                'source_type' => 'inventory_item',
                'source_id' => $item->id,
            ]);

        $shouldAffectSafe = $item->acquisition_source === 'purchase' && (float) $item->total_cost > 0;
        if (!$shouldAffectSafe) {
            if ($entry->exists) {
                $entry->delete();
            }
            return;
        }

        $currentBalance = SafeTransaction::currentBalance($entry->exists ? $entry->id : null);
        if ($currentBalance < (float) $item->total_cost) {
            throw new ApiException(
                errorCode: 'SAFE_BALANCE_INSUFFICIENT',
                message: 'Safe balance is not enough for this inventory purchase.',
                details: [
                    'currentBalance' => $currentBalance,
                    'requestedAmount' => (float) $item->total_cost,
                ],
                httpCode: 422,
            );
        }

        $entry->fill([
            'transaction_date' => $item->entry_date,
            'entry_type' => 'expense',
            'direction' => 'out',
            'amount' => $item->total_cost,
            'amount_input' => round((float) $item->total_cost, 2),
            'currency' => 'AFN',
            'exchange_rate' => 1,
            'notes' => sprintf(
                'Inventory purchase: %s%s',
                (string) $item->item_name,
                $item->supplier ? " (Supplier: {$item->supplier})" : ''
            ),
            'picked_by_staff_id' => null,
        ]);
        $entry->deleted_at = null;
        $entry->save();
    }

    private function toDatabasePayload(array $data): array
    {
        $quantity = max(0, (int) ($data['quantity'] ?? 0));
        $unitCost = round(max(0, (float) ($data['unitCost'] ?? 0)), 2);
        $totalCost = round($quantity * $unitCost, 2);

        return [
            'acquisition_source' => $data['acquisitionSource'] ?? 'previous_stock',
            'entry_date' => $data['entryDate'] ?? now()->format('Y-m-d'),
            'item_name' => trim((string) ($data['itemName'] ?? '')),
            'category' => $data['category'] ?? 'other',
            'quantity' => $quantity,
            'unit' => $data['unit'] ?? 'piece',
            'min_stock' => max(0, (int) ($data['minStock'] ?? 0)),
            'unit_cost' => $unitCost,
            'total_cost' => $totalCost,
            'supplier' => $data['supplier'] ?? null,
            'lot_number' => $data['lotNumber'] ?? null,
            'expiry_date' => $data['expiryDate'] ?? null,
            'location' => $data['location'] ?? null,
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
