<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SORTABLE_COLUMNS = [
        'id',
        'payment_date',
        'amount',
        'created_at',
    ];

    private const FRONTEND_FILTERS = [
        'method' => ['cash', 'card', 'insurance'],
        'trashed' => ['with', 'only'],
    ];

    private const SEARCHABLE_COLUMNS = [
        'notes' => 'notes',
    ];

    private const FIELDABLE_COLUMNS = [
        'id' => 'id',
        'invoiceId' => 'invoice_id',
        'paymentDate' => 'payment_date',
        'amount' => 'amount',
        'method' => 'method',
        'notes' => 'notes',
        'createdBy' => 'created_by',
        'updatedBy' => 'updated_by',
        'deletedBy' => 'deleted_by',
        'createdAt' => 'created_at',
        'updatedAt' => 'updated_at',
        'deletedAt' => 'deleted_at',
    ];

    private const CAST_IDS = [
        'invoiceId',
        'createdBy',
        'updatedBy',
        'deletedBy',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->date('payment_date');
            $table->decimal('amount', 10, 2);
            $table->enum('method', ['cash', 'card', 'insurance']);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
