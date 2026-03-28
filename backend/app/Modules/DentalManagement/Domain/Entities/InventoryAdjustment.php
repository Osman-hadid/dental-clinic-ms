<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

final class InventoryAdjustment extends Model
{
    use HasUserStamps;
    use LogsActivity;

    protected $fillable = [
        'inventory_item_id',
        'adjustment_type',
        'quantity',
        'unit_cost_snapshot',
        'total_cost_impact',
        'adjustment_date',
        'notes',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'inventory_item_id' => 'integer',
            'quantity' => 'integer',
            'unit_cost_snapshot' => 'decimal:2',
            'total_cost_impact' => 'decimal:2',
            'adjustment_date' => 'date:Y-m-d',
            'created_by' => 'integer',
            'updated_by' => 'integer',
            'deleted_by' => 'integer',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName(class_basename($this))
            ->setDescriptionForEvent(fn (string $eventName): string => "InventoryAdjustment {$eventName}");
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
