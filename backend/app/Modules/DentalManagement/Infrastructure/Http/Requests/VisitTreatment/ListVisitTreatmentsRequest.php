<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Illuminate\Support\Facades\Schema;
use Spatie\QueryBuilder\AllowedFilter;

final class ListVisitTreatmentsRequest extends BaseListRequest
{
    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();

        if (Schema::hasTable('visit_treatment_images')) {
            return;
        }

        $includes = $this->input('include', []);
        if (!is_array($includes)) {
            return;
        }

        $filteredIncludes = array_values(array_filter(
            $includes,
            static fn (mixed $include): bool => $include !== 'treatmentImages'
        ));

        $this->merge(['include' => $filteredIncludes]);
    }

    protected static function sortableColumns(): array
    {
        return [
            'id',
            'price',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'visit',
            'treatment',
            'tooth',
            'dentist',
            'prescription',
            'prescription.items',
            'materialItems',
            'materialItems.inventoryItem',
            'treatmentImages',
            'activityLogs',
            'activityLogs.causer',
        ];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::callback('dateFrom', static function ($query, $value): void {
                $resolved = \is_array($value) ? ($value[0] ?? null) : $value;
                if ($resolved === null || $resolved === '') {
                    return;
                }

                $query->whereHas('visit', static function ($visitQuery) use ($resolved): void {
                    $visitQuery->where('visit_date', '>=', (string) $resolved);
                });
            }),
            AllowedFilter::callback('dateTo', static function ($query, $value): void {
                $resolved = \is_array($value) ? ($value[0] ?? null) : $value;
                if ($resolved === null || $resolved === '') {
                    return;
                }

                $query->whereHas('visit', static function ($visitQuery) use ($resolved): void {
                    $visitQuery->where('visit_date', '<=', (string) $resolved);
                });
            }),
            AllowedFilter::exact('visitId', 'visit_id', true),
            AllowedFilter::exact('treatmentId', 'treatment_id', true),
            AllowedFilter::exact('toothId', 'tooth_id', true),
            AllowedFilter::exact('dentistId', 'dentist_id', true),
            AllowedFilter::trashed(),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'material' => 'material',
            'notes' => 'notes',
            'toothNumber' => 'tooth_number',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'visitId' => 'visit_id',
            'treatmentId' => 'treatment_id',
            'toothId' => 'tooth_id',
            'toothNumber' => 'tooth_number',
            'dentistId' => 'dentist_id',
            'price' => 'price',
            'material' => 'material',
            'imageModality' => 'image_modality',
            'imageSource' => 'image_source',
            'notes' => 'notes',
            'createdBy' => 'created_by',
            'updatedBy' => 'updated_by',
            'deletedBy' => 'deleted_by',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
