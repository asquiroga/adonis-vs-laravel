<?php

namespace App\Http\Controllers;

use App\Models\BenchmarkSession;
use App\Models\BenchmarkUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Validator;

class BenchmarkAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email', 'max:254'],
            'password' => ['required', 'string', 'max:200'],
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => ['code' => 'validation_error', 'message' => 'Invalid request', 'fields' => array_keys($validator->errors()->toArray())]], 422);
        }

        $credentials = $validator->validated();
        $user = BenchmarkUser::query()->with('doctor')->where('email', $credentials['email'])->first();
        if (! $user || ! password_verify($credentials['password'], $user->password_hash)) {
            return response()->json(['error' => ['code' => 'invalid_credentials', 'message' => 'Invalid credentials']], 401);
        }

        $token = bin2hex(random_bytes(32));
        $csrfToken = bin2hex(random_bytes(32));
        $ttl = (int) config('benchmark.session_ttl_seconds');
        $now = now();

        BenchmarkSession::query()->create([
            'token_hash' => hash('sha256', $token),
            'user_id' => $user->id,
            'csrf_token' => $csrfToken,
            'expires_at' => $now->copy()->addSeconds($ttl),
            'created_at' => $now,
            'last_seen_at' => $now,
        ]);

        $minutes = (int) ceil($ttl / 60);
        $response = response()->json(['data' => ['user' => $this->userData($user), 'csrf_token' => $csrfToken]]);
        $response->withCookie(Cookie::make('bench_session', $token, $minutes, '/bench-v2', null, false, true, false, 'lax'));
        $response->withCookie(Cookie::make('XSRF-TOKEN', $csrfToken, $minutes, '/bench-v2', null, false, false, false, 'lax'));

        return $response;
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => ['user' => $this->userData($request->attributes->get('benchmark_user'))]]);
    }

    public function logout(Request $request): JsonResponse
    {
        /** @var BenchmarkSession $session */
        $session = $request->attributes->get('benchmark_session');
        $session->delete();

        $response = response()->json(['data' => ['logged_out' => true]]);
        $response->withCookie(Cookie::forget('bench_session', '/bench-v2'));
        $response->withCookie(Cookie::forget('XSRF-TOKEN', '/bench-v2'));

        return $response;
    }

    /**
     * @return array{id: int, email: string, role: string, display_name: string, doctor_id: int|null}
     */
    private function userData(BenchmarkUser $user): array
    {
        return [
            'id' => $user->id,
            'email' => $user->email,
            'role' => $user->role,
            'display_name' => $user->display_name,
            'doctor_id' => $user->doctor?->id,
        ];
    }
}
