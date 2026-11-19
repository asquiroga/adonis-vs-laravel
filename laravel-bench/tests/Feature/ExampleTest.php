<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_fixed_json_contract(): void
    {
        $this->getJson('/bench/json')
            ->assertOk()
            ->assertExactJson(['service' => 'medihome-benchmark', 'status' => 'ok', 'version' => 1]);
    }
}
