<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class InventoryItem extends Model
{
    use HasUserStamps;
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'acquisition_source',
        'entry_date',
        'item_name',
        'category',
        'quantity',
        'unit',
        'min_stock',
        'unit_cost',
        'total_cost',
        'supplier',
        'lot_number',
        'expiry_date',
        'location',
        'notes',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date:Y-m-d',
            'expiry_date' => 'date:Y-m-d',
            'quantity' => 'integer',
            'min_stock' => 'integer',
            'unit_cost' => 'decimal:2',
            'total_cost' => 'decimal:2',
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
            ->setDescriptionForEvent(fn (string $eventName): string => "InventoryItem {$eventName}");
    }

    public function visitTreatmentMaterials(): HasMany
    {
        return $this->hasMany(VisitTreatmentMaterial::class);
    }
}