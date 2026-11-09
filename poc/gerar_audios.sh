#!/usr/bin/env bash
# Gera os áudios de exemplo a partir dos relatos fictícios, com vozes pt-BR do macOS.
# Requer macOS (comando say) e ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/exemplos"

gerar() {
  local voz="$1" nome="$2"
  say -v "$voz" -r 165 -o "$nome.aiff" -f "$nome.txt"
  ffmpeg -loglevel error -y -i "$nome.aiff" -ac 1 -ar 22050 -b:a 48k "$nome.mp3"
  rm "$nome.aiff"
  echo "ok: $nome.mp3 ($voz)"
}

gerar Luciana relato_01_dia_tranquilo
gerar Eddy relato_02_noite_dificil
gerar Flo relato_03_queda
