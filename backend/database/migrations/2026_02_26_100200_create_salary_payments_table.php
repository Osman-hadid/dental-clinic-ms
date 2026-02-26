<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->string('salary_month', 7);
            $table->date('payment_date');
            $table->decimal('gross_amount', 14, 2);
            $table->decimal('bonus_amount', 14, 2)->default(0);
            $table->decimal('deduction_amount', 14, 2)->default(0);
            $table->decimal('net_amount', 14, 2);
            $table->enum('status', ['pending', 'paid', 'partial'])->default('pending');
            $table->boolean('paid_from_safe')->default(true);
            $table->string('notes', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['salary_month', 'status'], 'salary_payments_month_status_idx');
            $table->index(['staff_id', 'payment_date'], 'salary_payments_staff_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_payments');
    }
};

