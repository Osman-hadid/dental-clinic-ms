<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\DentalManagement\Domain\Entities\Debt;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use Illuminate\Support\Facades\DB;

final class DebtService
{
    public function syncByInvoiceId(int $invoiceId): void
    {
        $invoice = Invoice::query()->find($invoiceId);
        if ($invoice === null) {
            $this->deleteByInvoiceId($invoiceId);

            return;
        }

        $this->syncForInvoice($invoice);
    }

    public function syncForInvoice(Invoice $invoice): void
    {
        $netAmount = round((float) ($invoice->net_amount_input ?? $invoice->net_amount ?? 0), 2);
        $paidAmount = round((float) Payment::query()
            ->where('invoice_id', $invoice->id)
            ->select(DB::raw('COALESCE(SUM(COALESCE(amount_input, amount)), 0) as total_paid'))
            ->value('total_paid'), 2);

        $invoiceStatus = strtolower((string) ($invoice->status ?? 'unpaid'));
        $debtAmount = max(0, round($netAmount - $paidAmount, 2));

        $debtStatus = 'open';
        if ($invoiceStatus === 'cancelled') {
            $debtAmount = 0;
            $debtStatus = 'cancelled';
        } elseif ($debtAmount <= 0.01) {
            $debtAmount = 0;
            $debtStatus = 'paid';
        }

        Debt::query()->updateOrCreate(
            ['invoice_id' => $invoice->id],
            [
                'patient_id' => $invoice->patient_id,
                'invoice_date' => $invoice->invoice_date,
                'net_amount' => $netAmount,
                'paid_amount' => $paidAmount,
                'debt_amount' => $debtAmount,
                'status' => $debtStatus,
                'currency' => 'AFN',
            ]
        );
    }

    public function deleteByInvoiceId(int $invoiceId): void
    {
        Debt::query()->where('invoice_id', $invoiceId)->delete();
    }

    public function syncAll(): void
    {
        Invoice::query()
            ->select(['id'])
            ->orderBy('id')
            ->chunkById(200, function ($invoices): void {
                foreach ($invoices as $invoice) {
                    $this->syncByInvoiceId((int) $invoice->id);
                }
            });
    }
}
