<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shareholder_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('shareholder_id')->constrained('shareholders')->cascadeOnDelete();
            $table->date('transaction_date');
            $table->enum('transaction_type', ['contribution', 'distribution']);
            $table->decimal('amount', 14, 2);
            $table->decimal('amount_input', 14, 2)->nullable();
            $table->string('currency', 3)->default('AFN');
            $table->decimal('exchange_rate', 14, 6)->default(1);
            $table->foreignId('safe_transaction_id')->nullable()->constrained('safe_transactions')->nullOnDelete();
            $table->string('notes', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique('safe_transaction_id', 'shareholder_transactions_safe_tx_unique');
            $table->index(['shareholder_id', 'transaction_date'], 'shareholder_transactions_shareholder_date_idx');
            $table->index(['transaction_type', 'transaction_date'], 'shareholder_transactions_type_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shareholder_transactions');
    }
};
