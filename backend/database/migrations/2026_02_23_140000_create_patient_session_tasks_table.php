<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_session_tasks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->string('title');
            $table->enum('mark', ['green', 'blue', 'yellow', 'orange', 'red', 'purple'])->default('blue');
            $table->enum('status', ['pending', 'in_progress', 'done'])->default('pending');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->index(['patient_id', 'status'], 'patient_session_tasks_patient_status_idx');
            $table->index('created_at', 'patient_session_tasks_created_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_session_tasks');
    }
};
