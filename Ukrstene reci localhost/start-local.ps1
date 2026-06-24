param(
    [string]$DbUsername = "root"
)

$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path (Join-Path $project "node_modules"))) {
    Push-Location $project
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install nije uspio." }
    }
    finally {
        Pop-Location
    }
}

Start-Process -FilePath "powershell.exe" `
    -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File", (Join-Path $project "start-backend-local.ps1"),
        "-DbUsername", $DbUsername
    ) `
    -WorkingDirectory $project

Push-Location $project
try {
    npm run dev:frontend
}
finally {
    Pop-Location
}
