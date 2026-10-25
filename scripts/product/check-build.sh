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

stub() {
  local name="$1"
  mkdir -p "node_modules/$name"
  printf '{ "name": "%s", "version": "0.0.0-stub", "main": "index.js" }\n' "$name" > "node_modules/$name/package.json"
  printf "module.exports = function () { return { postcssPlugin: '%s-stub', Once() {} }; };\nmodule.exports.postcss = true;\n" "$name" > "node_modules/$name/index.js"
}

cleanup() { rm -rf "node_modules/tailwindcss" "node_modules/autoprefixer"; }
trap cleanup EXIT INT TERM

stub tailwindcss
stub autoprefixer
"$NODE" node_modules/next/dist/bin/next build
