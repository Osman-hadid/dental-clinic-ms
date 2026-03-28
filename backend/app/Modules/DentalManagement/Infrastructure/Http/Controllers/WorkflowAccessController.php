<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Services\WorkflowAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WorkflowAccessController extends BaseApiController
{
    public function __construct(private readonly WorkflowAccessService $workflowAccessService) {}

    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('dental-management.view'), 403);

        return $this->successResponse(
            data: $this->workflowAccessService->summary($request->user()),
            message: 'Workflow access summary fetched successfully.'
        );
    }
}
