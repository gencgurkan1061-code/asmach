$ErrorActionPreference = "Stop"

$serverRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$serverRootPrefix = $serverRoot.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar
$appFileName = "ASMach_Teknik_Resim_Balonlama.html"

function Get-ContentType {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { return "text/html; charset=utf-8" }
        ".htm"  { return "text/html; charset=utf-8" }
        ".js"   { return "text/javascript; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".wasm" { return "application/wasm" }
        ".gz"   { return "application/gzip" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".ico"  { return "image/x-icon" }
        ".pdf"  { return "application/pdf" }
        default { return "application/octet-stream" }
    }
}

function Write-ResponseHeader {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.Stream] $Stream,

        [Parameter(Mandatory = $true)]
        [int] $StatusCode,

        [Parameter(Mandatory = $true)]
        [string] $ReasonPhrase,

        [Parameter(Mandatory = $true)]
        [string] $ContentType,

        [Parameter(Mandatory = $true)]
        [long] $ContentLength
    )

    $header = @(
        "HTTP/1.1 $StatusCode $ReasonPhrase"
        "Content-Type: $ContentType"
        "Content-Length: $ContentLength"
        "Cache-Control: no-cache"
        "X-Content-Type-Options: nosniff"
        "Referrer-Policy: no-referrer"
        "Connection: close"
        ""
        ""
    ) -join "`r`n"

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
}

function Write-TextResponse {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.Stream] $Stream,

        [Parameter(Mandatory = $true)]
        [int] $StatusCode,

        [Parameter(Mandatory = $true)]
        [string] $ReasonPhrase,

        [Parameter(Mandatory = $true)]
        [string] $Message,

        [bool] $HeadOnly = $false
    )

    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Message)
    Write-ResponseHeader `
        -Stream $Stream `
        -StatusCode $StatusCode `
        -ReasonPhrase $ReasonPhrase `
        -ContentType "text/plain; charset=utf-8" `
        -ContentLength $bodyBytes.Length

    if (-not $HeadOnly) {
        $Stream.Write($bodyBytes, 0, $bodyBytes.Length)
    }
}

function Test-PathWithoutReparsePoint {
    param(
        [Parameter(Mandatory = $true)]
        [string] $CandidatePath,

        [Parameter(Mandatory = $true)]
        [string] $RootPath
    )

    $current = [System.IO.FileInfo]::new($CandidatePath)
    while ($null -ne $current) {
        if ($current.FullName.Equals(
            $RootPath,
            [System.StringComparison]::OrdinalIgnoreCase
        )) {
            return $true
        }

        if (($current.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            return $false
        }

        $current = $current.Directory
    }

    return $false
}

function Resolve-SafeRequestPath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $RequestTarget
    )

    $queryIndex = $RequestTarget.IndexOf("?")
    if ($queryIndex -ge 0) {
        $RequestTarget = $RequestTarget.Substring(0, $queryIndex)
    }

    $fragmentIndex = $RequestTarget.IndexOf("#")
    if ($fragmentIndex -ge 0) {
        $RequestTarget = $RequestTarget.Substring(0, $fragmentIndex)
    }

    $decodedPath = [System.Uri]::UnescapeDataString($RequestTarget)
    if ($decodedPath.IndexOf([char] 0) -ge 0) {
        throw [System.ArgumentException]::new("İstek yolu geçersiz.")
    }

    $relativePath = $decodedPath.TrimStart(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )

    if ([string]::IsNullOrWhiteSpace($relativePath)) {
        $relativePath = $appFileName
    }

    $relativePath = $relativePath.Replace(
        [System.IO.Path]::AltDirectorySeparatorChar,
        [System.IO.Path]::DirectorySeparatorChar
    )

    if ([System.IO.Path]::IsPathRooted($relativePath)) {
        throw [System.UnauthorizedAccessException]::new("Kök dizin dışında erişime izin verilmez.")
    }

    $candidatePath = [System.IO.Path]::GetFullPath(
        [System.IO.Path]::Combine($serverRoot, $relativePath)
    )

    if (-not $candidatePath.StartsWith(
        $serverRootPrefix,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw [System.UnauthorizedAccessException]::new("Kök dizin dışında erişime izin verilmez.")
    }

    if (-not [System.IO.File]::Exists($candidatePath)) {
        return $null
    }

    if (-not (Test-PathWithoutReparsePoint -CandidatePath $candidatePath -RootPath $serverRoot)) {
        throw [System.UnauthorizedAccessException]::new("Bağlantılı dosya yollarına erişime izin verilmez.")
    }

    return $candidatePath
}

function Invoke-ClientRequest {
    param(
        [Parameter(Mandatory = $true)]
        [System.Net.Sockets.TcpClient] $Client
    )

    $Client.ReceiveTimeout = 5000
    $Client.SendTimeout = 30000
    $stream = $Client.GetStream()
    $reader = [System.IO.StreamReader]::new(
        $stream,
        [System.Text.Encoding]::ASCII,
        $false,
        4096,
        $true
    )

    try {
        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($requestLine)) {
            return
        }

        $headerLineCount = 0
        $headerCharacterCount = 0
        while ($true) {
            $headerLine = $reader.ReadLine()
            if ($null -eq $headerLine -or $headerLine.Length -eq 0) {
                break
            }

            $headerLineCount++
            $headerCharacterCount += $headerLine.Length
            if ($headerLineCount -gt 100 -or $headerCharacterCount -gt 32768) {
                Write-TextResponse `
                    -Stream $stream `
                    -StatusCode 431 `
                    -ReasonPhrase "Request Header Fields Too Large" `
                    -Message "İstek başlıkları çok büyük."
                return
            }
        }

        $requestParts = [System.Text.RegularExpressions.Regex]::Split(
            $requestLine.Trim(),
            "\s+"
        )
        if ($requestParts.Length -lt 3) {
            Write-TextResponse `
                -Stream $stream `
                -StatusCode 400 `
                -ReasonPhrase "Bad Request" `
                -Message "Geçersiz HTTP isteği."
            return
        }

        $method = $requestParts[0].ToUpperInvariant()
        $headOnly = $method -eq "HEAD"
        if ($method -ne "GET" -and -not $headOnly) {
            Write-TextResponse `
                -Stream $stream `
                -StatusCode 405 `
                -ReasonPhrase "Method Not Allowed" `
                -Message "Yalnızca GET ve HEAD yöntemleri desteklenir." `
                -HeadOnly $headOnly
            return
        }

        try {
            $filePath = Resolve-SafeRequestPath -RequestTarget $requestParts[1]
        }
        catch [System.UnauthorizedAccessException] {
            Write-TextResponse `
                -Stream $stream `
                -StatusCode 403 `
                -ReasonPhrase "Forbidden" `
                -Message "Bu dosyaya erişim reddedildi." `
                -HeadOnly $headOnly
            return
        }
        catch {
            Write-TextResponse `
                -Stream $stream `
                -StatusCode 400 `
                -ReasonPhrase "Bad Request" `
                -Message "Geçersiz dosya yolu." `
                -HeadOnly $headOnly
            return
        }

        if ($null -eq $filePath) {
            Write-TextResponse `
                -Stream $stream `
                -StatusCode 404 `
                -ReasonPhrase "Not Found" `
                -Message "Dosya bulunamadı." `
                -HeadOnly $headOnly
            return
        }

        $fileInfo = [System.IO.FileInfo]::new($filePath)
        Write-ResponseHeader `
            -Stream $stream `
            -StatusCode 200 `
            -ReasonPhrase "OK" `
            -ContentType (Get-ContentType -Path $filePath) `
            -ContentLength $fileInfo.Length

        if (-not $headOnly) {
            $fileStream = [System.IO.File]::Open(
                $filePath,
                [System.IO.FileMode]::Open,
                [System.IO.FileAccess]::Read,
                [System.IO.FileShare]::Read
            )
            try {
                $fileStream.CopyTo($stream)
            }
            finally {
                $fileStream.Dispose()
            }
        }

        $stream.Flush()
    }
    finally {
        $reader.Dispose()
    }
}

