# Takes screenshots of the prototype with headless Microsoft Edge.
# Usage: shoot.ps1 -OutDir <dir> -Shots "name|path|width|height;name|path|width|height"
# Needs the dev server running (default http://localhost:5173).
# Widths under 600 are rendered inside frame.html (Edge cannot open a window
# that narrow) at an exact size, and the image is cropped to the frame.
param(
  [Parameter(Mandatory = $true)][string]$OutDir,
  [Parameter(Mandatory = $true)][string]$Shots,
  [string]$Base = 'http://localhost:5173'
)

Add-Type -AssemblyName System.Drawing
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$frame = 'file:///' + (Join-Path $PSScriptRoot 'frame.html').Replace('\', '/')
# Edge writes nothing, without an error, when given a relative output path.
$OutDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutDir)
New-Item -ItemType Directory -Force $OutDir | Out-Null

foreach ($shot in $Shots.Split(';')) {
  $name, $path, $width, $height = $shot.Split('|')
  $width = [int]$width
  $height = [int]$height
  $profile = Join-Path $env:TEMP ("idr-shot-" + [guid]::NewGuid().ToString('N'))
  $file = Join-Path $OutDir "$name.png"
  $narrow = $width -lt 600
  $scale = if ($narrow) { 2 } else { 1 }
  # The window is larger than the frame, so the frame's size never depends on it.
  $windowWidth = if ($narrow) { 700 } else { $width }
  $windowHeight = if ($narrow) { $height + 200 } else { $height }
  $url = "$Base$path"
  if ($narrow) { $url = "$frame`?w=$width&h=$height&src=" + [uri]::EscapeDataString($url) }
  $arguments = @(
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    "--force-device-scale-factor=$scale", "--window-size=$windowWidth,$windowHeight",
    '--virtual-time-budget=8000', "--user-data-dir=$profile",
    "--screenshot=$file", "`"$url`""
  )
  Start-Process -FilePath $edge -ArgumentList $arguments -Wait -WindowStyle Hidden
  Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
  if (-not (Test-Path $file)) { "FAIL $name"; continue }
  if ($narrow) {
    $source = [System.Drawing.Image]::FromFile($file)
    $cropHeight = [Math]::Min($height * $scale, $source.Height)
    $area = New-Object System.Drawing.Rectangle 0, 0, ($width * $scale), $cropHeight
    $cropped = ([System.Drawing.Bitmap]$source).Clone($area, $source.PixelFormat)
    $source.Dispose()
    $cropped.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    $cropped.Dispose()
  }
  "ok   $name"
}
