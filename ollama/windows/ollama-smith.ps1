param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('healthcheck','start','stop','pull','test','agents','backup','build-smith')]
  [string]$Action
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ModelsFile = Join-Path $Root 'models.txt'
$BackupDir = Join-Path $Root 'backups'
$DefaultModel = 'llama3.2:3b'
$OllamaHost = 'http://127.0.0.1:11434'

function Write-Title($Text) {
  Write-Host "`n=== $Text ===" -ForegroundColor Cyan
}

function Require-Ollama {
  $cmd = Get-Command ollama -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Host 'Ollama nu este găsit în PATH. Instalează Ollama sau repornește PowerShell.' -ForegroundColor Red
    exit 1
  }
}

switch ($Action) {
  'healthcheck' {
    Write-Title 'Smith Ollama Healthcheck'
    Get-Command ollama -ErrorAction SilentlyContinue
    ollama --version
    Get-Service *ollama* -ErrorAction SilentlyContinue | Format-Table -AutoSize
    try { Invoke-RestMethod "$OllamaHost/api/tags" | ConvertTo-Json -Depth 5 } catch { Write-Host "API Ollama nu răspunde: $($_.Exception.Message)" -ForegroundColor Yellow }
    ollama list
  }

  'start' {
    Write-Title 'Start Ollama service'
    $svc = Get-Service *ollama* -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($svc) { Start-Service $svc.Name -ErrorAction SilentlyContinue; Get-Service $svc.Name } else { Start-Process ollama -ArgumentList 'serve' }
  }

  'stop' {
    Write-Title 'Stop Ollama service'
    $svc = Get-Service *ollama* -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($svc) { Stop-Service $svc.Name -ErrorAction SilentlyContinue; Get-Service $svc.Name } else { Write-Host 'Serviciu Ollama negăsit.' -ForegroundColor Yellow }
  }

  'pull' {
    Require-Ollama
    Write-Title 'Pull Smith models'
    if (-not (Test-Path $ModelsFile)) { Write-Host "Lipsește $ModelsFile" -ForegroundColor Red; exit 1 }
    Get-Content $ModelsFile | Where-Object { $_ -and -not $_.Trim().StartsWith('#') } | ForEach-Object {
      $m = $_.Trim()
      Write-Host "Pull: $m"
      ollama pull $m
    }
  }

  'build-smith' {
    Require-Ollama
    Write-Title 'Build local Smith model'
    Push-Location $Root
    ollama create smith-local -f .\Modelfile-smith
    Pop-Location
    ollama list
  }

  'test' {
    Require-Ollama
    Write-Title 'Test Ollama model'
    ollama run $DefaultModel "Răspunde scurt: sistemul Ollama funcționează pentru Smith?"
  }

  'agents' {
    Require-Ollama
    Write-Title 'Run Smith agents smoke test'
    $AgentFile = Join-Path $Root 'agents\agents.yaml'
    if (Test-Path $AgentFile) { Get-Content $AgentFile | Select-Object -First 80 }
    ollama run $DefaultModel "Ești Smith Architect. Fă un plan scurt: audit, backup, securitate, SEO, execuție."
  }

  'backup' {
    Write-Title 'Backup Ollama config and model manifest'
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $out = Join-Path $BackupDir "ollama-backup-$ts"
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    ollama list | Out-File (Join-Path $out 'ollama-list.txt') -Encoding UTF8
    Copy-Item $ModelsFile (Join-Path $out 'models.txt') -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $Root 'Modelfile-smith') (Join-Path $out 'Modelfile-smith') -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $Root 'agents\agents.yaml') (Join-Path $out 'agents.yaml') -ErrorAction SilentlyContinue
    Compress-Archive -Path $out -DestinationPath "$out.zip" -Force
    Write-Host "Backup creat: $out.zip"
  }
}
