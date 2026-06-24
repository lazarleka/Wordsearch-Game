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

$env:MYSQL_PWD = $DbPassword
try {
    & $mysql.Source --host=localhost --port=3306 --user=$DbUsername --execute="SELECT 1" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL prijava nije uspjela. Provjeri lozinku."
    }

    Get-Content (Join-Path $backend "database\schema.sql") |
        & $mysql.Source --host=localhost --port=3306 --user=$DbUsername
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

Push-Location $backend
try {
    & .\mvnw.cmd spring-boot:run
}
finally {
    Pop-Location
}
