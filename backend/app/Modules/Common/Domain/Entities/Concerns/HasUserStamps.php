<?php

declare(strict_types=1);

namespace App\Modules\Common\Domain\Entities\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

trait HasUserStamps
{
    /**
     * @var array<string, array{created_by: bool, updated_by: bool}>
     */
    private static array $userStampColumns = [];

    protected static function bootHasUserStamps(): void
    {
        static::creating(static function (Model $model): void {
            $userId = Auth::id();
            if ($userId === null) {
                return;
            }

            if (self::hasUserStampColumn($model, 'created_by')) {
                $model->setAttribute('created_by', $userId);
            }

            if (self::hasUserStampColumn($model, 'updated_by')) {
                $model->setAttribute('updated_by', $userId);
            }
        });

        static::updating(static function (Model $model): void {
            $userId = Auth::id();
            if ($userId === null) {
                return;
            }

            if (self::hasUserStampColumn($model, 'updated_by')) {
                $model->setAttribute('updated_by', $userId);
            }
        });
    }

    private static function hasUserStampColumn(Model $model, string $column): bool
    {
        $table = $model->getTable();

        if (!isset(self::$userStampColumns[$table])) {
            self::$userStampColumns[$table] = [
                'created_by' => self::safeHasColumn($model, 'created_by'),
                'updated_by' => self::safeHasColumn($model, 'updated_by'),
            ];
        }

        return self::$userStampColumns[$table][$column] ?? false;
    }

    private static function safeHasColumn(Model $model, string $column): bool
    {
        try {
            return Schema::hasColumn($model->getTable(), $column);
        } catch (\Throwable) {
            return false;
        }
    }
}
