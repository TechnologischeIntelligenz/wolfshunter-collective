$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Resolve-Path (Join-Path $scriptDir "..")

Set-Location $appRoot
$env:NODE_ENV = "production"

& "C:\Program Files\nodejs\node.exe" "scripts/start.mjs" "./build/server/index.js"
exit $LASTEXITCODE
