<?php

declare(strict_types=1);

function parseDeviceFromUa(string $ua): array
{
    $uaLower = strtolower($ua);

    $platform = 'desktop';
    $os = 'Unknown OS';
    $device = 'Unknown device';

    if (strpos($ua, 'iPhone') !== false || strpos($ua, 'iPod') !== false) {
        $platform = 'mobile';
        $os = 'iOS';
        $device = 'iPhone';
        return compact('platform', 'os', 'device');
    }

    if (strpos($ua, 'iPad') !== false) {
        $platform = 'tablet';
        $os = 'iOS';
        $device = 'iPad';
        return compact('platform', 'os', 'device');
    }

    if (strpos($uaLower, 'android') !== false) {
        $platform = 'mobile';
        $os = 'Android';

        if (preg_match('/android\s+[0-9.]+;\s*([^);]+)/i', $ua, $matches)) {
            $model = trim($matches[1]);
            $device = 'Android: ' . $model;
        } else {
            $device = 'Android device';
        }

        return compact('platform', 'os', 'device');
    }

    if (strpos($uaLower, 'windows') !== false) {
        $platform = 'desktop';
        $os = 'Windows';
        $device = 'Windows PC';
        return compact('platform', 'os', 'device');
    }

    if (strpos($uaLower, 'macintosh') !== false || strpos($uaLower, 'mac os x') !== false) {
        $platform = 'desktop';
        $os = 'macOS';
        $device = 'Mac';
        return compact('platform', 'os', 'device');
    }

    if (strpos($uaLower, 'linux') !== false) {
        $platform = 'desktop';
        $os = 'Linux';
        $device = 'Linux PC';
        return compact('platform', 'os', 'device');
    }

    return compact('platform', 'os', 'device');
}

function formatDeviceWithCity(array $parsedDevice, string $city): string
{
    $citySuffix = $city !== '' && $city !== 'UNKNOWN' ? " ({$city})" : '';

    return ($parsedDevice['device'] ?? 'Unknown device') . $citySuffix;
}

if (PHP_SAPI === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $samples = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' => 'Tyumen',
        'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' => 'Mountain View',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15' => 'Sochi',
    ];

    foreach ($samples as $ua => $city) {
        $parsed = parseDeviceFromUa($ua);
        echo formatDeviceWithCity($parsed, $city), PHP_EOL;
    }
}
