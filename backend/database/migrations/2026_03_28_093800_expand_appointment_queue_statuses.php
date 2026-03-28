<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const NEW_STATUSES = [
        'scheduled',
        'checked_in',
        'waiting',
        'in_chair',
        'completed',
        'cancelled',
    ];

    private const LEGACY_STATUSES = [
        'scheduled',
        'completed',
        'cancelled',
    ];

    public function up(): void
    {
        if (!Schema::hasTable('appointments')) {
            return;
        }

        $this->applyStatuses(self::NEW_STATUSES);
    }

    public function down(): void
    {
        if (!Schema::hasTable('appointments')) {
            return;
        }

        DB::table('appointments')
            ->whereIn('status', ['checked_in', 'waiting', 'in_chair'])
            ->update(['status' => 'scheduled']);

        $this->applyStatuses(self::LEGACY_STATUSES);
    }

    /**
     * @param array<int, string> $statuses
     */
    private function applyStatuses(array $statuses): void
    {
        $quotedStatuses = implode(', ', array_map(static fn (string $status): string => "'{$status}'", $statuses));
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check');
            DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ({$quotedStatuses}))");

            return;
        }

        if ($driver === 'mysql') {
            DB::statement(sprintf(
                'ALTER TABLE appointments MODIFY status ENUM(%s) NOT NULL DEFAULT \'scheduled\'',
                $quotedStatuses
            ));
        }
    }
};
