from fastapi import FastAPI, WebSocket
import json

app = FastAPI()

@app.get("/")
def home():
    return {"status": "server running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected")

    while True:
        data = await websocket.receive_text()
        print("Received:", data)
        try:
            parsed = json.loads(data)
            engineOn = parsed.get('engineOn', False)
            engine_flag = engineOn
            rpm = parsed.get('rpm', 0) if engineOn else 0

            if engineOn:
                radius = 0.30
                gear_ratio = 4.0
                wheel_rpm = rpm / gear_ratio
                calculated_speed = ((2 * 3.141592653589793 * radius * wheel_rpm) / 60) * 3.6
                calculated_speed = min(calculated_speed, 140)
                warning = ""
            else:
                calculated_speed = 0
                warning = "Turn on engine"
            
            print("sent:", json.dumps({
                    "rpm": rpm,
                    "speed": calculated_speed,
                    "engineOn": engineOn,
                    "engine_flag": engine_flag,
                    "warning": warning
                }))

#            print(f"RPM: {rpm}, EngineOn: {engineOn}, Calculated Speed: {calculated_speed}")
            await websocket.send_text(json.dumps({
                "rpm": rpm,
                "speed": calculated_speed,
                "engineOn": engineOn,
                "engine_flag": engine_flag,
                "warning": warning
            }))
        except json.JSONDecodeError:
            await websocket.send_text(f"Invalid JSON: {data}")