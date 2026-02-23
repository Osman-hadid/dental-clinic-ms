<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Repositories\PaymentRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

final readonly class PaymentService
{
    public function __construct(private PaymentRepositoryInterface $paymentRepository) {}

    public function listPayments(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->paymentRepository->paginate($querySpecification);
    }

    public function getPayment(int $id): Payment
    {
        return $this->paymentRepository->find(id: $id);
    }

    public function createPayment(array $data): Payment
    {
        return DB::transaction(function () use ($data): Payment {
            $invoiceId = (int) ($data['invoice_id'] ?? 0);
            $amount = round((float) ($data['amount'] ?? 0), 2);

            $this->assertPaymentCanBeApplied($invoiceId, $amount);
            $payment = $this->paymentRepository->create(data: [...$data, 'amount' => $amount]);

            $this->syncInvoicePaymentStatus($invoiceId);
            $this->paymentRepository->invalidateCache();

            return $payment;
        });
    }

    public function updatePayment(int $id, array $data): Payment
    {
        return DB::transaction(function () use ($id, $data): Payment {
            $existing = $this->paymentRepository->find($id);

            $previousInvoiceId = (int) $existing->invoice_id;
            $invoiceId = (int) ($data['invoice_id'] ?? $previousInvoiceId);
            $amount = round((float) ($data['amount'] ?? $existing->amount), 2);

            $this->assertPaymentCanBeApplied($invoiceId, $amount, $id);

            $payment = $this->paymentRepository->update(id: $id, data: [...$data, 'amount' => $amount]);

            $this->syncInvoicePaymentStatus($invoiceId);
            if ($previousInvoiceId !== $invoiceId) {
                $this->syncInvoicePaymentStatus($previousInvoiceId);
            }

            $this->paymentRepository->invalidateCache();

            return $payment;
        });
    }

    public function deletePayment(int $id): void
    {
        DB::transaction(function () use ($id): void {
            $payment = $this->paymentRepository->find($id);
            $invoiceId = (int) $payment->invoice_id;

            $this->paymentRepository->delete(id: $id);
            $this->syncInvoicePaymentStatus($invoiceId);
            $this->paymentRepository->invalidateCache();
        });
    }

    public function forceDeletePayment(int $id): void
    {
        DB::transaction(function () use ($id): void {
            $payment = $this->paymentRepository->findTrashed($id) ?? $this->paymentRepository->find($id);
            $invoiceId = (int) $payment->invoice_id;

            $this->paymentRepository->forceDelete($payment->id);
            $this->syncInvoicePaymentStatus($invoiceId);
            $this->paymentRepository->invalidateCache();
        });
    }

    public function bulkDeletePayments(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $payment = $this->paymentRepository->find($id);

            if (method_exists($payment, 'hasRelatedRecords') && $payment->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->paymentRepository->delete(id: $id);
            $this->syncInvoicePaymentStatus((int) $payment->invoice_id);
            $deleted[] = $id;
        }

        $this->paymentRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }

    public function restorePayment(int $id): Payment
    {
        return DB::transaction(function () use ($id): Payment {
            $payment = $this->paymentRepository->restore($id);

            $this->assertPaymentCanBeApplied(
                invoiceId: (int) $payment->invoice_id,
                amount: round((float) $payment->amount, 2),
                ignorePaymentId: $payment->id,
            );

            $this->syncInvoicePaymentStatus((int) $payment->invoice_id);
            $this->paymentRepository->invalidateCache();

            return $payment;
        });
    }

    private function assertPaymentCanBeApplied(int $invoiceId, float $amount, ?int $ignorePaymentId = null): void
    {
        if ($amount <= 0) {
            throw new ApiException(
                errorCode: 'INVALID_PAYMENT_AMOUNT',
                message: 'Payment amount must be greater than zero.',
                httpCode: 422,
            );
        }

        $invoice = Invoice::query()->find($invoiceId);
        if (!$invoice) {
            throw new ApiException(
                errorCode: 'INVOICE_NOT_FOUND',
                message: 'Invoice not found.',
                httpCode: 404,
            );
        }

        if ($invoice->status === 'cancelled') {
            throw new ApiException(
                errorCode: 'INVOICE_CANCELLED',
                message: 'Payments cannot be applied to a cancelled invoice.',
                httpCode: 422,
            );
        }

        $alreadyPaid = (float) Payment::query()
            ->where('invoice_id', $invoiceId)
            ->when($ignorePaymentId !== null, fn ($query) => $query->where('id', '!=', $ignorePaymentId))
            ->sum('amount');

        $remaining = round((float) $invoice->net_amount - $alreadyPaid, 2);

        if ($amount - $remaining > 0.01) {
            throw new ApiException(
                errorCode: 'PAYMENT_AMOUNT_EXCEEDS_INVOICE',
                message: 'Payment amount exceeds the outstanding invoice balance.',
                details: [
                    'invoiceId' => $invoiceId,
                    'outstandingBalance' => max(0, $remaining),
                    'requestedAmount' => $amount,
                ],
                httpCode: 422,
            );
        }
    }

    private function syncInvoicePaymentStatus(int $invoiceId): void
    {
        $invoice = Invoice::query()->find($invoiceId);
        if (!$invoice || $invoice->status === 'cancelled') {
            return;
        }

        $totalPaid = (float) Payment::query()
            ->where('invoice_id', $invoiceId)
            ->sum('amount');

        $netAmount = round((float) $invoice->net_amount, 2);

        $status = 'unpaid';
        if ($netAmount <= 0 || $totalPaid >= $netAmount) {
            $status = 'paid';
        } elseif ($totalPaid > 0) {
            $status = 'partially_paid';
        }

        if ($invoice->status !== $status) {
            $invoice->forceFill(['status' => $status])->save();
        }
    }
}
