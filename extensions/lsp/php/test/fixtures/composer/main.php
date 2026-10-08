<?php

use Shop\Store;

$store = new Store();
$store->add('apple');
echo $store->count();
