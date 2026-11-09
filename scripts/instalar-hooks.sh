#!/usr/bin/env bash
# Ativa os hooks versionados em scripts/hooks (proteção contra vazamento de chaves).
set -euo pipefail
cd "$(dirname "$0")/.."
chmod +x scripts/hooks/*
git config core.hooksPath scripts/hooks
echo "Hooks ativados: commits com chaves ou arquivos .env serão bloqueados."
