#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODELS_FILE="$ROOT/models.txt"
BACKUP_DIR="$ROOT/backups"
DEFAULT_MODEL="${SMITH_DEFAULT_MODEL:-llama3.2:3b}"
OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"

usage() {
  echo "Usage: $0 {healthcheck|start|stop|pull|test|agents|backup|build-smith}"
}

title() {
  echo
  echo "=== $1 ==="
}

require_ollama() {
  if ! command -v ollama >/dev/null 2>&1; then
    echo "Ollama nu este instalat sau nu este în PATH." >&2
    exit 1
  fi
}

case "$ACTION" in
  healthcheck)
    title "Smith Ollama Healthcheck"
    command -v ollama || true
    ollama --version || true
    systemctl status ollama --no-pager || true
    curl -s "$OLLAMA_HOST/api/tags" || true
    echo
    ollama list || true
    ;;

  start)
    title "Start Ollama"
    if command -v systemctl >/dev/null 2>&1; then
      sudo systemctl start ollama || ollama serve
    else
      ollama serve
    fi
    ;;

  stop)
    title "Stop Ollama"
    if command -v systemctl >/dev/null 2>&1; then
      sudo systemctl stop ollama || true
    else
      pkill -f "ollama serve" || true
    fi
    ;;

  pull)
    require_ollama
    title "Pull Smith models"
    if [ ! -f "$MODELS_FILE" ]; then
      echo "Lipsește $MODELS_FILE" >&2
      exit 1
    fi
    while IFS= read -r model; do
      [[ -z "$model" || "$model" =~ ^# ]] && continue
      echo "Pull: $model"
      ollama pull "$model"
    done < "$MODELS_FILE"
    ;;

  build-smith)
    require_ollama
    title "Build local Smith model"
    cd "$ROOT"
    ollama create smith-local -f Modelfile-smith
    ollama list
    ;;

  test)
    require_ollama
    title "Test Ollama model"
    ollama run "$DEFAULT_MODEL" "Răspunde scurt: sistemul Ollama funcționează pentru Smith?"
    ;;

  agents)
    require_ollama
    title "Run Smith agents smoke test"
    sed -n '1,140p' "$ROOT/agents/agents.yaml" || true
    ollama run "$DEFAULT_MODEL" "Ești Smith Architect. Fă un plan scurt: audit, backup, securitate, SEO, execuție."
    ;;

  backup)
    require_ollama
    title "Backup Ollama config and model manifest"
    mkdir -p "$BACKUP_DIR"
    TS="$(date +%Y%m%d-%H%M%S)"
    OUT="$BACKUP_DIR/ollama-backup-$TS"
    mkdir -p "$OUT"
    ollama list > "$OUT/ollama-list.txt" 2>&1 || true
    cp "$MODELS_FILE" "$OUT/models.txt" 2>/dev/null || true
    cp "$ROOT/Modelfile-smith" "$OUT/Modelfile-smith" 2>/dev/null || true
    cp "$ROOT/agents/agents.yaml" "$OUT/agents.yaml" 2>/dev/null || true
    tar -czf "$OUT.tar.gz" -C "$BACKUP_DIR" "ollama-backup-$TS"
    echo "Backup creat: $OUT.tar.gz"
    ;;

  *)
    usage
    exit 1
    ;;
esac
