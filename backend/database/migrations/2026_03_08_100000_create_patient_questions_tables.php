<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_questions', function (Blueprint $table): void {
            $table->id();
            $table->text('question_text');
            $table->enum('answer_type', ['text', 'textarea', 'number', 'yes_no', 'date'])->default('text');
            $table->text('help_text')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['is_active', 'sort_order'], 'patient_questions_active_sort_idx');
        });

        Schema::create('patient_question_answers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('patient_question_id')->constrained('patient_questions')->cascadeOnDelete();
            $table->longText('answer')->nullable();
            $table->timestamps();

            $table->unique(['patient_id', 'patient_question_id'], 'patient_question_answers_unique');
            $table->index(['patient_id', 'patient_question_id'], 'patient_question_answers_patient_question_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_question_answers');
        Schema::dropIfExists('patient_questions');
    }
};
