<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dental_backup_schedules', function (Blueprint $table): void {
            $table->id();
            $table->string('frequency', 20)->default('none');
            $table->string('run_at_time', 5)->default('02:00');
            $table->unsignedTinyInteger('run_day_of_week')->nullable();
            $table->unsignedTinyInteger('run_day_of_month')->nullable();
            $table->unsignedTinyInteger('run_month')->nullable();
            $table->boolean('is_active')->default(false);
            $table->timestamp('last_run_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'frequency']);
        });

        Schema::create('dental_backups', function (Blueprint $table): void {
            $table->id();
            $table->string('mode', 20)->default('full');
            $table->string('frequency', 20)->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('status', 20)->default('completed');
            $table->string('file_path', 500)->nullable();
            $table->unsignedBigInteger('file_size_bytes')->nullable();
            $table->json('summary')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('triggered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['mode', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dental_backups');
        Schema::dropIfExists('dental_backup_schedules');
    }
};
