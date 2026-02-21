<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SORTABLE_COLUMNS = [
        'id',
        'invoice_date',
        'net_amount',
        'status',
        'created_at',
    ];

    private const FRONTEND_FILTERS = [
        'status' => ['unpaid', 'partially_paid', 'paid', 'cancelled'],
        'trashed' => ['with', 'only'],
    ];

    private const SEARCHABLE_COLUMNS = [
        'notes' => 'notes',
    ];

    private const FIELDABLE_COLUMNS = [
        'id' => 'id',
        'patientId' => 'patient_id',
        'visitId' => 'visit_id',
        'totalAmount' => 'total_amount',
        'discount' => 'discount',
        'netAmount' => 'net_amount',
        'invoiceDate' => 'invoice_date',
        'status' => 'status',
        'notes' => 'notes',
        'createdBy' => 'created_by',
        'updatedBy' => 'updated_by',
        'deletedBy' => 'deleted_by',
        'createdAt' => 'created_at',
        'updatedAt' => 'updated_at',
        'deletedAt' => 'deleted_at',
    ];

    private const CAST_IDS = [
        'patientId',
        'visitId',
        'createdBy',
        'updatedBy',
        'deletedBy',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients');
            $table->foreignId('visit_id')->constrained('visits');
            $table->decimal('total_amount', 10, 2);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('net_amount', 10, 2);
            $table->date('invoice_date');
            $table->enum('status', ['unpaid', 'partially_paid', 'paid', 'cancelled'])->default('unpaid');
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
        Schema::dropIfExists('invoices');
    }
};
