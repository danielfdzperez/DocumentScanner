"""Servidor estático local (alternativa a serve.mjs si no tienes Node).

Uso:  python LocalTest/serve.py [puerto]        (por defecto 8080)

Fuerza el tipo MIME correcto para .js: en Windows `python -m http.server` puede servirlo
como text/plain y el navegador rechaza entonces los módulos ES.
"""
import functools
import http.server
import mimetypes
import pathlib
import sys

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/json", ".json")

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("", PORT), handler) as httpd:
        print(f"\n  Document Scanner (local)\n\n  PC: http://localhost:{PORT}/\n\n  Ctrl+C para parar.\n")
        httpd.serve_forever()
