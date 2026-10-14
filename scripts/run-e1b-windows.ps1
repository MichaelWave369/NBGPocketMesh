<#
.SYNOPSIS
Local, explicit E1-B experiment runner and E1-C audit for Windows.
.DESCRIPTION
No model downloads, package installation, or automatic execution.
Preflight is the default. Train/evaluate require explicit actions.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ModelDir,
    [ValidateSet('preflight', 'train', 'evaluate', 'audit')]
    [string]$Action = 'preflight',
    [string]$WorkDir = '',
    [ValidateSet('cpu', 'cuda')]
    [string]$Device = 'cpu',
    [string]$Python = 'python'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

if (-not (Test-Path -LiteralPath $ModelDir -PathType Container)) {
    throw "Local checkpoint folder does not exist: $ModelDir"
}
if ($Action -ne 'preflight' -and [string]::IsNullOrWhiteSpace($WorkDir)) {
    throw 'Use -WorkDir with train, evaluate, or audit; no default output path is inferred.'
}

if ($Action -eq 'audit') {
    $File = Join-Path $Repo 'scripts/e1c_audit.py'
    $Arguments = @($File, '--model-dir', $ModelDir, '--work-dir', $WorkDir)
} else {
    $File = Join-Path $Repo 'scripts/e1b_lab.py'
    $Arguments = @($File, $Action, '--model-dir', $ModelDir)
    if ($Action -ne 'preflight') {
        $Arguments += @('--work-dir', $WorkDir, '--device', $Device)
    }
}

Write-Host "PocketMesh: $Action (explicit local operator action)"
Write-Host 'Offline mode; no downloads or dependency installation by this wrapper.'
& $Python @Arguments
$ExitCode = $LASTEXITCODE
if ($ExitCode -ne 0) {
    throw "PocketMesh refused or failed (Python exit $ExitCode)."
}
