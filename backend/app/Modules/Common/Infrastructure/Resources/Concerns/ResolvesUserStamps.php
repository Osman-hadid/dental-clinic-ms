<?php

declare(strict_types=1);

namespace App\Modules\Common\Infrastructure\Resources\Concerns;

use App\Models\User;

trait ResolvesUserStamps
{
    /**
     * @var array<int, string|null>
     */
    private static array $userStampCache = [];

    protected function resolveUserStampName(mixed $value): ?string
    {
        $id = (int) ($value ?? 0);
        if ($id <= 0) {
            return null;
        }

        if (array_key_exists($id, self::$userStampCache)) {
            return self::$userStampCache[$id];
        }

        $user = User::withTrashed()
            ->select(['id', 'first_name', 'last_name', 'email'])
            ->find($id);

        if ($user === null) {
            return self::$userStampCache[$id] = "User #{$id}";
        }

        $fullName = trim(sprintf('%s %s', (string) ($user->first_name ?? ''), (string) ($user->last_name ?? '')));
        if ($fullName !== '') {
            return self::$userStampCache[$id] = $fullName;
        }

        $email = trim((string) ($user->email ?? ''));
        if ($email !== '') {
            return self::$userStampCache[$id] = $email;
        }

        return self::$userStampCache[$id] = "User #{$id}";
    }
}
