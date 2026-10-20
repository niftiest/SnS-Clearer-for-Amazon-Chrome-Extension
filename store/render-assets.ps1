# Renders the extension icons and the Chrome Web Store screenshots with headless Chrome.
# Output: extension/icons/icon{16,32,48,128}.png and store/screenshots/*.png (1280x800).
$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$src    = Join-Path $root 'store\src'
$icons  = Join-Path $root 'extension\icons'
$shots  = Join-Path $root 'store\screenshots'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profile = Join-Path $env:TEMP 'sns-clearer-render-profile'

New-Item -ItemType Directory -Force -Path $icons, $shots | Out-Null

# The popup rendered with mock chrome.* APIs instead of the real extension ones.
(Get-Content (Join-Path $root 'extension\popup.html') -Raw).Replace(
  '<script src="popup.js"></script>',
  '<script src="mock-chrome.js"></script><script src="../../extension/popup.js"></script>'
) | Set-Content (Join-Path $src 'popup-frame.html') -NoNewline

function Shot($url, $w, $h, $out) {
  & $chrome --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files `
    "--user-data-dir=$profile" --default-background-color=00000000 `
    --virtual-time-budget=3000 "--window-size=$w,$h" "--screenshot=$out" $url | Out-Null
  # chrome.exe hands off to a child process and returns before the file is written.
  for ($i = 0; $i -lt 50 -and -not (Test-Path $out); $i++) { Start-Sleep -Milliseconds 200 }
  if (-not (Test-Path $out)) { throw "Render failed: $out" }
  Write-Output "Rendered $out"
}

$srcUrl = 'file:///' + ($src -replace '\\', '/')
foreach ($s in 16, 32, 48, 128) {
  $page = Join-Path $src "icon-$s.html"
  "<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:${s}px;height:${s}px}</style><img src=`"icon.svg`">" |
    Set-Content $page
  $out = Join-Path $icons "icon$s.png"
  Remove-Item $out -ErrorAction SilentlyContinue
  Shot "$srcUrl/icon-$s.html" $s $s $out
  Remove-Item $page
}

$n = 1
foreach ($view in 'picker', 'confirm', 'progress') {
  $out = Join-Path $shots "$n-$view.png"
  Remove-Item $out -ErrorAction SilentlyContinue
  Shot "$srcUrl/screenshot.html?view=$view" 1280 800 $out
  $n++
}
