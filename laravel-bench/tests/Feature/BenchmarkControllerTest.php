<?php

namespace Tests\Feature;

use Tests\TestCase;

class BenchmarkControllerTest extends TestCase
{
    public function test_returns_fixed_json_without_database_access(): void
    {
        $this->getJson('/bench/json')
            ->assertOk()
            ->assertExactJson([
                'service' => 'medihome-benchmark',
                'status' => 'ok',
                'version' => 1,
            ]);
    }

    public function test_returns_401_when_authenticated_route_has_no_token(): void
    {
        $this->getJson('/bench-auth/json')
            ->assertUnauthorized()
            ->assertExactJson([
                'error' => [
                    'code' => 'unauthorized',
                    'message' => 'Missing bearer token',
                ],
            ]);
    }

    public function test_read_token_authorizes_authenticated_reads(): void
    {
        $this->withToken('bench-read-token')
            ->getJson('/bench-auth/json')
            ->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    public function test_returns_403_when_read_token_attempts_a_write(): void
    {
        $this->withToken('bench-read-token')
            ->postJson('/bench-auth/visits', [])
            ->assertForbidden()
            ->assertExactJson([
                'error' => [
                    'code' => 'forbidden',
                    'message' => 'Insufficient scope',
                ],
            ]);
    }

    public function test_returns_422_and_all_fields_when_visit_payload_is_empty(): void
    {
        $this->postJson('/bench/visits', [])
            ->assertUnprocessable()
            ->assertExactJson([
                'error' => [
                    'code' => 'validation_error',
                    'message' => 'Invalid request',
                    'fields' => ['patient_id', 'visited_at', 'type', 'notes'],
                ],
            ]);
    }
}
