<?php

class Store
{
    private array $items = [];

    public function add(string $name): void
    {
        $this->items[] = $name;
    }
}
