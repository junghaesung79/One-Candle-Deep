#!/bin/sh
# src/ 조각을 합쳐 단일 파일 index.html 을 만들어요
cd "$(dirname "$0")"
{
  cat src/head.html 2>/dev/null
  echo '<script>'
  cat src/core.js
  echo '</script>'
  if [ -f src/sprites.js ]; then echo '<script>'; cat src/sprites.js; echo '</script>'; fi
  if [ -f src/ui.js ]; then echo '<script>'; cat src/ui.js; echo '</script>'; fi
  cat src/tail.html 2>/dev/null
} > index.html
