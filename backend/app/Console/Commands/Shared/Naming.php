<?php

declare(strict_types=1);

namespace App\Console\Commands\Shared;

use Illuminate\Support\Str;

final class Naming // NOSONAR
{
    // ────── ENTITY ──────
    public static function entityCamel(string $entity): string
    {
        return lcfirst(self::entityPascal($entity));
    }

    public static function entityCamelPlural(string $entity): string
    {
        return lcfirst(self::entityPascalPlural($entity));
    }

    public static function entityHeadline(string $entity): string
    {
        return Str::headline($entity);
    }

    public static function entityHeadlinePlural(string $entity): string
    {
        return Str::plural(Str::headline($entity));
    }

    public static function entityKebab(string $entity): string
    {
        return Str::kebab($entity);
    }

    public static function entityKebabPlural(string $entity): string
    {
        return Str::kebab(Str::plural($entity));
    }

    public static function entityPascal(string $entity): string
    {
        return Str::studly($entity);
    }

    public static function entityPascalPlural(string $entity): string
    {
        return Str::studly(Str::plural($entity));
    }

    public static function entityQueryKey(string $entity): string
    {
        return Str::plural(self::entityCamel($entity));
    }

    public static function entityQueryKeySingle(string $entity): string
    {
        return self::entityCamel($entity);
    }

    public static function entitySnake(string $entity): string
    {
        return Str::snake($entity);
    }

    public static function entitySnakePlural(string $entity): string
    {
        return Str::snake(Str::plural($entity));
    }

    public static function entitySnakeUpper(string $entity): string
    {
        return Str::upper(Str::snake($entity, '_'));
    }

    // ────── MODULE ──────
    public static function moduleCamel(string $module): string
    {
        return lcfirst(self::modulePascal($module));
    }

    public static function moduleHeadline(string $module): string
    {
        return Str::headline($module);
    }

    public static function moduleKebab(string $module): string
    {
        return Str::kebab($module);
    }

    public static function modulePascal(string $module): string
    {
        return Str::studly($module);
    }

    public static function moduleSnake(string $module): string
    {
        return Str::snake($module);
    }

    // ────── PERMISSIONS & PATHS ──────
    public static function permissionPrefix(string $module, string $entity): string
    {
        return self::moduleKebab($module).'.'.self::entityKebabPlural($entity);
    }

    public static function backendModulePath(string $module): string
    {
        return app_path("Modules/{$module}");
    }

    public static function frontendModulePath(string $module): string
    {
        return base_path('../frontend/src/modules/'.self::moduleKebab($module));
    }

    public static function all(string $module, string $entity): array
    {
        return [
            'entityCamel' => self::entityCamel($entity),
            'entityCamelPlural' => self::entityCamelPlural($entity),
            'entityHeadline' => self::entityHeadline($entity),
            'entityHeadlinePlural' => self::entityHeadlinePlural($entity),
            'entityKebab' => self::entityKebab($entity),
            'entityKebabPlural' => self::entityKebabPlural($entity),
            'entityPascal' => self::entityPascal($entity),
            'entityPascalPlural' => self::entityPascalPlural($entity),
            'entityQueryKey' => self::entityQueryKey($entity),
            'entityQueryKeySingle' => self::entityQueryKeySingle($entity),
            'entitySnake' => self::entitySnake($entity),
            'entitySnakePlural' => self::entitySnakePlural($entity),
            'entitySnakeUpper' => self::entitySnakeUpper($entity),

            'moduleCamel' => self::moduleCamel($module),
            'moduleHeadline' => self::moduleHeadline($module),
            'moduleKebab' => self::moduleKebab($module),
            'modulePascal' => self::modulePascal($module),
            'moduleSnake' => self::moduleSnake($module),

            'permissionPrefix' => self::permissionPrefix($module, $entity),
        ];
    }
}
