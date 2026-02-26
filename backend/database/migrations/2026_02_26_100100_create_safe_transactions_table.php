<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('safe_transactions', function (Blueprint $table): void {
            $table->id();
            $table->date('transaction_date');
            $table->enum('entry_type', ['income', 'expense', 'salary', 'withdrawal', 'deposit', 'adjustment']);
            $table->enum('direction', ['in', 'out']);
            $table->decimal('amount', 14, 2);
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('source_type', 60)->nullable();
            $table->foreignId('picked_by_staff_id')->nullable()->constrained('staff')->nullOnDelete();
            $table->string('notes', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['transaction_date', 'direction'], 'safe_transactions_date_direction_idx');
            $table->index(['source_type', 'source_id'], 'safe_transactions_source_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('safe_transactions');
    }
};

