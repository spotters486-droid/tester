<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    respond(405, ['error' => 'Este endpoint solo admite solicitudes GET.']);
}

$lat = filter_var($_GET['lat'] ?? null, FILTER_VALIDATE_FLOAT);
$lon = filter_var($_GET['lon'] ?? null, FILTER_VALIDATE_FLOAT);
$dist = filter_var($_GET['dist'] ?? 250, FILTER_VALIDATE_INT);
if ($lat === false || $lon === false || $dist === false || $lat < -90 || $lat > 90 || $lon < -180 || $lon > 180 || $dist < 1 || $dist > 250) {
    respond(400, ['error' => 'Coordenadas o radio no válidos.']);
}

$latText = rtrim(rtrim(number_format((float)$lat, 6, '.', ''), '0'), '.');
$lonText = rtrim(rtrim(number_format((float)$lon, 6, '.', ''), '0'), '.');
$caBundle = __DIR__ . DIRECTORY_SEPARATOR . 'cacert.pem';
if (!is_file($caBundle)) {
    respond(500, ['error' => 'Falta cacert.pem junto a aviones.php. Descarga el paquete de certificados indicado en las instrucciones y colócalo en la carpeta gg.']);
}
$urls = [
    "https://api.airplanes.live/v2/point/{$latText}/{$lonText}/{$dist}",
    "https://opendata.adsb.fi/api/v3/lat/{$latText}/lon/{$lonText}/dist/{$dist}",
    "https://api.adsb.lol/v2/lat/{$latText}/lon/{$lonText}/dist/{$dist}",
];

$failures = [];

foreach ($urls as $url) {
    $body = false;
    $status = 0;
    $curlError = '';
    $curlErrorNumber = 0;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CAINFO => $caBundle,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_USERAGENT => 'SpottersSpainRadar/1.0',
        ]);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrorNumber = curl_errno($ch);
        $curlError = curl_error($ch);
        curl_close($ch);
    } elseif (filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) {
        $context = stream_context_create(['http' => [
            'method' => 'GET',
            'timeout' => 10,
            'ignore_errors' => true,
            'header' => "Accept: application/json\r\nUser-Agent: SpottersSpainRadar/1.0\r\n",
        ]]);
        $body = @file_get_contents($url, false, $context);
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
            $status = (int)$m[1];
        }
    } else {
        respond(500, ['error' => 'Activa la extensión cURL o allow_url_fopen en PHP de AppServ.']);
    }

    $host = (string)parse_url($url, PHP_URL_HOST);
    if ($body === false) {
        if (function_exists('curl_init')) {
            $failures[] = $host . ': cURL ' . $curlErrorNumber . ' - ' . $curlError;
        } else {
            $failures[] = $host . ': no se pudo abrir la conexión HTTPS';
        }
        continue;
    }
    if ($status < 200 || $status >= 300) {
        $failures[] = $host . ': HTTP ' . $status;
        continue;
    }
    $data = json_decode($body, true);
    if (is_array($data) && ((isset($data['ac']) && is_array($data['ac'])) || (isset($data['aircraft']) && is_array($data['aircraft'])))) {
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    $failures[] = $host . ': respuesta JSON inválida o sin lista de aviones';
}

respond(502, [
    'error' => 'Ninguna fuente ADS-B respondió correctamente.',
    'diagnostico' => $failures,
]);