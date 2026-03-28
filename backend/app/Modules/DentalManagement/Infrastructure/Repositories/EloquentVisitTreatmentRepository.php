<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Models\User;
use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Application\UseCases\DeleteFileUseCase;
use App\Modules\Common\Application\UseCases\FileUploadUseCase;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\InventoryItem;
use App\Modules\DentalManagement\Domain\Entities\Prescription;
use App\Modules\DentalManagement\Domain\Entities\PrescriptionItem;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatmentImage;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatmentMaterial;
use App\Modules\DentalManagement\Domain\Repositories\VisitTreatmentRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment\ListVisitTreatmentsRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentVisitTreatmentRepository extends BaseEloquentRepository implements VisitTreatmentRepositoryInterface
{
    private const FILE_UPLOAD_MODULE = 'dental-management';

    protected string $model = VisitTreatment::class;

    protected string $requestClass = ListVisitTreatmentsRequest::class;

    public function __construct(
        private readonly FileUploadUseCase $fileUploadUseCase,
        private readonly DeleteFileUseCase $deleteFileUseCase,
    ) {}

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
        $data = $this->stripUnsupportedImagingData($data);
        $correctionReason = $this->extractCorrectionReason($data);
        $prescriptionData = $this->extractPrescriptionData($data);
        $materialItemsData = $this->extractMaterialItemsData($data);
        $treatmentImagesData = $this->extractTreatmentImagesData($data);
        $retainedTreatmentImageIds = $this->extractRetainedTreatmentImageIds($data);

        return DB::transaction(function () use ($data, $correctionReason, $prescriptionData, $materialItemsData, $treatmentImagesData, $retainedTreatmentImageIds): VisitTreatment {
            $visitTreatment = VisitTreatment::create(attributes: $data);
            $this->syncMaterialItems($visitTreatment, $materialItemsData);
            $this->upsertPrescription($visitTreatment, $prescriptionData, true);
            $this->syncTreatmentImages($visitTreatment, $treatmentImagesData, $retainedTreatmentImageIds);

            $freshVisitTreatment = $visitTreatment->fresh($this->freshRelations());
            $this->recordVisitTreatmentActivity(
                event: 'created',
                visitTreatment: $freshVisitTreatment,
                afterSnapshot: $this->auditSnapshot($freshVisitTreatment),
                reason: $correctionReason,
            );

            return $freshVisitTreatment->load($this->freshRelations());
        });
    }

    public function update(int $id, array $data): VisitTreatment
    {
        $data = $this->stripUnsupportedImagingData($data);
        $correctionReason = $this->extractCorrectionReason($data);
        $prescriptionData = $this->extractPrescriptionData($data);
        $materialItemsData = $this->extractMaterialItemsData($data);
        $treatmentImagesData = $this->extractTreatmentImagesData($data);
        $retainedTreatmentImageIds = $this->extractRetainedTreatmentImageIds($data);

        return DB::transaction(function () use ($id, $data, $correctionReason, $prescriptionData, $materialItemsData, $treatmentImagesData, $retainedTreatmentImageIds): VisitTreatment {
            $visitTreatment = $this->findForAudit($id);
            $beforeSnapshot = $this->auditSnapshot($visitTreatment);
            $visitTreatment->update(attributes: $data);
            $this->syncMaterialItems($visitTreatment, $materialItemsData);
            $this->upsertPrescription($visitTreatment, $prescriptionData, false);
            $this->syncTreatmentImages($visitTreatment, $treatmentImagesData, $retainedTreatmentImageIds);

            $freshVisitTreatment = $visitTreatment->fresh($this->freshRelations());
            $afterSnapshot = $this->auditSnapshot($freshVisitTreatment);
            $this->recordVisitTreatmentActivity(
                event: 'corrected',
                visitTreatment: $freshVisitTreatment,
                beforeSnapshot: $beforeSnapshot,
                afterSnapshot: $afterSnapshot,
                reason: $correctionReason,
            );

            return $freshVisitTreatment->load($this->freshRelations());
        });
    }

    public function delete(int $id): void
    {
        $visitTreatment = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($visitTreatment);
        $snapshot = $this->auditSnapshot($this->findForAudit($id));
        $visitTreatment->delete();
        $this->recordVisitTreatmentActivity(
            event: 'deleted',
            visitTreatment: $visitTreatment,
            beforeSnapshot: $snapshot,
        );
    }

    public function forceDelete(int $id): void
    {
        $query = VisitTreatment::withTrashed();
        if ($this->supportsTreatmentImagesTable()) {
            $query->with('treatmentImages');
        }

        $visitTreatment = $query->findOrFail($id);
        $this->guardAgainstRelatedRecords($visitTreatment);
        $snapshot = $this->auditSnapshot($visitTreatment);
        if ($this->supportsTreatmentImagesTable()) {
            foreach ($visitTreatment->treatmentImages as $image) {
                $path = trim((string) $image->path);
                if ($path !== '') {
                    $this->deleteFileUseCase->execute($path);
                }
            }
        }
        $visitTreatment->forceDelete();
        $this->recordVisitTreatmentActivity(
            event: 'force_deleted',
            visitTreatment: $visitTreatment,
            beforeSnapshot: $snapshot,
        );
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

    private function extractCorrectionReason(array &$data): ?string
    {
        if (!array_key_exists('correction_reason', $data)) {
            return null;
        }

        $reason = trim((string) ($data['correction_reason'] ?? ''));
        unset($data['correction_reason']);

        return $reason !== '' ? $reason : null;
    }

    private function extractTreatmentImagesData(array &$data): ?array
    {
        if (!$this->supportsTreatmentImagesTable()) {
            unset($data['treatment_images'], $data['retained_treatment_image_ids']);

            return null;
        }

        if (!array_key_exists('treatment_images', $data)) {
            return null;
        }

        $treatmentImagesData = is_array($data['treatment_images'])
            ? array_values(array_filter(
                $data['treatment_images'],
                static fn (mixed $file): bool => $file instanceof UploadedFile
            ))
            : [];
        unset($data['treatment_images']);

        return $treatmentImagesData;
    }

    private function extractRetainedTreatmentImageIds(array &$data): ?array
    {
        if (!$this->supportsTreatmentImagesTable()) {
            unset($data['retained_treatment_image_ids']);

            return null;
        }

        if (!array_key_exists('retained_treatment_image_ids', $data)) {
            return null;
        }

        $retainedTreatmentImageIds = is_array($data['retained_treatment_image_ids'])
            ? array_values(array_filter(
                array_map(static fn (mixed $id): int => (int) $id, $data['retained_treatment_image_ids']),
                static fn (int $id): bool => $id > 0
            ))
            : [];
        unset($data['retained_treatment_image_ids']);

        return $retainedTreatmentImageIds;
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

    private function syncTreatmentImages(
        VisitTreatment $visitTreatment,
        ?array $treatmentImagesData,
        ?array $retainedTreatmentImageIds = null
    ): void
    {
        if (!$this->supportsTreatmentImagesTable()) {
            return;
        }

        if ($retainedTreatmentImageIds !== null) {
            $imagesToDelete = $visitTreatment->treatmentImages()
                ->when(
                    $retainedTreatmentImageIds !== [],
                    static fn ($query) => $query->whereNotIn('id', $retainedTreatmentImageIds),
                    static fn ($query) => $query
                )
                ->get();

            foreach ($imagesToDelete as $image) {
                $path = trim((string) $image->path);
                if ($path !== '') {
                    $this->deleteFileUseCase->execute($path);
                }

                $image->delete();
            }
        }

        if ($treatmentImagesData === null || $treatmentImagesData === []) {
            if (!$visitTreatment->treatmentImages()->exists()) {
                $visitTreatment->forceFill([
                    'image_modality' => null,
                    'image_source' => null,
                ])->save();
            }

            return;
        }

        $actorId = auth()->id() ?: ($visitTreatment->updated_by ?? $visitTreatment->created_by);
        $stampCreatedBy = $visitTreatment->created_by;
        $stampUpdatedBy = $visitTreatment->updated_by;

        $rowsToCreate = array_map(function (UploadedFile $uploadedFile) use ($actorId, $stampCreatedBy, $stampUpdatedBy): array {
            $fileUpload = $this->fileUploadUseCase->execute(
                $uploadedFile,
                self::FILE_UPLOAD_MODULE,
                $actorId !== null ? (int) $actorId : null
            );

            return [
                'path' => $fileUpload->path,
                'original_name' => $uploadedFile->getClientOriginalName(),
                'mime_type' => $uploadedFile->getMimeType(),
                'size' => $uploadedFile->getSize(),
                'created_by' => $stampCreatedBy,
                'updated_by' => $stampUpdatedBy,
                'deleted_by' => null,
            ];
        }, $treatmentImagesData);

        if ($rowsToCreate !== []) {
            $visitTreatment->treatmentImages()->createMany($rowsToCreate);
        }

        if (!$visitTreatment->treatmentImages()->exists()) {
            $visitTreatment->forceFill([
                'image_modality' => null,
                'image_source' => null,
            ])->save();
        }
    }

    private function supportsImagingColumns(): bool
    {
        return Schema::hasColumns('visit_treatments', ['image_modality', 'image_source']);
    }

    private function supportsTreatmentImagesTable(): bool
    {
        return Schema::hasTable('visit_treatment_images');
    }

    private function stripUnsupportedImagingData(array $data): array
    {
        if (!$this->supportsImagingColumns()) {
            unset($data['image_modality'], $data['image_source']);
        }

        if (!$this->supportsTreatmentImagesTable()) {
            unset($data['treatment_images']);
        }

        return $data;
    }

    private function freshRelations(): array
    {
        $relations = ['materialItems', 'prescription.items'];

        if ($this->supportsTreatmentImagesTable()) {
            $relations[] = 'treatmentImages';
        }

        return $relations;
    }

    private function findForAudit(int $id): VisitTreatment
    {
        $query = VisitTreatment::query()->with(['materialItems', 'prescription.items']);

        if ($this->supportsTreatmentImagesTable()) {
            $query->with('treatmentImages');
        }

        return $query->findOrFail($id);
    }

    /**
     * @return array<string, mixed>
     */
    private function auditSnapshot(VisitTreatment $visitTreatment): array
    {
        $visitTreatment->loadMissing(['materialItems', 'prescription.items']);
        if ($this->supportsTreatmentImagesTable()) {
            $visitTreatment->loadMissing('treatmentImages');
        }

        $prescriptionItems = $visitTreatment->prescription?->items
            ? $visitTreatment->prescription->items
                ->map(static fn (PrescriptionItem $item): array => [
                    'amount' => (string) ($item->amount ?? ''),
                    'foodTiming' => (string) ($item->food_timing ?? ''),
                    'frequency' => (string) ($item->frequency ?? ''),
                    'name' => (string) ($item->name ?? ''),
                    'unit' => (string) ($item->unit ?? ''),
                ])
                ->values()
                ->all()
            : [];

        $materialItems = $visitTreatment->materialItems
            ->map(static fn (VisitTreatmentMaterial $item): array => [
                'inventoryItemId' => (int) ($item->inventory_item_id ?? 0),
                'itemName' => (string) ($item->item_name ?? ''),
                'quantityUsed' => (int) ($item->quantity_used ?? 0),
                'unit' => (string) ($item->unit ?? ''),
            ])
            ->values()
            ->all();

        $treatmentImages = $this->supportsTreatmentImagesTable()
            ? $visitTreatment->treatmentImages
                ->map(static fn (VisitTreatmentImage $image): array => [
                    'id' => (int) $image->id,
                    'originalName' => (string) ($image->original_name ?? ''),
                    'path' => (string) ($image->path ?? ''),
                    'size' => (int) ($image->size ?? 0),
                ])
                ->values()
                ->all()
            : [];

        return [
            'dentistId' => $visitTreatment->dentist_id !== null ? (int) $visitTreatment->dentist_id : null,
            'imageModality' => $visitTreatment->image_modality,
            'imageSource' => $visitTreatment->image_source,
            'material' => (string) ($visitTreatment->material ?? ''),
            'materialItems' => $materialItems,
            'notes' => (string) ($visitTreatment->notes ?? ''),
            'prescriptionContent' => (string) ($visitTreatment->prescription?->content ?? ''),
            'prescriptionItems' => $prescriptionItems,
            'price' => (string) ($visitTreatment->price ?? ''),
            'toothId' => $visitTreatment->tooth_id !== null ? (int) $visitTreatment->tooth_id : null,
            'toothNumber' => (string) ($visitTreatment->tooth_number ?? ''),
            'treatmentId' => (int) ($visitTreatment->treatment_id ?? 0),
            'treatmentImages' => $treatmentImages,
            'visitId' => (int) ($visitTreatment->visit_id ?? 0),
        ];
    }

    /**
     * @param array<string, mixed>|null $beforeSnapshot
     * @param array<string, mixed>|null $afterSnapshot
     * @return array<int, array<string, string>>
     */
    private function auditDiff(?array $beforeSnapshot, ?array $afterSnapshot): array
    {
        if ($beforeSnapshot === null || $afterSnapshot === null) {
            return [];
        }

        $labels = [
            'dentistId' => 'Dentist',
            'imageModality' => 'Image modality',
            'imageSource' => 'Image source',
            'material' => 'Material summary',
            'materialItems' => 'Material items',
            'notes' => 'Notes',
            'prescriptionContent' => 'Prescription summary',
            'prescriptionItems' => 'Prescription items',
            'price' => 'Price',
            'toothId' => 'Tooth',
            'toothNumber' => 'Tooth number',
            'treatmentId' => 'Treatment',
            'treatmentImages' => 'Treatment images',
            'visitId' => 'Visit',
        ];

        $diff = [];
        foreach ($labels as $field => $label) {
            $before = $beforeSnapshot[$field] ?? null;
            $after = $afterSnapshot[$field] ?? null;
            if ($before === $after) {
                continue;
            }

            $diff[] = [
                'after' => $this->stringifyAuditValue($after),
                'before' => $this->stringifyAuditValue($before),
                'field' => $field,
                'label' => $label,
            ];
        }

        return $diff;
    }

    private function stringifyAuditValue(mixed $value): string
    {
        if ($value === null) {
            return '-';
        }

        if (is_scalar($value)) {
            $stringValue = trim((string) $value);

            return $stringValue !== '' ? $stringValue : '-';
        }

        if (is_array($value)) {
            if ($value === []) {
                return '-';
            }

            return (string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }

        return trim((string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    /**
     * @param array<string, mixed>|null $beforeSnapshot
     * @param array<string, mixed>|null $afterSnapshot
     */
    private function recordVisitTreatmentActivity(
        string $event,
        VisitTreatment $visitTreatment,
        ?array $beforeSnapshot = null,
        ?array $afterSnapshot = null,
        ?string $reason = null,
    ): void
    {
        $diff = $this->auditDiff($beforeSnapshot, $afterSnapshot);
        if ($event === 'corrected' && $diff === [] && $reason === null) {
            return;
        }

        $actorId = $visitTreatment->updated_by ?? $visitTreatment->created_by;
        $description = match ($event) {
            'corrected' => 'VisitTreatment corrected',
            'deleted' => 'VisitTreatment deleted',
            'force_deleted' => 'VisitTreatment permanently deleted',
            default => 'VisitTreatment created',
        };

        DB::table(config('activitylog.table_name'))->insert([
            'log_name' => class_basename(VisitTreatment::class),
            'description' => $description,
            'subject_type' => VisitTreatment::class,
            'subject_id' => (int) $visitTreatment->id,
            'event' => $event,
            'causer_type' => $actorId ? User::class : null,
            'causer_id' => $actorId ?: null,
            'properties' => json_encode(array_filter([
                'after' => $afterSnapshot,
                'before' => $beforeSnapshot,
                'correctionReason' => $reason,
                'diff' => $diff,
            ], static fn (mixed $value): bool => $value !== null && $value !== []), JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
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
