# Takes the full design-review screenshot set: every screen at 390px and
# 1280px, owner screens in English and Turkish. Each shot comes from a fresh
# browser, so every shot shows the starting demo data.
# Retakes any phone shot whose bottom navigation is missing, a capture glitch
# in headless Edge. Look at every image before using it anyway.
# Needs the dev server on http://localhost:5173 and Microsoft Edge.
# When screens are added or change length, update the list below.
param([Parameter(Mandatory = $true)][string]$OutDir)

Add-Type -AssemblyName System.Drawing
$shoot = Join-Path $PSScriptRoot 'shoot.ps1'
$OutDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutDir)
$p = '/rooms/home-meals'
$shots = @(
  "join-390-en|$p/join?as=hasan&lang=en|390|844", "join-390-tr|$p/join?as=hasan&lang=tr|390|844",
  "join-1280-en|$p/join?as=hasan&lang=en|1280|800", "join-1280-tr|$p/join?as=hasan&lang=tr|1280|800",
  "idea-390-en|$p`?as=hasan&lang=en|390|844", "idea-390-tr|$p`?as=hasan&lang=tr|390|844",
  "idea-1280-en|$p`?as=hasan&lang=en|1280|800", "idea-1280-tr|$p`?as=hasan&lang=tr|1280|800",
  "idea-390-en-full|$p`?as=hasan&lang=en|390|3900", "idea-390-tr-full|$p`?as=hasan&lang=tr|390|4000",
  "idea-1280-en-full|$p`?as=hasan&lang=en|1280|1950", "idea-1280-tr-full|$p`?as=hasan&lang=tr|1280|1950",
  "discussion-390-en|$p/discussion?as=tom&lang=en|390|844", "discussion-390-tr|$p/discussion?as=elif&lang=tr|390|844",
  "discussion-1280-en|$p/discussion?as=tom&lang=en|1280|800", "discussion-1280-tr|$p/discussion?as=elif&lang=tr|1280|800",
  "summary-390-en|$p/summary?as=tom&lang=en|390|844", "summary-390-tr|$p/summary?as=elif&lang=tr|390|844",
  "summary-1280-en|$p/summary?as=tom&lang=en|1280|800", "summary-1280-tr|$p/summary?as=elif&lang=tr|1280|800",
  "summary-390-en-full|$p/summary?as=tom&lang=en|390|3300", "summary-390-tr-full|$p/summary?as=elif&lang=tr|390|3400",
  "summary-1280-en-full|$p/summary?as=tom&lang=en|1280|1500", "summary-1280-tr-full|$p/summary?as=elif&lang=tr|1280|1600",
  "summary-390-burak|$p/summary?as=burak&lang=en|390|3500", "summary-1280-burak|$p/summary?as=burak&lang=en|1280|1600",
  "queue-390-en|$p/queue?as=burak&lang=en|390|844", "queue-1280-en|$p/queue?as=burak&lang=en|1280|800",
  "queue-390-en-full|$p/queue?as=burak&lang=en|390|4300", "queue-1280-en-full|$p/queue?as=burak&lang=en|1280|2400",
  "queue-1280-tr|$p/queue?as=burak&lang=tr|1280|800",
  "notes-390-en|$p/notes?as=burak&lang=en|390|844", "notes-1280-en|$p/notes?as=burak&lang=en|1280|800",
  "notes-390-en-full|$p/notes?as=burak&lang=en|390|2700", "notes-1280-en-full|$p/notes?as=burak&lang=en|1280|1500",
  "rooms-390-en|/rooms?as=burak&lang=en|390|1150", "rooms-1280-en|/rooms?as=burak&lang=en|1280|800",
  "idea-1280-example|/rooms/example?as=burak&lang=en|1280|900"
)

function Test-Bottom($file) {
  if (-not (Test-Path $file)) { return 0 }
  $bitmap = [System.Drawing.Bitmap]::FromFile($file); $dark = 0
  for ($y = $bitmap.Height - 110; $y -lt $bitmap.Height - 10; $y += 4) {
    for ($x = 0; $x -lt $bitmap.Width; $x += 6) { if ($bitmap.GetPixel($x, $y).R -lt 200) { $dark++ } }
  }
  $bitmap.Dispose(); return $dark
}

powershell -NoProfile -ExecutionPolicy Bypass -File $shoot -OutDir $OutDir -Shots ($shots -join ';') | Out-Null

foreach ($attempt in 1..4) {
  # The rooms list has no bottom navigation, so it is checked by file size instead.
  $retake = $shots | Where-Object {
    $name = $_.Split('|')[0]
    $file = Join-Path $OutDir "$name.png"
    if (-not (Test-Path $file)) { return $true }
    if ($name -like 'rooms-390-*') { return (Get-Item $file).Length -lt 30000 }
    if ($name -like '*-390-*') { return (Test-Bottom $file) -eq 0 }
    return (Get-Item $file).Length -lt 30000
  }
  if (-not $retake) { break }
  "retaking: " + (($retake | ForEach-Object { $_.Split('|')[0] }) -join ', ')
  powershell -NoProfile -ExecutionPolicy Bypass -File $shoot -OutDir $OutDir -Shots ($retake -join ';') | Out-Null
}
"done: " + (Get-ChildItem $OutDir -Filter *.png).Count + " screenshots"
