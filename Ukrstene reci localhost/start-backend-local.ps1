param(
    [string]$DbUsername = "root",
    [string]$DbPassword = $env:DB_PASSWORD
)

$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $project "backend"
$knownMysql = "C:\Program Files\MySQL\MySQL Server 9.4\bin\mysql.exe"

if ([string]::IsNullOrWhiteSpace($DbPassword)) {
    $securePassword = Read-Host "Unesi MySQL lozinku za korisnika '$DbUsername'" -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $DbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

$mysql = Get-Command mysql.exe -ErrorAction SilentlyContinue
if (-not $mysql -and (Test-Path -LiteralPath $knownMysql)) {
    $mysql = Get-Item -LiteralPath $knownMysql
}
if (-not $mysql) {
    throw "mysql.exe nije pronadjen."
}
$mysqlPath = if ($mysql.Source) { $mysql.Source } else { $mysql.FullName }

$env:MYSQL_PWD = $DbPassword
try {
    & $mysqlPath --host=localhost --port=3306 --user=$DbUsername --execute="SELECT 1" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL prijava nije uspjela. Provjeri lozinku."
    }

    Get-Content (Join-Path $backend "database\schema.sql") |
        & $mysqlPath --host=localhost --port=3306 --user=$DbUsername
    if ($LASTEXITCODE -ne 0) {
        throw "Kreiranje ili azuriranje baze nije uspjelo."
    }
}
finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

$env:DB_HOST = "localhost"
$env:DB_PORT = "3306"
$env:DB_NAME = "ukrstene_reci"
$env:DB_USERNAME = $DbUsername
$env:DB_PASSWORD = $DbPassword
$env:DB_SSL_MODE = "DISABLED"
$env:PORT = "8082"

$backendEnv = Join-Path $backend ".env.local"
@(
    "DB_HOST=localhost",
    "DB_PORT=3306",
    "DB_NAME=ukrstene_reci",
    "DB_USERNAME=$DbUsername",
    "DB_PASSWORD=$DbPassword",
    "DB_SSL_MODE=DISABLED",
    "DB_POOL_SIZE=5",
    "PORT=8082"
) | Set-Content -LiteralPath $backendEnv -Encoding UTF8

Push-Location $backend
try {
    & .\mvnw.cmd spring-boot:run
}
finally {
    Pop-Location
}
