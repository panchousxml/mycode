<?php

declare(strict_types=1);

$cacheFile = __DIR__ . '/ip_city_cache.php';
$ipCache = file_exists($cacheFile) ? include $cacheFile : [];
if (!is_array($ipCache)) {
    $ipCache = [];
}

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

function getCityByIpCached(string $ip, array &$ipCache, string $cacheFile): string
{
    if (array_key_exists($ip, $ipCache)) {
        return $ipCache[$ip];
    }

    $city = getCityByIp($ip);
    $ipCache[$ip] = $city;

    file_put_contents($cacheFile, '<?php return ' . var_export($ipCache, true) . ';', LOCK_EX);

    return $city;
}

$ip = getClientIp();
$city = getCityByIpCached($ip, $ipCache, $cacheFile);

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ip' => $ip,
    'city' => $city,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
