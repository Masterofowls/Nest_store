$ErrorActionPreference = 'Stop'
$exitCode = 0

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    foreach ($script in @('format', 'lint', 'typecheck', 'build')) {
        & npm.cmd run $script
        if ($LASTEXITCODE -ne 0) {
            $exitCode = $LASTEXITCODE
            Write-Warning "npm run $script failed with exit code $exitCode."
            break
        }
    }
}
finally {
    Pop-Location
}

exit $exitCode
