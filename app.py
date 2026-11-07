import os
import io
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO
from PIL import Image
import numpy as np

MODEL_PATH = os.environ.get('MODEL_PATH', 'yolov8n.pt')
MODEL_DEVICE = os.environ.get('MODEL_DEVICE', 'cpu')

app = FastAPI(title='YOLOv8 Detection Server')
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

model = None


@app.on_event('startup')
def load_model():
    global model
    try:
        model = YOLO(MODEL_PATH)
        print('Model loaded:', MODEL_PATH)
    except Exception as e:
        print('Failed to load model:', e)
        model = None


@app.get('/health')
def health():
    return { 'status': 'ok', 'model_loaded': model is not None, 'model_path': MODEL_PATH }


@app.post('/api/detect')
async def detect(file: UploadFile = File(...), request: Request = None):
    if model is None:
        raise HTTPException(status_code=503, detail='Model not loaded')

    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents)).convert('RGB')
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid image')

    img_np = np.array(img)

    # Run inference
    try:
        results = model.predict(source=img_np, device=MODEL_DEVICE, imgsz=640, conf=0.25)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Inference error: {e}')

    detections = []
    try:
        r = results[0]
        names = getattr(r, 'names', None) or getattr(model, 'names', {})
        boxes = getattr(r, 'boxes', None)
        if boxes is None:
            return JSONResponse({'detections': []})

        # Try tensor access
        try:
            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()
            clss = boxes.cls.cpu().numpy()
            for i in range(len(xyxy)):
                x1, y1, x2, y2 = [float(v) for v in xyxy[i]]
                w = x2 - x1
                h = y2 - y1
                cid = int(clss[i])
                label = names.get(cid, str(cid)) if isinstance(names, dict) else str(cid)
                detections.append({'bbox': [x1, y1, w, h], 'class': label, 'score': float(confs[i])})
        except Exception:
            # Fallback: iterate boxes
            for b in boxes:
                try:
                    coords = b.xyxy[0].tolist()
                    x1, y1, x2, y2 = coords
                    w = x2 - x1
                    h = y2 - y1
                    conf = float(getattr(b, 'conf', [0])[0])
                    clsid = int(getattr(b, 'cls', [0])[0])
                    label = names.get(clsid, str(clsid)) if isinstance(names, dict) else str(clsid)
                    detections.append({'bbox': [x1, y1, w, h], 'class': label, 'score': conf})
                except Exception:
                    continue
    except Exception as e:
        print('Postprocess error:', e)

    return JSONResponse({'detections': detections})


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('app:app', host='0.0.0.0', port=int(os.environ.get('PORT', 8000)), reload=False)
