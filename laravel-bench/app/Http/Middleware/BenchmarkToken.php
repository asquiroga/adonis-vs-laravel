<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BenchmarkToken
{
    public function handle(Request $request, Closure $next, string $scope): Response
    {
        $token = $request->bearerToken();
        if ($token === null || $token === '') {
            return new JsonResponse([
                'error' => ['code' => 'unauthorized', 'message' => 'Missing bearer token'],
            ], 401);
        }

        $readToken = (string) config('benchmark.read_token');
        $writeToken = (string) config('benchmark.write_token');
        $valid = $scope === 'write'
            ? hash_equals($writeToken, (string) $token)
            : hash_equals($readToken, (string) $token) || hash_equals($writeToken, (string) $token);

        if (! $valid) {
            return new JsonResponse([
                'error' => ['code' => 'forbidden', 'message' => 'Insufficient scope'],
            ], 403);
        }

        return $next($request);
    }
}
