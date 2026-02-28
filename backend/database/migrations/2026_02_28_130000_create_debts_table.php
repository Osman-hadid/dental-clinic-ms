<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('debts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('invoice_id')->unique()->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('patient_id')->nullable()->constrained('patients')->nullOnDelete();
            $table->date('invoice_date')->nullable();
            $table->decimal('net_amount', 14, 2)->default(0);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->decimal('debt_amount', 14, 2)->default(0);
            $table->string('status', 20)->default('open');
            $table->string('currency', 3)->default('AFN');
            $table->timestamps();

            $table->index(['status', 'invoice_date']);
            $table->index(['patient_id', 'status']);
        });

        DB::table('invoices')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->chunkById(200, function ($invoices): void {
                $invoiceIds = $invoices->pluck('id')->all();
                $paidByInvoice = DB::table('payments')
                    ->selectRaw('invoice_id, COALESCE(SUM(COALESCE(amount_input, amount)), 0) as paid_amount')
                    ->whereIn('invoice_id', $invoiceIds)
                    ->whereNull('deleted_at')
                    ->groupBy('invoice_id')
                    ->pluck('paid_amount', 'invoice_id');

                foreach ($invoices as $invoice) {
                    $netAmount = round((float) ($invoice->net_amount_input ?? $invoice->net_amount ?? 0), 2);
                    $paidAmount = round((float) ($paidByInvoice[$invoice->id] ?? 0), 2);
                    $status = strtolower((string) ($invoice->status ?? 'unpaid'));
                    $debtAmount = max(0, round($netAmount - $paidAmount, 2));

                    $debtStatus = 'open';
                    if ($status === 'cancelled') {
                        $debtAmount = 0;
                        $debtStatus = 'cancelled';
                    } elseif ($debtAmount <= 0.01) {
                        $debtAmount = 0;
                        $debtStatus = 'paid';
                    }

                    DB::table('debts')->updateOrInsert(
                        ['invoice_id' => $invoice->id],
                        [
                            'patient_id' => $invoice->patient_id,
                            'invoice_date' => $invoice->invoice_date,
                            'net_amount' => $netAmount,
                            'paid_amount' => $paidAmount,
                            'debt_amount' => $debtAmount,
                            'status' => $debtStatus,
                            'currency' => 'AFN',
                            'updated_at' => now(),
                            'created_at' => now(),
                        ]
                    );
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('debts');
    }
};
