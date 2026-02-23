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
        Schema::table('appointments', function (Blueprint $table): void {
            $table->index(['dentist_id', 'appointment_date', 'start_time'], 'appointments_dentist_schedule_idx');
            $table->index(['patient_id', 'appointment_date'], 'appointments_patient_date_idx');
        });

        Schema::table('visits', function (Blueprint $table): void {
            $table->index(['patient_id', 'visit_date'], 'visits_patient_date_idx');
            $table->index(['dentist_id', 'visit_date'], 'visits_dentist_date_idx');
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->index(['patient_id', 'status'], 'invoices_patient_status_idx');
            $table->index(['visit_id'], 'invoices_visit_id_idx');
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->index(['invoice_id', 'payment_date'], 'payments_invoice_date_idx');
        });

        Schema::table('visit_treatments', function (Blueprint $table): void {
            $table->index(['visit_id', 'dentist_id'], 'visit_treatments_visit_dentist_idx');
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'appointments_time_window_chk'
    ) THEN
        ALTER TABLE appointments
        ADD CONSTRAINT appointments_time_window_chk
        CHECK (end_time IS NULL OR end_time > start_time);
    END IF;
END $$;
SQL);

        DB::unprepared(<<<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'invoices_amounts_chk'
    ) THEN
        ALTER TABLE invoices
        ADD CONSTRAINT invoices_amounts_chk
        CHECK (
            total_amount >= 0
            AND discount >= 0
            AND net_amount >= 0
            AND discount <= total_amount
            AND net_amount = total_amount - discount
        );
    END IF;
END $$;
SQL);

        DB::unprepared(<<<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payments_amount_positive_chk'
    ) THEN
        ALTER TABLE payments
        ADD CONSTRAINT payments_amount_positive_chk
        CHECK (amount > 0);
    END IF;
END $$;
SQL);

        DB::unprepared(<<<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'visit_treatments_price_non_negative_chk'
    ) THEN
        ALTER TABLE visit_treatments
        ADD CONSTRAINT visit_treatments_price_non_negative_chk
        CHECK (price >= 0);
    END IF;
END $$;
SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_time_window_chk');
            DB::statement('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_amounts_chk');
            DB::statement('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_positive_chk');
            DB::statement('ALTER TABLE visit_treatments DROP CONSTRAINT IF EXISTS visit_treatments_price_non_negative_chk');
        }

        Schema::table('visit_treatments', function (Blueprint $table): void {
            $table->dropIndex('visit_treatments_visit_dentist_idx');
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->dropIndex('payments_invoice_date_idx');
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropIndex('invoices_patient_status_idx');
            $table->dropIndex('invoices_visit_id_idx');
        });

        Schema::table('visits', function (Blueprint $table): void {
            $table->dropIndex('visits_patient_date_idx');
            $table->dropIndex('visits_dentist_date_idx');
        });

        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropIndex('appointments_dentist_schedule_idx');
            $table->dropIndex('appointments_patient_date_idx');
        });
    }
};
