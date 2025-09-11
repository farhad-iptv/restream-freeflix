<?php
// Vercel serverless PHP function

header('Access-Control-Allow-Origin: *'); // allow cross-origin requests

// 🔹 Channel data
$data = [
    "category_name" => "Sports",
    "name" => "Sony Ten Sports 1 HD",
    "logo" => "https://assets-prod.services.toffeelive.com/f_webp,w_240,q_100/py5j-JQBv9knK3AHxDTY/posters/ea3358b9-2bec-4615-a889-daa2e396c74c.webp",
    "link" => "https://bldcmprod-cdn.toffeelive.com/cdn/live/sony_sports_1_hd/playlist.m3u8",
    "cookie" => "Edge-Cache-Cookie=URLPrefix=aHR0cHM6Ly9ibGRjbXByb2QtY2RuLnRvZmZlZWxpdmUuY29t:Expires=1757768360:KeyName=prod_linear:Signature=sE9pG3zPzEwXb8BtRw9fUg1MYgykQg_-nkd8IpxLwduE6aKy2XM0K4EPlyZOQ4u3En3HbUsDF86fP9LeUGuPAg"
];

$cookie = $data['cookie'];
$baseHost = "https://bldcmprod-cdn.toffeelive.com";

// 🔹 Helper function
function fetch_m3u8($url, $cookie) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "User-Agent: Mozilla/5.0",
        "Referer: https://toffeelive.com/",
        "Cookie: $cookie"
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode == 200 && $response) {
        return $response;
    }
    return false;
}

// 🔹 Check for segment proxy request
if (isset($_GET['segment'])) {
    $path = $_GET['segment'];
    $url = $baseHost . $path;

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "User-Agent: Mozilla/5.0",
        "Referer: https://toffeelive.com/",
        "Cookie: $cookie"
    ]);
    $data = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($httpCode == 200 && $data) {
        header("Content-Type: $contentType");
        echo $data;
    } else {
        header("HTTP/1.1 502 Bad Gateway");
        echo "Failed to fetch segment.";
    }
    exit;
}

// 🔹 Fetch master playlist
$master = fetch_m3u8($data['link'], $cookie);

if ($master) {
    // Fix relative paths
    $base = "https://bldcmprod-cdn.toffeelive.com/cdn/live/";
    $fixed = preg_replace('#\.\./#', $base, $master);

    // Extract all .m3u8 variants
    preg_match_all('#(https?://[^\s]+\.m3u8[^\s]*)#', $fixed, $matches);

    if (!empty($matches[1]) && isset($matches[1][1])) {
        $variant = $matches[1][1];
        $sub = fetch_m3u8($variant, $cookie);

        if ($sub) {
            // Proxy TS and KEY segments
            $sub = preg_replace('#(/live/[^\s]+\.ts)#', '?segment=$1', $sub);
            $sub = preg_replace('#URI="(/[^"]+)"#', 'URI="?segment=$1"', $sub);

            header("Content-Type: application/vnd.apple.mpegurl");
            echo $sub;
        } else {
            header("Content-Type: text/plain");
            echo "Failed to fetch 2nd playlist: $variant";
        }
    } else {
        header("Content-Type: text/plain");
        echo "2nd playlist not found in master playlist.";
    }
} else {
    header("Content-Type: text/plain");
    echo "Failed to fetch master playlist.";
}
