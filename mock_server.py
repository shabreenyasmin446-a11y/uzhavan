import json
import random
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

HOST = '0.0.0.0'
PORT = 8001

class Handler(BaseHTTPRequestHandler):
    def _set_json(self, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_POST(self):
        if self.path != '/api/detect':
            self._set_json(404)
            self.wfile.write(json.dumps({'error': 'Not found'}).encode())
            return

        # Read body but ignore content; just return a fake detection
        length = int(self.headers.get('content-length', 0))
        _ = self.rfile.read(length)

        w, h = 640, 480
        # generate 1-3 fake detections
        dets = []
        for _ in range(random.randint(1,3)):
            x = random.uniform(0, w*0.6)
            y = random.uniform(0, h*0.6)
            wbox = random.uniform(40, 200)
            hbox = random.uniform(40, 200)
            cls = random.choice(['Aphids','Caterpillar','Whitefly','HealthyLeaf'])
            score = round(random.uniform(0.6, 0.95), 2)
            dets.append({'bbox': [round(x,1), round(y,1), round(wbox,1), round(hbox,1)], 'class': cls, 'score': score})

        out = {'detections': dets}
        self._set_json(200)
        self.wfile.write(json.dumps(out).encode())


if __name__ == '__main__':
    print(f"Starting mock detection server on http://{HOST}:{PORT} (POST /api/detect)")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Stopping')
        server.server_close()
