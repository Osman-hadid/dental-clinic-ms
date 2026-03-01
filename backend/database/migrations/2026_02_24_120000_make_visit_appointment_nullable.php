<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visits', function (Blueprint $table): void {
            $table->dropForeign(['appointment_id']);
        });

        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE visits ALTER COLUMN appointment_id DROP NOT NULL');
        } elseif ($driver === 'mysql') {
            DB::statement('ALTER TABLE visits MODIFY appointment_id BIGINT UNSIGNED NULL');
        }

        Schema::table('visits', function (Blueprint $table): void {
            $table->foreign('appointment_id')
                ->references('id')
                ->on('appointments')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('visits', function (Blueprint $table): void {
            $table->dropForeign(['appointment_id']);
        });

        $this->backfillNullVisitAppointmentIds();

        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE visits ALTER COLUMN appointment_id SET NOT NULL');
        } elseif ($driver === 'mysql') {
            DB::statement('ALTER TABLE visits MODIFY appointment_id BIGINT UNSIGNED NOT NULL');
        }

        Schema::table('visits', function (Blueprint $table): void {
            $table->foreign('appointment_id')
                ->references('id')
                ->on('appointments')
                ->cascadeOnDelete();
        });
    }

    private function backfillNullVisitAppointmentIds(): void
    {
        $nullVisits = DB::table('visits')
            ->select(['id', 'patient_id', 'dentist_id', 'visit_date'])
            ->whereNull('appointment_id')
            ->orderBy('id')
            ->get();

        if ($nullVisits->isEmpty()) {
            return;
        }

        $appointmentByKey = [];
        $timestamp = now();

        foreach ($nullVisits as $visit) {
            $cacheKey = "{$visit->patient_id}:{$visit->dentist_id}:{$visit->visit_date}";

            if (!isset($appointmentByKey[$cacheKey])) {
                $existingAppointmentId = DB::table('appointments')
                    ->where('patient_id', $visit->patient_id)
                    ->where('dentist_id', $visit->dentist_id)
                    ->where('appointment_date', $visit->visit_date)
                    ->orderBy('id')
                    ->value('id');

                if ($existingAppointmentId !== null) {
                    $appointmentByKey[$cacheKey] = (int) $existingAppointmentId;
                } else {
                    $appointmentByKey[$cacheKey] = (int) DB::table('appointments')->insertGetId([
                        'patient_id' => $visit->patient_id,
                        'dentist_id' => $visit->dentist_id,
                        'appointment_date' => $visit->visit_date,
                        'start_time' => '00:00:00',
                        'end_time' => null,
                        'status' => 'completed',
                        'notes' => 'Auto-created during rollback of visit appointment nullability migration.',
                        'created_by' => null,
                        'updated_by' => null,
                        'deleted_by' => null,
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ]);
                }
            }

            DB::table('visits')
                ->where('id', $visit->id)
                ->update(['appointment_id' => $appointmentByKey[$cacheKey]]);
        }
    }
};
