<?php

declare(strict_types=1);

$cityCacheFile = __DIR__ . '/ip_city_cache.php';
$IP_CITY_CACHE = [];

if (file_exists($cityCacheFile)) {
    $loaded = include $cityCacheFile;
    if (is_array($loaded)) {
        $IP_CITY_CACHE = $loaded;
    }
}

$MANUAL_CITY_OVERRIDES = [
    '91.215.90.178' => 'Sochi',
];

function getClientIp(): string
{
    $serverKeys = ['HTTP_CLIENT_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];

    foreach ($serverKeys as $key) {
        if (empty($_SERVER[$key])) {
            continue;
        }

        $value = $_SERVER[$key];

        if ($key === 'HTTP_X_FORWARDED_FOR') {
            $parts = array_map('trim', explode(',', $value));
            $value = $parts[0];
        }

        if (filter_var($value, FILTER_VALIDATE_IP)) {
            return $value;
        }
    }

    return '';
}

function getCityByIp(string $ip): string
{
    if ($ip === '') {
        return 'UNKNOWN';
    }

    $url = "https://ipapi.co/{$ip}/json/";
    $context = stream_context_create(['http' => ['timeout' => 3]]);
    $response = @file_get_contents($url, false, $context);

    if ($response !== false) {
        $data = json_decode($response, true);
        if (!empty($data['city'])) {
            return (string) $data['city'];
        }
    }

    return 'UNKNOWN';
}

function getCityByIpCached(string $ip, array &$cache, string $cacheFile): string
{
    if (isset($cache[$ip]) && $cache[$ip] !== 'UNKNOWN') {
        return $cache[$ip];
    }

    if (isset($cache[$ip]) && $cache[$ip] === 'UNKNOWN') {
        return 'UNKNOWN';
    }

    $city = getCityByIp($ip);
    $cache[$ip] = $city;

    file_put_contents($cacheFile, '<?php return ' . var_export($cache, true) . ';', LOCK_EX);

    return $city;
}

$ip = getClientIp();
$city = getCityByIpCached($ip, $IP_CITY_CACHE, $cityCacheFile);

if (isset($MANUAL_CITY_OVERRIDES[$ip])) {
    $city = $MANUAL_CITY_OVERRIDES[$ip];
    $IP_CITY_CACHE[$ip] = $city;
    file_put_contents($cityCacheFile, '<?php return ' . var_export($IP_CITY_CACHE, true) . ';', LOCK_EX);
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ip' => $ip,
    'city' => $city,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
