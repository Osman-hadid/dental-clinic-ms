<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Application\DTOs\InvoiceData;
use App\Modules\DentalManagement\Application\UseCases\Invoice\BulkDeleteInvoicesUseCase;
use App\Modules\DentalManagement\Application\UseCases\Invoice\CreateInvoiceUseCase;
use App\Modules\DentalManagement\Application\UseCases\Invoice\DeleteInvoiceUseCase;
use App\Modules\DentalManagement\Application\UseCases\Invoice\ForceDeleteInvoiceUseCase;
use App\Modules\DentalManagement\Application\UseCases\Invoice\GetInvoiceUseCase;
use App\Modules\DentalManagement\Application\UseCases\Invoice\ListInvoicesUseCase;
use App\Modules\DentalManagement\Application\UseCases\Invoice\RestoreInvoiceUseCase;
use App\Modules\DentalManagement\Application\UseCases\Invoice\UpdateInvoiceUseCase;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Invoice\BulkDeleteInvoicesRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Invoice\ListInvoicesRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Invoice\StoreInvoiceRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Invoice\UpdateInvoiceRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\InvoiceResource;
use Illuminate\Http\JsonResponse;

final class InvoiceController extends BaseApiController
{
    public function __construct(
        private readonly ListInvoicesUseCase $listInvoicesUseCase,
        private readonly GetInvoiceUseCase $getInvoiceUseCase,
        private readonly RestoreInvoiceUseCase $restoreInvoiceUseCase,
        private readonly CreateInvoiceUseCase $createInvoiceUseCase,
        private readonly UpdateInvoiceUseCase $updateInvoiceUseCase,
        private readonly DeleteInvoiceUseCase $deleteInvoiceUseCase,
        private readonly ForceDeleteInvoiceUseCase $forceDeleteInvoiceUseCase,
        private readonly BulkDeleteInvoicesUseCase $bulkDeleteInvoicesUseCase,
    ) {}

    public function index(ListInvoicesRequest $listInvoicesRequest): JsonResponse
    {
        $this->authorize('viewAny', Invoice::class);

        $querySpecification = QuerySpecification::fromArray($listInvoicesRequest->validated());

        $lengthAwarePaginator = $this->listInvoicesUseCase->execute($querySpecification);

        $paginatedResource = new PaginatedResource($lengthAwarePaginator, InvoiceResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('DentalManagement::messages.invoices.fetched')
        );
    }

    public function store(StoreInvoiceRequest $storeInvoiceRequest): JsonResponse
    {
        $this->authorize('create', Invoice::class);

        $invoiceData = InvoiceData::fromArray($storeInvoiceRequest->validated());
        $invoice = $this->createInvoiceUseCase->execute(invoiceData: $invoiceData);

        return $this->successResponse(
            data: new InvoiceResource(resource: $invoice),
            message: __('DentalManagement::messages.invoice.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $invoice = $this->getInvoiceUseCase->execute($id);

        $this->authorize('view', $invoice);

        return $this->successResponse(
            data: new InvoiceResource(resource: $invoice),
            message: __('DentalManagement::messages.invoice.fetched')
        );
    }

    public function restore(int $id): JsonResponse
    {
        $invoice = $this->restoreInvoiceUseCase->execute($id);

        $this->authorize('restore', $invoice);

        return $this->successResponse(
            data: new InvoiceResource(resource: $invoice),
            message: __('DentalManagement::messages.invoice.restored')
        );
    }

    public function update(UpdateInvoiceRequest $updateInvoiceRequest, int $id): JsonResponse
    {
        $invoiceData = InvoiceData::fromArray($updateInvoiceRequest->validated());
        $invoice = $this->updateInvoiceUseCase->execute(id: $id, invoiceData: $invoiceData);

        $this->authorize('update', $invoice);

        return $this->successResponse(
            data: new InvoiceResource(resource: $invoice),
            message: __('DentalManagement::messages.invoice.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', Invoice::class);

        $this->deleteInvoiceUseCase->execute(id: $id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.invoice.deleted')
        );
    }

    public function forceDelete(int $id): JsonResponse
    {
        $this->authorize('forceDelete', Invoice::class);

        $this->forceDeleteInvoiceUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.invoice.force_deleted')
        );
    }

    public function bulkDelete(BulkDeleteInvoicesRequest $bulkDeleteInvoicesRequest): JsonResponse
    {
        $this->authorize('bulkDelete', Invoice::class);

        $result = $this->bulkDeleteInvoicesUseCase->execute($bulkDeleteInvoicesRequest->validated('ids'));

        $message = __('DentalManagement::messages.invoices.bulk_deleted');
        if ($result['skipped']) {
            $message .= ' '.__('DentalManagement::messages.invoices.bulk_skipped');
        }

        return $this->successResponse(
            data: $result,
            message: $message
        );
    }
}
