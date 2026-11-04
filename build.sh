#!/usr/bin/env bash
# Build the static site into _site/: a copy of the hand-written pages (no site generator).
#   ./build.sh          build only (what GitHub Actions runs)
#   ./build.sh --open   build, then serve _site/ on http://localhost:8000 (or the next free port)
#                       and open it in the browser; Ctrl+C stops the server
#   ./build.sh --edit   no build: serve the working files themselves (no browser opened), so an
#                       edited slide shows after a reload of the tab you already have open
# PORT=... picks another port.
set -euo pipefail
cd "$(dirname "$0")"

OPEN=0
BROWSER=1
SERVE=_site
for arg in "$@"; do
  case "$arg" in
    --open) OPEN=1 ;;
    --edit) OPEN=1; BROWSER=0; SERVE=. ;;
    *) echo "usage: ./build.sh [--open | --edit]" >&2; exit 2 ;;
  esac
done

if [ "$SERVE" = _site ]; then  # build (skipped by --edit)
  rm -rf _site
  mkdir _site
  rsync -a \
    --exclude '.*' --exclude archive --exclude _site --exclude ztest \
    --exclude README.md --exclude build.sh --exclude LICENSE \
    --exclude __marimo__ --exclude __pycache__ --exclude '*.py' \
    ./ _site/

  touch _site/.nojekyll
  echo "Built _site/"
fi

if [ "$OPEN" = 1 ]; then
  # Like `python3 -m http.server`, but tells the browser not to cache, so a rebuild shows up on reload.
  exec python3 - "${PORT:-8000}" "$SERVE" "$BROWSER" <<'PY'
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
if sys.argv[3] == "1":
    webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
PY
fi
