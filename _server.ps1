$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:3000/")
$listener.Start()
Write-Host "Server running at http://localhost:3000/"
Write-Host "Admin panel: http://localhost:3000/admin/"
Write-Host "Press Ctrl+C to stop."

$root = "d:\download\WebStore-main\WebStore-main"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $localPath = $ctx.Request.Url.LocalPath
    if ($localPath -eq "/" -or $localPath -eq "") { $localPath = "/index.html" }
    if ($localPath.EndsWith("/")) { $localPath += "index.html" }

    $filePath = Join-Path $root ($localPath.Replace("/", "\"))

    if (Test-Path $filePath -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = switch ($ext) {
            ".html" { "text/html; charset=utf-8" }
            ".js"   { "application/javascript; charset=utf-8" }
            ".css"  { "text/css; charset=utf-8" }
            ".json" { "application/json" }
            ".jpeg" { "image/jpeg" }
            ".jpg"  { "image/jpeg" }
            ".png"  { "image/png" }
            ".svg"  { "image/svg+xml" }
            ".webp" { "image/webp" }
            ".ico"  { "image/x-icon" }
            ".woff2" { "font/woff2" }
            ".woff" { "font/woff" }
            default { "application/octet-stream" }
        }
        $ctx.Response.ContentType = $contentType
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $localPath")
        $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.Close()
}
