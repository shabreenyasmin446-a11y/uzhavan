import random
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import math

app = FastAPI(title="Smart Farming AI Assistant")

# Mount static files for images
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mock Data
SCHEMES = [
    {
        "id": 1,
        "name": "PM-Kisan Samman Nidhi",
        "description": "Get ₹6,000 yearly in three installments directly into your bank account.",
        "category": "Direct Benefit",
        "eligibility": "Small and marginal farmers",
        "link": "https://pmkisan.gov.in/"
    },
    {
        "id": 2,
        "name": "Pradhan Mantri Fasal Bima Yojana",
        "description": "Ensure your crops against natural calamities, pests or diseases.",
        "category": "Insurance",
        "eligibility": "All farmers including sharecroppers",
        "link": "https://pmfby.gov.in/"
    },
    {
        "id": 3,
        "name": "Soil Health Card Scheme",
        "description": "Get info on soil nutrient status and recommendations for fertilizers.",
        "category": "Technology",
        "eligibility": "All farmers",
        "link": "https://www.soilhealth.dac.gov.in/"
    },
    {
        "id": 4,
        "name": "Kisan Credit Card (KCC)",
        "description": "Easy access to credit for agricultural needs at low interest rates.",
        "category": "Finance",
        "eligibility": "All farmers, SHGs, and tenant farmers",
        "link": "https://www.kisancreditcard.org/"
    }
]

BANKS = [
    {"name": "State Bank of India (Agri-Branch)", "distance": "1.2 km", "address": "Main Market Road", "phone": "+91 1800 123 456"},
    {"name": "NABARD Rural Bank", "distance": "2.5 km", "address": "Village Square", "phone": "+91 1800 987 654"},
    {"name": "HDFC Farmer Suvidha Bank", "distance": "3.8 km", "address": "Tehsil Road", "phone": "+91 1800 456 789"},
    {"name": "Punjab National Bank", "distance": "5.0 km", "address": "National Highway 44", "phone": "+91 1800 654 321"}
]

# Models
class LoginRequest(BaseModel):
    phone: int

class OTPVerifyRequest(BaseModel):
    phone: int
    otp: int

class CalculatorRequest(BaseModel):
    crop: str
    area: float
    unit: str # 'acres' or 'hectares'

class ChatRequest(BaseModel):
    message: str

class PestCalcRequest(BaseModel):
    pest_name: str
    treatment_type: str
    area_sqm: float
    ratio_ml_per_L: float

# Endpoints
@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/style.css")
async def get_style():
    return FileResponse("style.css")

@app.get("/script.js")
async def get_script():
    return FileResponse("script.js")

@app.post("/api/login")
async def login(request: LoginRequest):
    # Simulate sending OTP
    return {"status": "success", "message": "OTP sent successfully to " + request.phone}

@app.post("/api/verify-otp")
async def verify_otp(request: OTPVerifyRequest):
    if request.otp == "1234": # Mock OTP
        return {"status": "success", "token": "session_farm_123"}
    else:
        raise HTTPException(status_code=400, detail="Invalid OTP")

@app.get("/api/schemes")
async def get_schemes():
    return SCHEMES

@app.get("/api/banks")
async def get_banks(lat: float = 0, lon: float = 0):
    # In a real app, use lat/lon to search spatial data. Here we return mock list.
    return BANKS

@app.post("/api/calculate-fertilizer")
async def calculate_fertilizer(request: CalculatorRequest):
    # Mock calculation logic
    # Typical NPK ratios for Rice: 100-50-50 kg/hectare
    # 1 hectare = 2.47 acres
    multiplier = request.area if request.unit == "hectares" else request.area / 2.47
    
    crops = {
        "rice": {"urea": 215 * multiplier, "dap": 110 * multiplier, "mop": 85 * multiplier},
        "wheat": {"urea": 240 * multiplier, "dap": 125 * multiplier, "mop": 60 * multiplier},
        "maize": {"urea": 260 * multiplier, "dap": 150 * multiplier, "mop": 100 * multiplier}
    }
    
    result = crops.get(request.crop.lower(), {"urea": 100 * multiplier, "dap": 50 * multiplier, "mop": 50 * multiplier})
    
    return {
        "crop": request.crop,
        "area": request.area,
        "recommendation": {
            "Urea": f"{round(result['urea'], 2)} kg",
            "DAP": f"{round(result['dap'], 2)} kg",
            "MOP": f"{round(result['mop'], 2)} kg"
        },
        "tips": "Apply Urea in 3 split doses for better results."
    }

@app.post("/api/chat")
async def chat(request: ChatRequest):
    msg = request.message.lower()
    responses = {
        "hello": "Hello Farmer! How can I help you today with your crops or schemes?",
        "pm kisan": "PM-Kisan provides ₹6,000 yearly to farmers. You can check your status in the Schemes section.",
        "pests": "For general pests, ensure proper weed management. Which crop are you asking about?",
        "weather": "Currently, local weather shows clear skies. Good time for spraying if wind is low.",
        "loan": "You can find nearby banks for agricultural loans in the 'Bank Locator' section."
    }
    
    response = "I'm your AI Farm Assistant. I can help with schemes, fertilizer math, and crop advice. Try asking about 'PM Kisan' or 'fertilizer'."
    for key in responses:
        if key in msg:
            response = responses[key]
            break
            
    return {"reply": response}

@app.post("/api/analyze-pest")
async def analyze_pest(file: UploadFile = File(...)):
    # Mock Computer Vision / YOLOv8 Processing
    # In reality, you would pass `file` bytes to a local TensorFlow/YOLO model
    pests = ["Aphids", "Spider Mites", "Whiteflies", "Caterpillars"]
    pest = random.choice(pests)
    confidence = random.randint(80, 95)
    
    return {
        "status": "success",
        "pest": pest,
        "confidence": f"{confidence}%",
        "message": f"YOLOv8 successfully processed the image. Identified {pest}."
    }

@app.post("/api/calculate-pesticide")
async def calculate_pesticide(req: PestCalcRequest):
    # Calculation Logic
    # Assumption: 1 liter of water reliably covers ~10 sq meters of crop canopy
    total_water_liters = req.area_sqm / 10.0
    total_chemical_ml = total_water_liters * req.ratio_ml_per_L
    
    return {
        "pest": req.pest_name,
        "treatment_type": req.treatment_type,
        "ingredients": {
            "water": f"{math.ceil(total_water_liters)} Liters",
            "chemical": f"{round(total_chemical_ml, 1)} ml"
        },
        "instructions": f"Mix exactly {round(total_chemical_ml, 1)} ml of {req.treatment_type.lower()} pesticide into {math.ceil(total_water_liters)} liters of water. Spray evenly over {req.area_sqm} sq meters.",
        "safety_disclaimer": "WARNING: Always wear protective gear (gloves, respirator mask) before mixing. Follow local environmental regulations. Improper concentrations can severely damage crops."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
