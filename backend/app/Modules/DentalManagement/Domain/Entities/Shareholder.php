<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class Shareholder extends Model
{
    use HasUserStamps;
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'full_name',
        'contact_number',
        'email',
        'address',
        'ownership_percentage',
        'initial_capital',
        'initial_capital_input',
        'currency',
        'exchange_rate',
        'joined_date',
        'status',
        'notes',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'ownership_percentage' => 'decimal:2',
            'initial_capital' => 'decimal:2',
            'initial_capital_input' => 'decimal:2',
            'exchange_rate' => 'decimal:6',
            'joined_date' => 'date:Y-m-d',
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
            ->setDescriptionForEvent(fn (string $eventName): string => "Shareholder {$eventName}");
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(ShareholderTransaction::class);
    }
}