<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\ImplantPlanning;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreImplantPlanningRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('implantTeeth') && is_array($this->input('implantTeeth'))) {
            $normalized = array_values(array_filter(array_map(
                static fn ($value): string => trim((string) $value),
                $this->input('implantTeeth', [])
            )));
            $this->merge(['implantTeeth' => $normalized]);
        }
    }

    public function rules(): array
    {
        return [
            'patientId' => 'required|integer|exists:patients,id',
            'linkedVisitId' => 'nullable|integer|exists:visits,id',
            'dentistId' => 'nullable|integer|exists:staff,id',
            'treatmentId' => 'required|integer|exists:treatments,id',
            'currency' => 'nullable|string|in:AFN,USD',
            'exchangeRate' => 'nullable|numeric|gt:0',
            'visitDate' => 'nullable|date',
            'notes' => 'nullable|string|max:255',
            'implantTeeth' => 'required|array|min:1',
            'implantTeeth.*' => ['required', 'regex:/^[0-9]{2}$/'],
            'implantPricePerTooth' => 'required|numeric|min:0.01',
            'implantSystem' => 'nullable|string|max:255',
            'implantDiameterMm' => 'nullable|string|max:50',
            'implantLengthMm' => 'nullable|string|max:50',
            'implantArch' => 'required|string|in:maxilla,mandible,both',
            'loadingProtocol' => 'required|string|in:delayed,early,immediate',
            'supplierCostPerTooth' => 'nullable|numeric|min:0',
            'paidNowAmount' => 'nullable|numeric|min:0',
            'paymentMethod' => 'required|string|in:cash,card,insurance',
            'implantCompanyId' => 'nullable|integer|exists:implant_companies,id',
            'implantCompanyName' => 'nullable|string|max:160',
            'implantCompanyType' => 'nullable|string|max:160',
            'implantCompanyDate' => 'nullable|date',
            'implantCompanyNote' => 'nullable|string|max:500',
        ];
    }
}