$listener = $null
$selectedPort = $null

try {
    foreach ($candidatePort in 8765..8775) {
        $candidateListener = $null
        try {
            $candidateListener = [System.Net.Sockets.TcpListener]::new(
                [System.Net.IPAddress]::Loopback,
                $candidatePort
            )
            $candidateListener.Start()
            $listener = $candidateListener
            $selectedPort = $candidatePort
            break
        }
        catch [System.Net.Sockets.SocketException] {
            if ($null -ne $candidateListener) {
                $candidateListener.Stop()
            }
        }
    }

    if ($null -eq $listener) {
        throw "8765-8775 aralığında kullanılabilir bir yerel bağlantı noktası bulunamadı."
    }

    $appUrl = "http://127.0.0.1:$selectedPort/$appFileName"

    Write-Host ""
    Write-Host "ASMach Balonlama yerel sunucusu çalışıyor." -ForegroundColor Cyan
    Write-Host "Adres: $appUrl"
    Write-Host "Sunucuyu durdurmak için Ctrl+C tuşlarına basın."
    Write-Host ""

    try {
        Start-Process -FilePath $appUrl | Out-Null
    }
    catch {
        Write-Warning "Tarayıcı otomatik açılamadı. Yukarıdaki adresi tarayıcıda açın."
    }

    while ($true) {
        if (-not $listener.Pending()) {
            Start-Sleep -Milliseconds 75
            continue
        }

        $client = $listener.AcceptTcpClient()
        try {
            Invoke-ClientRequest -Client $client
        }
        catch {
            Write-Warning "Bir yerel HTTP isteği işlenemedi: $($_.Exception.Message)"
        }
        finally {
            $client.Dispose()
        }
    }
}
finally {
    if ($null -ne $listener) {
        $listener.Stop()
    }

    Write-Host ""
    Write-Host "ASMach Balonlama yerel sunucusu durduruldu."
}
