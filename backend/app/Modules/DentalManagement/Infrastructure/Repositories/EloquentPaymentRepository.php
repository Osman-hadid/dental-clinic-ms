<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Repositories\PaymentRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Payment\ListPaymentsRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentPaymentRepository extends BaseEloquentRepository implements PaymentRepositoryInterface
{
    protected string $model = Payment::class;

    protected string $requestClass = ListPaymentsRequest::class;

    public function find(int $id): Payment
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?Payment
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): Payment
    {
        return Payment::create(attributes: $data);
    }

    public function update(int $id, array $data): Payment
    {
        $payment = $this->find($id);
        $payment->update(attributes: $data);

        return $payment;
    }

    public function delete(int $id): void
    {
        $payment = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($payment);
        $payment->delete();
    }

    public function forceDelete(int $id): void
    {
        $payment = Payment::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($payment);
        $payment->forceDelete();
    }

    public function restore(int $id): Payment
    {
        $payment = Payment::withTrashed()->findOrFail($id);
        $payment->restore();

        return $payment;
    }

    private function getAllowedFields(): array
    {
        $fields = request()->input('fields');
        if (!$fields) {
            return [];
        }

        $allowed = array_keys($this->requestClass::getFieldableColumns());
        $requested = array_filter(explode(',', (string) $fields));

        return array_intersect($requested, $allowed);
    }

    private function guardAgainstRelatedRecords(Payment $payment): void
    {
        if (method_exists($payment, 'hasRelatedRecords') && $payment->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'PAYMENT_IN_USE',
                message: 'Cannot delete payment because it has related records.',
                httpCode: 409
            );
        }
    }
}
