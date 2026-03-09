<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_snapshot_schedules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('report_key', 100);
            $table->string('cadence', 20)->default('off');
            $table->json('filters')->nullable();
            $table->timestamp('last_run_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'report_key']);
            $table->index(['cadence', 'last_run_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_snapshot_schedules');
    }
};
