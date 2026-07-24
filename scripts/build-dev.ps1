param(
    [ValidatePattern("^https://")]
    [string]$AppOrigin = "https://d1koeltwri1n61.cloudfront.net"
)

$ErrorActionPreference = "Stop"

$PreviousDataSource = $env:VITE_DATA_SOURCE
$PreviousApiBaseUrl = $env:VITE_API_BASE_URL

try {
    $env:VITE_DATA_SOURCE = "api"
    $env:VITE_API_BASE_URL = $AppOrigin.TrimEnd("/")

    Write-Host "Building demo mode with real API authentication..."
    Write-Host "API origin: $env:VITE_API_BASE_URL"

    & npm.cmd run build:demo

    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed with exit code $LASTEXITCODE."
    }

    $Bundle = Get-ChildItem .\dist\assets\index-*.js |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $Bundle) {
        throw "No generated index-*.js bundle was found."
    }

    $ContainsApiOrigin = Select-String `
        -Path $Bundle.FullName `
        -Pattern $env:VITE_API_BASE_URL `
        -SimpleMatch `
        -Quiet

    if (-not $ContainsApiOrigin) {
        throw "The generated bundle does not contain the expected API origin."
    }

    Write-Host ""
    Write-Host "Dev frontend build succeeded."
    Write-Host "Bundle: $($Bundle.Name)"
    Write-Host "Data source: api"
}
finally {
    if ($null -eq $PreviousDataSource) {
        Remove-Item Env:VITE_DATA_SOURCE -ErrorAction SilentlyContinue
    }
    else {
        $env:VITE_DATA_SOURCE = $PreviousDataSource
    }

    if ($null -eq $PreviousApiBaseUrl) {
        Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:VITE_API_BASE_URL = $PreviousApiBaseUrl
    }
}