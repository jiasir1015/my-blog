#!/usr/bin/env bash
# Cloudflare / CI Hugo build helper.
# Uses system hugo if present; otherwise downloads Hugo Extended for Linux.
set -euo pipefail

HUGO_VERSION="${HUGO_VERSION:-0.155.3}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

need_download=0
if ! command -v hugo >/dev/null 2>&1; then
  need_download=1
elif ! hugo version 2>/dev/null | grep -qi extended; then
  # PaperMod / asset pipeline needs extended
  need_download=1
fi

if [[ "$need_download" -eq 1 ]]; then
  arch="$(uname -m)"
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  case "${os}-${arch}" in
    linux-x86_64|linux-amd64) asset="hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz" ;;
    linux-aarch64|linux-arm64) asset="hugo_extended_${HUGO_VERSION}_linux-arm64.tar.gz" ;;
    darwin-arm64) asset="hugo_extended_${HUGO_VERSION}_darwin-universal.tar.gz" ;;
    darwin-x86_64) asset="hugo_extended_${HUGO_VERSION}_darwin-universal.tar.gz" ;;
    *)
      echo "Unsupported platform: ${os}-${arch}" >&2
      exit 1
      ;;
  esac

  echo "==> downloading Hugo Extended v${HUGO_VERSION} (${asset})"
  tmp="$(mktemp -d)"
  url="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${asset}"
  curl -fsSL "$url" -o "$tmp/hugo.tgz"
  tar -xzf "$tmp/hugo.tgz" -C "$tmp" hugo
  export PATH="$tmp:$PATH"
fi

echo "==> $(hugo version)"

# Prefer explicit env, then Cloudflare Pages URL, then hugo.toml baseURL.
args=(--minify --gc)
if [[ -n "${HUGO_BASEURL:-}" ]]; then
  args+=(-b "$HUGO_BASEURL")
  echo "==> baseURL=$HUGO_BASEURL (HUGO_BASEURL)"
elif [[ -n "${CF_PAGES_URL:-}" ]]; then
  args+=(-b "$CF_PAGES_URL")
  echo "==> baseURL=$CF_PAGES_URL (CF_PAGES_URL)"
fi

# PaperMod is a git submodule — fail early with a clear message
if [[ ! -f themes/PaperMod/theme.toml ]]; then
  echo "ERROR: themes/PaperMod missing. Enable git submodules in Cloudflare build settings." >&2
  exit 1
fi

hugo "${args[@]}"
echo "==> build done → public/"
