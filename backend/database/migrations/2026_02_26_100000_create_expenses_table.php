<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table): void {
            $table->id();
            $table->enum('expense_type', ['daily', 'clinical'])->default('daily');
            $table->string('title', 120);
            $table->string('category', 120)->default('Other');
            $table->decimal('amount', 14, 2);
            $table->date('expense_date');
            $table->string('payment_method', 40)->nullable();
            $table->string('vendor', 160)->nullable();
            $table->unsignedInteger('quantity')->nullable();
            $table->decimal('unit_cost', 14, 2)->nullable();
            $table->string('notes', 255)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('source_type', 60)->nullable();
            $table->foreignId('staff_id')->nullable()->constrained('staff')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['expense_date', 'expense_type'], 'expenses_date_type_idx');
            $table->index('category', 'expenses_category_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};

