<?php
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    exit;
}

$sessionId = $_COOKIE['session_id'] ?? '';
$deviceId  = $_COOKIE['device_id'] ?? '';
$ip        = $_SERVER['REMOTE_ADDR'] ?? '';

$eventType = $data['type'] ?? '';
$eventName = $data['name'] ?? '';
$page      = $data['page'] ?? '';
$target    = $data['selector'] ?? '';

$meta = $data;
unset($meta['type'], $meta['name'], $meta['page'], $meta['selector']);

if ($sessionId === '' || $eventType === '' || $eventName === '') {
    http_response_code(400);
    exit;
}

$line = implode("\t", [
    date('Y-m-d H:i:s'),
    $sessionId,
    $deviceId,
    $ip,
    $eventType,
    $eventName,
    $page,
    $target,
    json_encode($meta, JSON_UNESCAPED_UNICODE)
]) . "\n";

file_put_contents(__DIR__ . '/events.log', $line, FILE_APPEND | LOCK_EX);

echo 'ok';
