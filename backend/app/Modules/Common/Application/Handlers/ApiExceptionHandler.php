<?php

declare(strict_types=1);

namespace App\Modules\Common\Application\Handlers;

use App\Modules\Common\Application\Exceptions\ApiException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Exceptions\UnauthorizedException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

final class ApiExceptionHandler
{
    public function __invoke(Throwable $throwable): JsonResponse
    {
        $status = 500;
        $error = [
            'code' => 'INTERNAL_SERVER_ERROR',
            'message' => 'Something went wrong.',
            'details' => config('app.debug') ? $throwable->getMessage() : null,
        ];

        return match (true) {
            $throwable instanceof ApiException => $this->handleApiException($throwable, $status, $error),
            $throwable instanceof ValidationException => $this->handleValidation($throwable, $status, $error),
            $throwable instanceof AuthenticationException => $this->handleAuth($status, $error),
            $throwable instanceof UnauthorizedException => $this->handleUnauthorized($status, $error),
            $throwable instanceof ModelNotFoundException,
            $throwable instanceof NotFoundHttpException => $this->handleNotFound($status, $error),
            $throwable instanceof MethodNotAllowedHttpException => $this->handleMethodNotAllowed($status, $error),
            $throwable instanceof QueryException && $throwable->getCode() === '23503' => $this->handleForeignKey($throwable, $status, $error),
            $throwable instanceof QueryException && $throwable->getCode() === '42703' => $this->handleSchemaMismatch($throwable, $status, $error),
            $throwable instanceof HttpException => $this->handleHttp($throwable, $status, $error),
            default => $this->response($status, $error),
        };
    }

    private function handleApiException(ApiException $apiException, int &$status, array &$error): JsonResponse
    {
        $status = $apiException->getCode() >= 200 && $apiException->getCode() <= 599 ? $apiException->getCode() : 400;
        $error = [
            'code' => $apiException->getErrorCode(),
            'message' => $apiException->getMessage(),
            'details' => $apiException->getDetails(),
        ];

        return $this->response($status, $error);
    }

    private function handleValidation(ValidationException $validationException, int &$status, array &$error): JsonResponse
    {
        $status = 422;
        $error = ['code' => 'VALIDATION_ERROR', 'message' => 'Validation failed', 'details' => $validationException->errors()];

        return $this->response($status, $error);
    }

    private function handleAuth(int &$status, array &$error): JsonResponse
    {
        $status = 401;
        $error = ['code' => 'UNAUTHENTICATED', 'message' => 'Unauthenticated.', 'details' => null];

        return $this->response($status, $error)->header('WWW-Authenticate', 'Bearer');
    }

    private function handleUnauthorized(int &$status, array &$error): JsonResponse
    {
        $status = 403;
        $error = ['code' => 'UNAUTHORIZED', 'message' => 'Forbidden.', 'details' => null];

        return $this->response($status, $error);
    }

    private function handleNotFound(int &$status, array &$error): JsonResponse
    {
        $status = 404;
        $error = ['code' => 'NOT_FOUND', 'message' => 'Resource not found.', 'details' => null];

        return $this->response($status, $error);
    }

    private function handleMethodNotAllowed(int &$status, array &$error): JsonResponse
    {
        $status = 405;
        $error = ['code' => 'METHOD_NOT_ALLOWED', 'message' => 'Method not allowed.', 'details' => null];

        return $this->response($status, $error);
    }

    private function handleForeignKey(QueryException $queryException, int &$status, array &$error): JsonResponse
    {
        $status = 409;
        $resource = $this->extractResource($queryException);
        $error = ['code' => 'RESOURCE_IN_USE', 'message' => "Cannot delete {$resource}.", 'details' => ['resource' => $resource]];

        return $this->response($status, $error);
    }

    private function handleSchemaMismatch(QueryException $queryException, int &$status, array &$error): JsonResponse
    {
        $status = 500;
        $error = [
            'code' => 'SCHEMA_MISMATCH',
            'message' => 'Database schema does not match the current application code.',
            'details' => config('app.debug') ? $queryException->getMessage() : null,
        ];

        return $this->response($status, $error);
    }

    private function handleHttp(HttpException $httpException, int &$status, array &$error): JsonResponse
    {
        $status = $httpException->getStatusCode();
        $error = ['code' => strtoupper(str_replace(' ', '_', $httpException->getMessage())), 'message' => $httpException->getMessage(), 'details' => null];

        return $this->response($status, $error);
    }

    private function extractResource(QueryException $queryException): string
    {
        return preg_match('/table "(\w+)"/', $queryException->getMessage(), $m) ? $m[1] : 'resource';
    }

    private function response(int $status, array $error): JsonResponse
    {
        $requestId = request()->header('X-Request-Id');
        if ($requestId) {
            $error['requestId'] = $requestId;
        }

        $response = response()->json(['success' => false, 'error' => $error], $status);

        if ($requestId) {
            $response->headers->set('X-Request-Id', $requestId);
        }

        return $response;
    }
}
