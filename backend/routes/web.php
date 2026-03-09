<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect('/'.config('app.locale', 'en').'/');
});

Route::get('/{any}', function (Request $request, string $any) {
    if ($request->is('api/*') || $request->is('sanctum/*')) {
        abort(404);
    }

    $relativePath = trim($any, '/');
    $candidates = [
        public_path($relativePath),
        public_path($relativePath.'.html'),
        public_path($relativePath.'/index.html'),
    ];

    foreach ($candidates as $candidate) {
        if (File::exists($candidate) && is_file($candidate)) {
            return response()->file($candidate);
        }
    }

    $firstSegment = explode('/', $relativePath)[0] ?? '';
    $supportedLocales = ['en', 'dr', 'ps'];

    if ($relativePath !== '' && !in_array($firstSegment, $supportedLocales, true)) {
        $defaultLocale = (string) config('app.locale', 'en');
        $localizedPath = '/'.trim($defaultLocale.'/'.$relativePath, '/');
        return redirect()->to($localizedPath.'/');
    }

    if (in_array($firstSegment, $supportedLocales, true)) {
        $localeIndex = public_path($firstSegment.'/index.html');
        if (File::exists($localeIndex)) {
            return response()->file($localeIndex);
        }
    }

    abort(404);
})->where('any', '^(?!api|sanctum).*$');
