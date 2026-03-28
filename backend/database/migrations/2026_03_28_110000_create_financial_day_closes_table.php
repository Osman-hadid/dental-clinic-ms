<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_day_closes', function (Blueprint $table): void {
            $table->id();
            $table->date('closing_date')->unique();
            $table->decimal('expected_balance', 14, 2)->default(0);
            $table->decimal('counted_balance', 14, 2)->default(0);
            $table->decimal('discrepancy_amount', 14, 2)->default(0);
            $table->decimal('payment_total', 14, 2)->default(0);
            $table->decimal('cash_payment_total', 14, 2)->default(0);
            $table->decimal('non_cash_payment_total', 14, 2)->default(0);
            $table->decimal('safe_in_total', 14, 2)->default(0);
            $table->decimal('safe_out_total', 14, 2)->default(0);
            $table->decimal('open_debt_total', 14, 2)->default(0);
            $table->unsignedInteger('open_debt_count')->default(0);
            $table->unsignedInteger('overdue_debt_count')->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->foreign('closed_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['closing_date', 'discrepancy_amount'], 'financial_day_closes_date_discrepancy_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_day_closes');
    }
};
