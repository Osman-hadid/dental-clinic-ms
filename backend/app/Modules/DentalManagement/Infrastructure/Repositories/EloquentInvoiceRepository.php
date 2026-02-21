<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Repositories\InvoiceRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Invoice\ListInvoicesRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentInvoiceRepository extends BaseEloquentRepository implements InvoiceRepositoryInterface
{
    protected string $model = Invoice::class;

    protected string $requestClass = ListInvoicesRequest::class;

    public function find(int $id): Invoice
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->findOrFail($id);
    }

    public function findTrashed(int $id): ?Invoice
    {
        return QueryBuilder::for($this->model)
            ->onlyTrashed()
            ->allowedFields($this->getAllowedFields())
            ->allowedIncludes($this->requestClass::getAllowedRelations())
            ->find($id);
    }

    public function create(array $data): Invoice
    {
        return Invoice::create(attributes: $data);
    }

    public function update(int $id, array $data): Invoice
    {
        $invoice = $this->find($id);
        $invoice->update(attributes: $data);

        return $invoice;
    }

    public function delete(int $id): void
    {
        $invoice = $this->find(id: $id);
        $this->guardAgainstRelatedRecords($invoice);
        $invoice->delete();
    }

    public function forceDelete(int $id): void
    {
        $invoice = Invoice::withTrashed()->findOrFail($id);
        $this->guardAgainstRelatedRecords($invoice);
        $invoice->forceDelete();
    }

    public function restore(int $id): Invoice
    {
        $invoice = Invoice::withTrashed()->findOrFail($id);
        $invoice->restore();

        return $invoice;
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

    private function guardAgainstRelatedRecords(Invoice $invoice): void
    {
        if (method_exists($invoice, 'hasRelatedRecords') && $invoice->hasRelatedRecords()) {
            throw new ApiException(
                errorCode: 'INVOICE_IN_USE',
                message: 'Cannot delete invoice because it has related records.',
                httpCode: 409
            );
        }
    }
}
