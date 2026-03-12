<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class VisitTreatmentMaterial extends Model
{
    use HasUserStamps;
    protected $fillable = [
        'visit_treatment_id',
        'inventory_item_id',
        'item_name',
        'unit',
        'quantity_used',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'visit_treatment_id' => 'integer',
            'inventory_item_id' => 'integer',
            'quantity_used' => 'integer',
            'created_by' => 'integer',
            'updated_by' => 'integer',
            'deleted_by' => 'integer',
        ];
    }

    public function visitTreatment(): BelongsTo
    {
        return $this->belongsTo(VisitTreatment::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
