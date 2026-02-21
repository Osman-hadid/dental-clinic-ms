<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Repositories\PaymentRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

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

    public function restorePayment(int $id): Payment
    {
        return tap(
            $this->paymentRepository->restore($id),
            fn () => $this->paymentRepository->invalidateCache()
        );
    }

    public function createPayment(array $data): Payment
    {
        return tap(
            $this->paymentRepository->create(data: $data),
            fn () => $this->paymentRepository->invalidateCache()
        );
    }

    public function updatePayment(int $id, array $data): Payment
    {
        return tap(
            $this->paymentRepository->update(id: $id, data: $data),
            fn () => $this->paymentRepository->invalidateCache()
        );
    }

    public function deletePayment(int $id): void
    {
        $this->paymentRepository->delete(id: $id);
        $this->paymentRepository->invalidateCache();
    }

    public function forceDeletePayment(int $id): void
    {
        $permission = $this->paymentRepository->findTrashed($id) ?? $this->paymentRepository->find($id);
        $this->paymentRepository->forceDelete($permission->id);
        $this->paymentRepository->invalidateCache();
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
            $deleted[] = $id;
        }

        $this->paymentRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }
}
