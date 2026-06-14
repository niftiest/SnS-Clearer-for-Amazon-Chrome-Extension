# Builds the installable extension zip from the extension/ folder.
# Output: dist/amazon-sns-clearer.zip (manifest.json sits at the zip root).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'extension'
$dist = Join-Path $root 'dist'
$zip  = Join-Path $dist 'amazon-sns-clearer.zip'

if (-not (Test-Path $dist)) { New-Item -ItemType Directory -Path $dist | Out-Null }
if (Test-Path $zip) { Remove-Item $zip -Force }

Compress-Archive -Path (Join-Path $src '*') -DestinationPath $zip -Force
Write-Output "Built $zip"
Get-ChildItem $zip | Select-Object Name, Length, LastWriteTime | Format-List
