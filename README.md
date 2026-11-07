YOLOv8 Detection Server
======================

This is a minimal FastAPI server that runs an Ultralytics YOLOv8 model to detect objects in uploaded images and returns JSON detections compatible with the client in `yuva/script.js`.

Endpoints
- POST /api/detect  : Accepts multipart form file (image) and returns JSON { detections: [ {bbox:[x,y,w,h], class: 'name', score: 0.9}, ... ] }
- GET /health       : Returns simple health JSON

Quick start (CPU)

1. Create and activate a Python venv:

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. Download a YOLOv8 model (recommended: yolov8n.pt for quick start, or yolov8l.pt for higher accuracy):

```bash
# example
wget https://ultralytics.com/assets/ultralytics/yolov8n.pt -O yolov8n.pt
```

3. Run the server (point MODEL_PATH env to the model file if not in project root):

```bash
MODEL_PATH=./yolov8n.pt uvicorn app:app --host 0.0.0.0 --port 8000
```

Docker (CPU)

Build and run:

```bash
docker build -t yolo-server .
docker run -p 8000:8000 -e MODEL_PATH=/app/yolov8n.pt yolo-server
```

Notes
- For best accuracy, run on a GPU and use a larger model like `yolov8l.pt` or `yolov8x.pt` and use NVIDIA runtime for the container.
- The client expects response JSON: `{ detections: [ {bbox:[x,y,w,h], class: 'label', score: float}, ... ] }`.
