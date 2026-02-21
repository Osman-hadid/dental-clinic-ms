<?php

declare(strict_types=1);

namespace App\Console\Commands\Frontend;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

final class ListRequestParser
{
    /*
    * TODO: Needs refactoring. NOSONAR
    */

    private const SINGLE_QUOTED_STRING = "/'([^']+)'/";

    public function parse(string $module, string $entity): array
    {
        $requestPath = base_path("app/Modules/{$module}/Infrastructure/Http/Requests/{$entity}/List".Str::plural($entity).'Request.php');

        if (!File::exists($requestPath)) {
            return [
                'searchable' => [],
                'filters' => [],
                'sortable' => [],
                'relations' => [],
                'fieldable' => [],
            ];
        }

        $content = File::get($requestPath);

        return [
            'searchable' => $this->parseSearchableColumns($content),
            'filters' => $this->parseFilters($content),
            'sortable' => $this->parseSortableColumns($content),
            'relations' => $this->parseAllowedRelations($content),
            'fieldable' => $this->parseFieldableColumns($content),
        ];
    }

    private function parseSearchableColumns(string $content): array
    {
        if (!preg_match('/searchableColumns\(\)\s*:\s*array\s*\{([^}]+)\}/s', $content, $match)) {
            return [];
        }

        $body = $match[1];
        preg_match_all("/'([^']+)'\s*=>\s*(?:'[^']+'|\[[^\]]*\])/", $body, $matches);

        return $matches[1];
    }

    private function parseFilters(string $content): array
    {
        if (!preg_match('/filters\(\)\s*:\s*array\s*\{([^}]+)\}/s', $content, $match)) {
            return [];
        }

        $body = $match[1];
        preg_match_all("/'([^']+)'\s*=>\s*\[([^\]]+)\]/", $body, $matches, PREG_SET_ORDER);

        $filters = [];
        foreach ($matches as $m) {
            $key = Str::camel($m[1]);
            preg_match_all(self::SINGLE_QUOTED_STRING, $m[2], $opts);
            $filters[$key] = $opts[1];
        }

        return $filters;
    }

    private function parseSortableColumns(string $content): array
    {
        if (!preg_match('/sortableColumns\(\)\s*:\s*array\s*\{([^}]+)\}/s', $content, $match)) {
            return [];
        }

        $body = $match[1];
        preg_match_all(self::SINGLE_QUOTED_STRING, $body, $matches);

        return array_map(Str::camel(...), $matches[1]);
    }

    private function parseAllowedRelations(string $content): array
    {
        if (!preg_match('/allowedRelations\(\)\s*:\s*array\s*\{([^}]+)\}/s', $content, $match)) {
            return [];
        }

        $body = $match[1];
        preg_match_all(self::SINGLE_QUOTED_STRING, $body, $matches);

        return $matches[1];
    }

    private function parseFieldableColumns(string $content): array
    {
        if (!preg_match('/fieldableColumns\(\)\s*:\s*array\s*\{([^}]+)\}/s', $content, $match)) {
            return [];
        }

        $body = $match[1];
        preg_match_all("/'([^']+)'\s*=>\s*'([^']+)'/", $body, $matches, PREG_SET_ORDER);

        $map = [];
        foreach ($matches as $m) {
            $map[Str::camel($m[1])] = $m[2]; // titleEn => title_en
        }

        return $map;
    }
}
