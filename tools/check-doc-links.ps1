# Fails when a relative link or image in a tracked Markdown file points to a
# file that does not exist. docs/archive/ is skipped: archived documents are
# kept as written. Run from anywhere: pwsh tools/check-doc-links.ps1
$root = (git -C $PSScriptRoot rev-parse --show-toplevel).Trim()
$files = git -C $root ls-files '*.md' | Where-Object { $_ -notlike 'docs/archive/*' }
$broken = 0
foreach ($f in $files) {
  $full = Join-Path $root $f
  $dir = Split-Path $full -Parent
  $text = Get-Content -Raw -LiteralPath $full
  foreach ($m in [regex]::Matches($text, '\]\(([^)\s#]+)(#[^)]*)?\)')) {
    $target = $m.Groups[1].Value
    if ($target -match '^[a-z]+:') { continue }  # http:, https:, mailto: ...
    if (-not (Test-Path -LiteralPath (Join-Path $dir $target))) {
      Write-Output "Broken link in ${f}: $target"
      $broken++
    }
  }
}
Write-Output "Checked $($files.Count) Markdown files: $broken broken links."
if ($broken -gt 0) { exit 1 }
