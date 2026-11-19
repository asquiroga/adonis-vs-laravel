<?php

namespace App\Http\Middleware;

use App\Models\BenchmarkSession;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BenchmarkSessionAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->cookie('bench_session');
        if (! is_string($token) || $token === '') {
            return $this->unauthorized();
        }

        $session = BenchmarkSession::query()
            ->with('user.doctor')
            ->whereKey(hash('sha256', $token))
            ->where('expires_at', '>', now())
            ->first();

        if (! $session || ! $session->user) {
            return $this->unauthorized();
        }

        if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $csrfToken = $request->header('X-CSRF-TOKEN');
            if (! is_string($csrfToken) || ! hash_equals($session->csrf_token, $csrfToken)) {
                return response()->json(['error' => ['code' => 'csrf_failed', 'message' => 'Invalid CSRF token']], 419);
            }
        }

        $request->attributes->set('benchmark_user', $session->user);
        $request->attributes->set('benchmark_session', $session);

        return $next($request);
    }

    private function unauthorized(): JsonResponse
    {
        return response()->json(['error' => ['code' => 'unauthenticated', 'message' => 'Authentication required']], 401);
    }
}
