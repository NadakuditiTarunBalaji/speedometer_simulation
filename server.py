from fastapi import FastAPI, WebSocket
from can.interfaces.virtual import VirtualBus
import can
import json
import math
import asyncio

app = FastAPI()

# -------------------------------
# CAN BUS
# -------------------------------
bus = VirtualBus(channel="test_channel")

ENGINE_ID = 0x100
SPEED_ID = 0x101
WARNING_ID = 0x102


# -------------------------------
# HOME
# -------------------------------
@app.get("/")
def home():
    return {"status": "CAN Simulator Running"}


# -------------------------------
# SEND CAN MESSAGE
# -------------------------------
def send_can(can_id, data):

    msg = can.Message(
        arbitration_id=can_id,
        data=data,
        is_extended_id=False
    )

    bus.send(msg)


# -------------------------------
# BACKGROUND RECEIVER
# -------------------------------
async def can_receiver():

    while True:
        msg = bus.recv(timeout=1)

        if msg:
            print(f"RX CAN -> {hex(msg.arbitration_id)} {list(msg.data)}")

        await asyncio.sleep(0.01)


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(can_receiver())
    yield

app = FastAPI(lifespan=lifespan)


# -------------------------------
# WEBSOCKET
# -------------------------------
@app.websocket("/ws")
async def ws(websocket: WebSocket):

    await websocket.accept()
    print("Client Connected")

    while True:

        try:
            data = await websocket.receive_text()

            print("RAW INPUT:", data)

            parsed = json.loads(data)

            # ---------------------------
            # INPUT HANDLING (FIXED)
            # ---------------------------
            engine_on = bool(parsed.get("engineOn"))
            rpm = int(parsed.get("rpm", 0))

            print(f"ENGINE={engine_on} RPM={rpm}")

            # ---------------------------
            # SPEED CALCULATION
            # ---------------------------
            if engine_on and rpm > 0:

                wheel_radius = 0.30
                gear_ratio = 4.0

                wheel_rpm = rpm / gear_ratio

                speed = (2 * math.pi * wheel_radius * wheel_rpm) / 60 * 3.6

                speed = round(min(speed, 140), 2)

            else:
                speed = 0

            print("CALCULATED SPEED:", speed)

            # ---------------------------
            # ENGINE CAN FRAME
            # ---------------------------
            send_can(ENGINE_ID, [
                1 if engine_on else 0,
                (rpm >> 8) & 0xFF,
                rpm & 0xFF
            ])

            # ---------------------------
            # SPEED CAN FRAME
            # ---------------------------
            speed_int = int(speed)

            send_can(SPEED_ID, [
                (speed_int >> 8) & 0xFF,
                speed_int & 0xFF
            ])

            # ---------------------------
            # WARNING CAN FRAME
            # ---------------------------
            warning = 0 if engine_on else 1

            send_can(WARNING_ID, [warning])

            # ---------------------------
            # RESPONSE TO FRONTEND
            # ---------------------------
            response = {
                "engineOn": engine_on,
                "rpm": rpm,
                "speed": speed,
                "warning": warning
            }

            await websocket.send_text(json.dumps(response))

        except Exception as e:
            print("ERROR:", e)

            await websocket.send_text(json.dumps({
                "error": str(e)
            }))