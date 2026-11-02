#!/usr/bin/env bash
# Build the static site into _site/: copy the hand-written pages, then export every lecture
# playground (a marimo notebook) as a WebAssembly app that runs Python in the browser.
#   ./build.sh          build only (what GitHub Actions runs)
#   ./build.sh --open   build, then serve _site/ on http://localhost:8000 (or the next free port)
#                       and open it in the browser; Ctrl+C stops the server
#   ./build.sh --edit   no build: serve the working files themselves, so an edited slide shows
#                       after a reload (the Python playgrounds are only in the built site)
# Uses `marimo` on PATH, or set MARIMO=/path/to/marimo; PORT=... picks another port.
set -euo pipefail
cd "$(dirname "$0")"
MARIMO="${MARIMO:-marimo}"

OPEN=0
SERVE=_site
for arg in "$@"; do
  case "$arg" in
    --open) OPEN=1 ;;
    --edit) OPEN=1; SERVE=. ;;
    *) echo "usage: ./build.sh [--open | --edit]" >&2; exit 2 ;;
  esac
done

if [ "$SERVE" = _site ]; then  # build (skipped by --edit)
  rm -rf _site
  mkdir _site
  rsync -a \
    --exclude '.*' --exclude archive --exclude _site --exclude ztest \
    --exclude README.md --exclude build.sh --exclude LICENSE \
    --exclude __marimo__ --exclude __pycache__ \
    ./ _site/

  shopt -s nullglob
  for nb in */lectures/*/playground.py; do
    out="_site/$(dirname "$nb")/playground"
    echo "Exporting $nb -> $out"
    # no stdin, so marimo never stops to ask a question; its "how to serve this" hints are hidden
    "$MARIMO" export html-wasm "$nb" -o "$out" --mode edit -f </dev/null >/dev/null
    # Exported notebooks wait for a click on "Run all"; ours should run as soon as they load.
    sed -i.bak 's/"auto_instantiate": false/"auto_instantiate": true/' "$out/index.html"
    rm -f "$out/index.html.bak" "$out/CLAUDE.md"
  done

  touch _site/.nojekyll
  echo "Built _site/"
fi

if [ "$OPEN" = 1 ]; then
  # Like `python3 -m http.server`, but tells the browser not to cache, so a rebuild shows up on reload.
  exec python3 - "${PORT:-8000}" "$SERVE" <<'PY'
import functools, http.server, sys, webbrowser

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

handler = functools.partial(NoCache, directory=sys.argv[2])
port = int(sys.argv[1])
for p in range(port, port + 20):
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", p), handler)
        break
    except OSError:
        continue
else:
    sys.exit(f"No free port in {port}-{port + 19}")

url = f"http://localhost:{p}/"
print(f"Serving {sys.argv[2]} at {url}  (Ctrl+C to stop)", flush=True)
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
PY
fi
