<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Entities\ImplantCompany;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\ImplantCompany\StoreImplantCompanyRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\ImplantCompanyResource;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ImplantCompanyController extends BaseApiController
{
    public function index(Request $request): JsonResponse
    {
        abort_unless(auth()->user()?->can('dental-management.view'), 403);

        $validated = $request->validate([
            'search' => 'nullable|string|max:160',
            'limit' => 'nullable|integer|min:1|max:200',
        ]);

        $query = ImplantCompany::query();

        $search = trim((string) ($validated['search'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('company_name', 'ilike', "%{$search}%")
                    ->orWhere('implant_type', 'ilike', "%{$search}%");
            });
        }

        $companies = $query
            ->orderBy('company_name')
            ->orderBy('implant_type')
            ->orderByDesc('record_date')
            ->limit((int) ($validated['limit'] ?? 200))
            ->get();

        return $this->successResponse(
            data: $companies->map(fn (ImplantCompany $company): array => (new ImplantCompanyResource($company))->toArray($request))->values()->all(),
            message: 'Implant company details fetched successfully.'
        );
    }

    public function store(StoreImplantCompanyRequest $request): JsonResponse
    {
        abort_unless(auth()->user()?->can('dental-management.view'), 403);

        $validated = $request->validated();
        $userId = $this->authenticatedUserId();

        $companyName = $validated['companyName'];
        $implantType = $validated['implantType'];
        $recordDate = $validated['recordDate'] ?? CarbonImmutable::now()->toDateString();
        $note = $validated['note'] ?? null;

        $company = ImplantCompany::query()->firstOrNew([
            'company_name' => $companyName,
            'implant_type' => $implantType,
        ]);

        if (!$company->exists) {
            $company->created_by = $userId;
        }

        $company->record_date = $recordDate;
        if ($note !== null) {
            $company->note = $note;
        }
        $company->updated_by = $userId;
        $company->save();

        return $this->successResponse(
            data: new ImplantCompanyResource($company->fresh()),
            message: 'Implant company details saved successfully.',
            code: $company->wasRecentlyCreated ? 201 : 200
        );
    }

    private function authenticatedUserId(): ?int
    {
        $userId = auth()->id();

        return $userId !== null ? (int) $userId : null;
    }
}
