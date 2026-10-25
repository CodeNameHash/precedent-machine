#!/bin/bash
# The production build check on a machine whose node_modules is a partial
# install (work package 45, plan finding (263)).
#
# `next build` needs tailwindcss and autoprefixer for the PostCSS step; this
# checkout's node_modules has neither (it is a partial pnpm store), so the
# build stops before it reaches any page — which is how a client-bundle
# break went unseen until Vercel found it. This script stubs the two
# PostCSS plugins in node_modules for the duration of the build (they are
# untracked and removed afterwards, on success or failure), runs the real
# `next build`, and reports its exit code. A stub makes no CSS; the build's
# purpose here is the JS/import graph, which is what breaks pages.
#
#   scripts/product/check-build.sh
#
# Exit code: next build's. The stubs are removed before exit either way.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE="${NODE:-node}"
cd "$ROOT" || exit 1

CREATED=()
stub() {
  local name="$1"
  # Never touch an install that is really there: on this machine the package
  # is absent, but on a full install (and through pnpm's store symlink) the
  # stub would overwrite and the cleanup would delete it.
  # A dangling symlink is not an install: stubbing beside it makes the
  # PostCSS step resolve, where keeping it would fail the build (the review
  # of 2026-10-25, finding 15).
  if [ -e "node_modules/$name" ]; then
    echo "keeping the installed node_modules/$name"
    return 0
  fi
  [ -L "node_modules/$name" ] && rm -f "node_modules/$name"
  mkdir -p "node_modules/$name"
  printf '{ "name": "%s", "version": "0.0.0-stub", "main": "index.js" }\n' "$name" > "node_modules/$name/package.json"
  printf "module.exports = function () { return { postcssPlugin: '%s-stub', Once() {} }; };\nmodule.exports.postcss = true;\n" "$name" > "node_modules/$name/index.js"
  CREATED+=("node_modules/$name")
}

cleanup() { for path in "${CREATED[@]:-}"; do [ -n "$path" ] && rm -rf "$path"; done; }
# A signal must stop the build, not resume it with one stub removed.
trap 'cleanup; exit 130' INT TERM
trap cleanup EXIT

stub tailwindcss
stub autoprefixer
"$NODE" node_modules/next/dist/bin/next build
