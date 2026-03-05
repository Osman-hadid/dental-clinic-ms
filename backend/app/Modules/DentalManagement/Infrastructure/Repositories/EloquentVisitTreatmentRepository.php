<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\InventoryItem;
use App\Modules\DentalManagement\Domain\Entities\Prescription;
use App\Modules\DentalManagement\Domain\Entities\PrescriptionItem;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatmentMaterial;
use App\Modules\DentalManagement\Domain\Repositories\VisitTreatmentRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment\ListVisitTreatmentsRequest;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentVisitTreatmentRepository extends BaseEloquentRepository implements VisitTreatmentRepositoryInterface
{
    protected string $model = VisitTreatment::class;

    protected string $requestClass = ListVisitTreatmentsRequest::class;

    public function find(int $id): VisitTreatment
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?VisitTreatment
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): VisitTreatment
    {
        $prescriptionData = $this->extractPrescriptionData($data);
        $materialItemsData = $this->extractMaterialItemsData($data);

        return DB::transaction(function () use ($data, $prescriptionData, $materialItemsData): VisitTreatment {
            $visitTreatment = VisitTreatment::create(attributes: $data);
            $this->syncMaterialItems($visitTreatment, $materialItemsData);
            $this->upsertPrescription($visitTreatment, $prescriptionData, true);

            return $visitTreatment->fresh();
        });
    }

    public function update(int $id, array $data): VisitTreatment
    {
        $prescriptionData = $this->extractPrescriptionData($data);
        $materialItemsData = $this->extractMaterialItemsData($data);

        return DB::transaction(function () use ($id, $data, $prescriptionData, $materialItemsData): VisitTreatment {
            $visitTreatment = $this->find($id);
            $visitTreatment->update(attributes: $data);
            $this->syncMaterialItems($visitTreatment, $materialItemsData);
            $this->upsertPrescription($visitTreatment, $prescriptionData, false);

            return $visitTreatment->fresh();
        });
    }

    public function delete(int $id): void
    {
        $visitTreatment = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($visitTreatment);
        $visitTreatment->delete();
    }

    public function forceDelete(int $id): void
    {
        $visitTreatment = VisitTreatment::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($visitTreatment);
        $visitTreatment->forceDelete();
    }

    public function restore(int $id): VisitTreatment
    {
        $visitTreatment = VisitTreatment::withTrashed()->findOrFail($id);
        $visitTreatment->restore();

        return $visitTreatment;
    }

    private function getAllowedFields(): array
    {
        $fields = request()->input('fields');
        if (!$fields) {
            return [];
        }

        $allowed = array_keys($this->requestClass::getFieldableColumns());
        $requested = array_filter(explode(',', (string) $fields));

        return array_intersect($requested, $allowed);
    }

    private function guardAgainstRelatedRecords(VisitTreatment $visitTreatment): void
    {
        if (method_exists($visitTreatment, 'hasRelatedRecords') && $visitTreatment->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'VISIT_TREATMENT_IN_USE',
                message: 'Cannot delete visit_treatment because it has related records.',
                httpCode: 409
            );
        }
    }

    private function extractPrescriptionData(array &$data): ?array
    {
        if (!array_key_exists('prescription', $data)) {
            return null;
        }

        $prescriptionData = is_array($data['prescription']) ? $data['prescription'] : null;
        unset($data['prescription']);

        return $prescriptionData;
    }

    private function extractMaterialItemsData(array &$data): ?array
    {
        if (!array_key_exists('material_items', $data)) {
            return null;
        }

        $materialItemsData = is_array($data['material_items']) ? $data['material_items'] : [];
        unset($data['material_items']);

        return $materialItemsData;
    }

    private function upsertPrescription(VisitTreatment $visitTreatment, ?array $prescriptionData, bool $isCreate): void
    {
        if ($prescriptionData === null) {
            return;
        }

        $items = $this->normalizePrescriptionItems($prescriptionData);
        $content = trim((string) ($prescriptionData['content'] ?? ''));

        if ($content === '' && $items !== []) {
            $content = $this->formatPrescriptionContent($items);
        }

        if ($content === '' && $items === []) {
            if (!$isCreate) {
                $visitTreatment->prescription()?->delete();
            }

            return;
        }

        $visit = Visit::query()
            ->select(['id', 'patient_id', 'dentist_id'])
            ->find($visitTreatment->visit_id);

        if (!$visit) {
            return;
        }

        $primaryItem = $items[0] ?? null;
        $attributes = [
            'visit_id' => (int) $visitTreatment->visit_id,
            'patient_id' => (int) $visit->patient_id,
            'dentist_id' => $visitTreatment->dentist_id !== null
                ? (int) $visitTreatment->dentist_id
                : ($visit->dentist_id !== null ? (int) $visit->dentist_id : null),
            'content' => $content,
            'medicine_name' => $primaryItem['name'] ?? null,
            'dosage_unit' => null,
            'dosage_amount' => $primaryItem['amount'] ?? null,
            'frequency' => $primaryItem['frequency'] ?? null,
            'food_timing' => $primaryItem['food_timing'] ?? null,
            'updated_by' => $isCreate ? null : ($visitTreatment->updated_by ?? $visitTreatment->created_by),
            'deleted_by' => null,
        ];

        $existing = Prescription::query()
            ->withTrashed()
            ->where('visit_treatment_id', $visitTreatment->id)
            ->first();

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }

            $existing->fill($attributes);
            $existing->save();
            $this->syncPrescriptionItems($existing, $items, $visitTreatment);

            return;
        }

        $prescription = Prescription::query()->create([
            ...$attributes,
            'visit_treatment_id' => (int) $visitTreatment->id,
            'created_by' => $visitTreatment->created_by,
        ]);
        $this->syncPrescriptionItems($prescription, $items, $visitTreatment);
    }

    private function normalizePrescriptionItems(array $prescriptionData): array
    {
        $result = [];
        $rawItems = $prescriptionData['items'] ?? null;

        if (is_array($rawItems)) {
            foreach ($rawItems as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $name = trim((string) ($item['name'] ?? ''));
                $unit = trim((string) ($item['unit'] ?? ''));
                $amount = trim((string) ($item['amount'] ?? ''));
                $frequency = trim((string) ($item['frequency'] ?? ''));
                $foodTiming = trim((string) ($item['foodTiming'] ?? $item['food_timing'] ?? ''));

                if ($name === '' || $amount === '' || $frequency === '' || $foodTiming === '') {
                    continue;
                }

                $result[] = [
                    'name' => $name,
                    'unit' => $unit,
                    'amount' => $amount,
                    'frequency' => $frequency,
                    'food_timing' => $foodTiming,
                ];
            }
        }

        if ($result !== []) {
            return $result;
        }

        $legacyName = trim((string) ($prescriptionData['name'] ?? $prescriptionData['medicine_name'] ?? ''));
        $legacyUnit = trim((string) ($prescriptionData['unit'] ?? $prescriptionData['dosage_unit'] ?? ''));
        $legacyAmount = trim((string) ($prescriptionData['amount'] ?? $prescriptionData['dosage_amount'] ?? ''));
        $legacyFrequency = trim((string) ($prescriptionData['frequency'] ?? ''));
        $legacyFoodTiming = trim((string) ($prescriptionData['foodTiming'] ?? $prescriptionData['food_timing'] ?? ''));

        if (
            $legacyName !== ''
            && $legacyAmount !== ''
            && $legacyFrequency !== ''
            && $legacyFoodTiming !== ''
        ) {
            $result[] = [
                'name' => $legacyName,
                'unit' => $legacyUnit,
                'amount' => $legacyAmount,
                'frequency' => $legacyFrequency,
                'food_timing' => $legacyFoodTiming,
            ];
        }

        return $result;
    }

    private function syncPrescriptionItems(Prescription $prescription, array $items, VisitTreatment $visitTreatment): void
    {
        PrescriptionItem::query()
            ->where('prescription_id', $prescription->id)
            ->delete();

        if ($items === []) {
            return;
        }

        $rows = array_map(
            fn (array $item): array => [
                'name' => $item['name'],
                'unit' => (string) ($item['unit'] ?? ''),
                'amount' => $item['amount'],
                'frequency' => $item['frequency'],
                'food_timing' => $item['food_timing'],
                'created_by' => $visitTreatment->created_by,
                'updated_by' => $visitTreatment->updated_by,
                'deleted_by' => null,
            ],
            $items
        );

        $prescription->items()->createMany($rows);
    }

    private function syncMaterialItems(VisitTreatment $visitTreatment, ?array $materialItemsData): void
    {
        if ($materialItemsData === null) {
            return;
        }

        $normalizedNew = $this->normalizeMaterialItems($materialItemsData);
        $existingRows = VisitTreatmentMaterial::query()
            ->where('visit_treatment_id', $visitTreatment->id)
            ->get(['id', 'inventory_item_id', 'quantity_used']);

        $existingByInventoryId = [];
        foreach ($existingRows as $row) {
            if ($row->inventory_item_id === null) {
                continue;
            }

            $existingByInventoryId[(int) $row->inventory_item_id] = (int) $row->quantity_used;
        }

        $allInventoryIds = array_values(array_unique([
            ...array_keys($existingByInventoryId),
            ...array_keys($normalizedNew),
        ]));

        $inventoryItems = InventoryItem::query()
            ->whereIn('id', $allInventoryIds)
            ->lockForUpdate()
            ->get(['id', 'item_name', 'unit', 'quantity'])
            ->keyBy('id');

        foreach ($allInventoryIds as $inventoryId) {
            /** @var InventoryItem|null $inventoryItem */
            $inventoryItem = $inventoryItems->get($inventoryId);
            if (!$inventoryItem) {
                throw new ApiException(
                    errorCode: 'INVENTORY_ITEM_NOT_FOUND',
                    message: "Inventory item {$inventoryId} was not found.",
                    httpCode: 422
                );
            }

            $existingQuantity = $existingByInventoryId[$inventoryId] ?? 0;
            $newQuantity = $normalizedNew[$inventoryId]['quantity'] ?? 0;
            $delta = $newQuantity - $existingQuantity;
            if ($delta <= 0) {
                continue;
            }

            $availableQuantity = (int) $inventoryItem->quantity;
            if ($availableQuantity < $delta) {
                throw new ApiException(
                    errorCode: 'INSUFFICIENT_INVENTORY_STOCK',
                    message: "Not enough stock for {$inventoryItem->item_name}.",
                    details: [
                        'available' => $availableQuantity,
                        'inventoryItemId' => (int) $inventoryItem->id,
                        'itemName' => (string) $inventoryItem->item_name,
                        'requested' => $delta,
                    ],
                    httpCode: 422
                );
            }
        }

        foreach ($allInventoryIds as $inventoryId) {
            /** @var InventoryItem|null $inventoryItem */
            $inventoryItem = $inventoryItems->get($inventoryId);
            if (!$inventoryItem) {
                continue;
            }

            $existingQuantity = $existingByInventoryId[$inventoryId] ?? 0;
            $newQuantity = $normalizedNew[$inventoryId]['quantity'] ?? 0;
            $delta = $newQuantity - $existingQuantity;
            if ($delta === 0) {
                continue;
            }

            $inventoryItem->quantity = (int) $inventoryItem->quantity - $delta;
            $inventoryItem->save();
        }

        VisitTreatmentMaterial::query()
            ->where('visit_treatment_id', $visitTreatment->id)
            ->delete();

        $rowsToCreate = [];
        foreach ($normalizedNew as $inventoryId => $item) {
            /** @var InventoryItem|null $inventoryItem */
            $inventoryItem = $inventoryItems->get($inventoryId);
            if (!$inventoryItem) {
                continue;
            }

            $rowsToCreate[] = [
                'inventory_item_id' => (int) $inventoryItem->id,
                'item_name' => (string) $inventoryItem->item_name,
                'unit' => (string) ($inventoryItem->unit ?: 'unit'),
                'quantity_used' => $item['quantity'],
                'created_by' => $visitTreatment->created_by,
                'updated_by' => $visitTreatment->updated_by,
                'deleted_by' => null,
            ];
        }

        if ($rowsToCreate !== []) {
            $visitTreatment->materialItems()->createMany($rowsToCreate);
        }

        $summary = $this->buildMaterialSummary($rowsToCreate);
        $visitTreatment->material = $summary !== '' ? $summary : null;
        $visitTreatment->save();
    }

    private function normalizeMaterialItems(array $materialItemsData): array
    {
        $result = [];

        foreach ($materialItemsData as $item) {
            if (!is_array($item)) {
                continue;
            }

            $inventoryItemId = (int) ($item['inventory_item_id'] ?? $item['inventoryItemId'] ?? 0);
            $quantity = (int) ($item['quantity'] ?? $item['quantity_used'] ?? 0);
            if ($inventoryItemId <= 0 || $quantity <= 0) {
                continue;
            }

            if (!isset($result[$inventoryItemId])) {
                $result[$inventoryItemId] = [
                    'inventory_item_id' => $inventoryItemId,
                    'quantity' => 0,
                ];
            }

            $result[$inventoryItemId]['quantity'] += $quantity;
        }

        return $result;
    }

    private function buildMaterialSummary(array $rows): string
    {
        if ($rows === []) {
            return '';
        }

        $parts = array_map(
            fn (array $row): string => sprintf('%s x%d', (string) ($row['item_name'] ?? '-'), (int) ($row['quantity_used'] ?? 0)),
            $rows
        );
        $summary = implode(', ', $parts);

        return strlen($summary) > 255 ? substr($summary, 0, 255) : $summary;
    }

    private function formatPrescriptionContent(array $items): string
    {
        if ($items === []) {
            return '';
        }

        $rows = array_map(function (array $item): string {
            $foodPart = match ((string) ($item['food_timing'] ?? '')) {
                'before_food' => 'Before food',
                'after_food' => 'After food',
                'with_food' => 'With food',
                'anytime' => 'Anytime',
                default => '',
            };

            $dosePart = trim((string) ($item['amount'] ?? ''));
            $namePart = (string) ($item['name'] ?? '');
            if ($namePart !== '' && $dosePart !== '') {
                $namePart = "{$namePart} ({$dosePart})";
            } elseif ($namePart === '') {
                $namePart = $dosePart;
            }

            $parts = array_filter([
                $namePart,
                (string) ($item['frequency'] ?? ''),
                $foodPart,
            ]);

            return implode(', ', $parts);
        }, $items);

        return implode('; ', array_filter($rows));
    }
}
