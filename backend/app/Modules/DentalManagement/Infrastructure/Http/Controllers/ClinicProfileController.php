<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\UseCases\DeleteFileUseCase;
use App\Modules\Common\Application\UseCases\FileUploadUseCase;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Entities\ClinicProfile;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\ClinicProfile\UpdateClinicProfileRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\ClinicProfileResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

final class ClinicProfileController extends BaseApiController
{
    public function __construct(
        private readonly FileUploadUseCase $fileUploadUseCase,
        private readonly DeleteFileUseCase $deleteFileUseCase,
    ) {}

    public function show(): JsonResponse
    {
        $profile = ClinicProfile::query()->first();

        return $this->successResponse(
            data: $profile ? new ClinicProfileResource($profile) : null,
            message: 'Clinic profile fetched successfully.'
        );
    }

    public function update(UpdateClinicProfileRequest $request): JsonResponse
    {
        $profile = ClinicProfile::query()->first();
        $data = $request->validated();

        // Provide sane fallbacks to avoid null DB writes when payload is missing fields
        $payload = [
            'name' => ($data['name'] ?? $profile?->name ?? 'Clinic'),
            'owner_name' => ($data['ownerName'] ?? $profile?->owner_name ?? 'Owner'),
            'address' => $data['address'] ?? $profile?->address,
            'contact_number' => $data['contactNumber'] ?? $profile?->contact_number,
            'email' => $data['email'] ?? $profile?->email,
            'website' => $data['website'] ?? $profile?->website,
            'license_number' => $data['licenseNumber'] ?? $profile?->license_number,
            'notes' => $data['notes'] ?? $profile?->notes,
        ];

        $logoFile = $request->file('logoPath');
        if ($logoFile instanceof UploadedFile) {
            $fileUpload = $this->fileUploadUseCase->execute(
                uploadedFile: $logoFile,
                module: 'settings',
                userId: $request->user()?->id
            );

            if ($profile?->logo_path && $profile->logo_path !== $fileUpload->path) {
                $this->deleteFileUseCase->execute($profile->logo_path);
            }

            $payload['logo_path'] = $fileUpload->path;
        } elseif ($request->has('logoPath') && !$request->hasFile('logoPath')) {
            if ($profile?->logo_path) {
                $this->deleteFileUseCase->execute($profile->logo_path);
            }

            $payload['logo_path'] = null;
        }

        if ($profile) {
            $profile->update($payload);
        } else {
            $profile = ClinicProfile::query()->create($payload);
        }

        return $this->successResponse(
            data: new ClinicProfileResource($profile->fresh()),
            message: 'Clinic profile updated successfully.'
        );
    }
}
