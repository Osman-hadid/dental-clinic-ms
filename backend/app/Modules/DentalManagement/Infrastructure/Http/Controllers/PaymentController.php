<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Application\DTOs\PaymentData;
use App\Modules\DentalManagement\Application\UseCases\Payment\BulkDeletePaymentsUseCase;
use App\Modules\DentalManagement\Application\UseCases\Payment\CreatePaymentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Payment\DeletePaymentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Payment\ForceDeletePaymentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Payment\GetPaymentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Payment\ListPaymentsUseCase;
use App\Modules\DentalManagement\Application\UseCases\Payment\RestorePaymentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Payment\UpdatePaymentUseCase;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Payment\BulkDeletePaymentsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Payment\ListPaymentsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Payment\StorePaymentRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Payment\UpdatePaymentRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\PaymentResource;
use Illuminate\Http\JsonResponse;

final class PaymentController extends BaseApiController
{
    public function __construct(
        private readonly ListPaymentsUseCase $listPaymentsUseCase,
        private readonly GetPaymentUseCase $getPaymentUseCase,
        private readonly RestorePaymentUseCase $restorePaymentUseCase,
        private readonly CreatePaymentUseCase $createPaymentUseCase,
        private readonly UpdatePaymentUseCase $updatePaymentUseCase,
        private readonly DeletePaymentUseCase $deletePaymentUseCase,
        private readonly ForceDeletePaymentUseCase $forceDeletePaymentUseCase,
        private readonly BulkDeletePaymentsUseCase $bulkDeletePaymentsUseCase,
    ) {}

    public function index(ListPaymentsRequest $listPaymentsRequest): JsonResponse
    {
        $this->authorize('viewAny', Payment::class);

        $querySpecification = QuerySpecification::fromArray($listPaymentsRequest->validated());

        $lengthAwarePaginator = $this->listPaymentsUseCase->execute($querySpecification);

        $paginatedResource = new PaginatedResource($lengthAwarePaginator, PaymentResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('DentalManagement::messages.payments.fetched')
        );
    }

    public function store(StorePaymentRequest $storePaymentRequest): JsonResponse
    {
        $this->authorize('create', Payment::class);

        $paymentData = PaymentData::fromArray($storePaymentRequest->validated());
        $payment = $this->createPaymentUseCase->execute(paymentData: $paymentData);

        return $this->successResponse(
            data: new PaymentResource(resource: $payment),
            message: __('DentalManagement::messages.payment.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $payment = $this->getPaymentUseCase->execute($id);

        $this->authorize('view', $payment);

        return $this->successResponse(
            data: new PaymentResource(resource: $payment),
            message: __('DentalManagement::messages.payment.fetched')
        );
    }

    public function restore(int $id): JsonResponse
    {
        $payment = $this->restorePaymentUseCase->execute($id);

        $this->authorize('restore', $payment);

        return $this->successResponse(
            data: new PaymentResource(resource: $payment),
            message: __('DentalManagement::messages.payment.restored')
        );
    }

    public function update(UpdatePaymentRequest $updatePaymentRequest, int $id): JsonResponse
    {
        $paymentData = PaymentData::fromArray($updatePaymentRequest->validated());
        $payment = $this->updatePaymentUseCase->execute(id: $id, paymentData: $paymentData);

        $this->authorize('update', $payment);

        return $this->successResponse(
            data: new PaymentResource(resource: $payment),
            message: __('DentalManagement::messages.payment.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', Payment::class);

        $this->deletePaymentUseCase->execute(id: $id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.payment.deleted')
        );
    }

    public function forceDelete(int $id): JsonResponse
    {
        $this->authorize('forceDelete', Payment::class);

        $this->forceDeletePaymentUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.payment.force_deleted')
        );
    }

    public function bulkDelete(BulkDeletePaymentsRequest $bulkDeletePaymentsRequest): JsonResponse
    {
        $this->authorize('bulkDelete', Payment::class);

        $result = $this->bulkDeletePaymentsUseCase->execute($bulkDeletePaymentsRequest->validated('ids'));

        $message = __('DentalManagement::messages.payments.bulk_deleted');
        if ($result['skipped']) {
            $message .= ' '.__('DentalManagement::messages.payments.bulk_skipped');
        }

        return $this->successResponse(
            data: $result,
            message: $message
        );
    }
}
