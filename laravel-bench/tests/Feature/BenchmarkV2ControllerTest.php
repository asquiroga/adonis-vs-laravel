<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BenchmarkV2ControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('benchmark_users', function (Blueprint $table): void {
            $table->id();
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('role');
            $table->string('display_name');
            $table->timestamps();
        });
        Schema::create('doctors', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique();
            $table->string('license_number');
            $table->string('specialty');
            $table->timestamps();
        });
        Schema::create('benchmark_sessions', function (Blueprint $table): void {
            $table->char('token_hash', 64)->primary();
            $table->foreignId('user_id');
            $table->char('csrf_token', 64);
            $table->timestamp('expires_at');
            $table->timestamp('created_at');
            $table->timestamp('last_seen_at');
        });
    }

    public function test_health_is_public_and_versioned(): void
    {
        $this->getJson('/bench-v2/health')
            ->assertOk()
            ->assertExactJson(['service' => 'medihome-benchmark', 'status' => 'ok', 'version' => 2]);
    }

    public function test_protected_route_requires_a_session(): void
    {
        $this->getJson('/bench-v2/auth/me')
            ->assertUnauthorized()
            ->assertExactJson(['error' => ['code' => 'unauthenticated', 'message' => 'Authentication required']]);
    }

    public function test_login_creates_an_opaque_session_and_csrf_token(): void
    {
        DB::table('benchmark_users')->insert([
            'id' => 1,
            'email' => 'admin001@benchmark.invalid',
            'password_hash' => password_hash('secret-password', PASSWORD_BCRYPT),
            'role' => 'admin',
            'display_name' => 'Administrador 1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/bench-v2/auth/login', [
            'email' => 'admin001@benchmark.invalid',
            'password' => 'secret-password',
        ])->assertOk()
            ->assertCookie('bench_session')
            ->assertCookie('XSRF-TOKEN')
            ->assertJsonPath('data.user.role', 'admin')
            ->assertJsonPath('data.user.doctor_id', null)
            ->assertJsonStructure(['data' => ['csrf_token']]);

        $this->assertDatabaseCount('benchmark_sessions', 1);
        $this->assertSame(64, strlen((string) DB::table('benchmark_sessions')->value('token_hash')));
    }

    public function test_write_requires_matching_csrf_token(): void
    {
        DB::table('benchmark_users')->insert([
            'id' => 1,
            'email' => 'admin001@benchmark.invalid',
            'password_hash' => password_hash('secret-password', PASSWORD_BCRYPT),
            'role' => 'admin',
            'display_name' => 'Administrador 1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $login = $this->postJson('/bench-v2/auth/login', [
            'email' => 'admin001@benchmark.invalid',
            'password' => 'secret-password',
        ])->assertOk();
        $token = $login->getCookie('bench_session', false)->getValue();

        $this->withCredentials()
            ->withUnencryptedCookie('bench_session', $token)
            ->postJson('/bench-v2/auth/logout')
            ->assertStatus(419)
            ->assertExactJson(['error' => ['code' => 'csrf_failed', 'message' => 'Invalid CSRF token']]);
    }
}
