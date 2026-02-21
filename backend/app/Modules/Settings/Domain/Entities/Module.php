<?php

declare(strict_types=1);

namespace App\Modules\Settings\Domain\Entities;

use App\Modules\UserManagement\Domain\Entities\Permission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

final class Module extends Model
{
    use LogsActivity;

    protected $fillable = [
        'name_en',
        'name_ps',
        'name_dr',
        'url',
        'description',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    public function prunable()
    {
        return self::onlyTrashed()
            ->where('deleted_at', '<', now()->subMonths(6));
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName(class_basename($this))
            ->setDescriptionForEvent(fn (string $eventName): string => "Module {$eventName}");
    }

    public function permissions(): HasMany
    {
        return $this->hasMany(Permission::class);
    }
}
