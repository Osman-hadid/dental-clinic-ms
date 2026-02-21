<?php

declare(strict_types=1);

namespace App\Modules\Settings\Application\DTOs;

final readonly class ModuleData
{
    public function __construct(
        public string $nameEn,
        public ?string $namePs,
        public ?string $nameDr,
        public string $url,
        public ?string $description,
        public ?int $sortOrder,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            nameEn: $data['nameEn'] ?? null,
            namePs: $data['namePs'] ?? null,
            nameDr: $data['nameDr'] ?? null,
            url: $data['url'] ?? null,
            description: $data['description'] ?? null,
            sortOrder: $data['sortOrder'] ?? null,
        );
    }

    public function toArray(): array
    {
        return [
            'name_en' => $this->nameEn,
            'name_ps' => $this->namePs,
            'name_dr' => $this->nameDr,
            'url' => $this->url,
            'description' => $this->description,
            'sort_order' => $this->sortOrder,
        ];
    }
}
