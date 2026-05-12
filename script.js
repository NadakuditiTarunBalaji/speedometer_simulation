window.onload = () => {

    const speedCanvas = document.getElementById("speedo");
    const rpmCanvas = document.getElementById("rpm");

    const sctx = speedCanvas.getContext("2d");
    const rctx = rpmCanvas.getContext("2d");

    const rpmBar = document.getElementById("rpmBar");

    let rpm = 0;
    let speed = 0;
    let targetRPM = 0;

    let engineOn = false;
    let leftOn = false;
    let rightOn = false;

    const engineBtn = document.getElementById("engineBtn");
    const engineWarning = document.getElementById("engineWarning");

    // -------------------------------
    // ENGINE TOGGLE (FIXED STABLE)
    // -------------------------------
    window.toggleEngine = () => {

        engineOn = !engineOn;

        engineBtn.textContent = engineOn
            ? "Turn Engine Off"
            : "Turn Engine On";

        engineWarning.textContent = engineOn
            ? ""
            : "Turn on engine";

        document.getElementById("engineON")
            .classList.toggle("active", engineOn);

        sendToServer();
    };

    engineWarning.textContent = "Turn on engine";

    // -------------------------------
    // WEBSOCKET
    // -------------------------------
    const ws = new WebSocket("ws://localhost:8000/ws");

    ws.onopen = () => console.log("Connected to server");

    ws.onmessage = (event) => {

        try {
            const data = JSON.parse(event.data);

            // ONLY UPDATE SENSOR DATA (NOT ENGINE STATE)
            if (data.speed !== undefined) {
                speed = data.speed;
            }

            if (data.rpm !== undefined) {
                rpm = data.rpm;
            }

        } catch (e) {
            console.error("WS error:", e);
        }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);

    // -------------------------------
    // INPUT CONTROL
    // -------------------------------
    window.addEventListener("wheel", (e) => {
        e.preventDefault();

        if (!engineOn) return;

        if (e.deltaY < 0) targetRPM += 300;
        else targetRPM -= 300;

        targetRPM = Math.max(0, Math.min(5001, targetRPM));

        sendToServer();
    }, { passive: false });

    window.addEventListener("keydown", (e) => {

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
        }

        if (!engineOn) return;

        if (e.key === "ArrowUp") targetRPM += 400;
        if (e.key === "ArrowDown") targetRPM -= 400;

        if (e.key === "ArrowLeft") {
            leftOn = !leftOn;
            rightOn = false;
        }

        if (e.key === "ArrowRight") {
            rightOn = !rightOn;
            leftOn = false;
        }

        targetRPM = Math.max(0, Math.min(5001, targetRPM));

        sendToServer();
    });

    // -------------------------------
    // SEND TO SERVER (ONLY WHEN NEEDED)
    // -------------------------------
    function sendToServer() {

        if (ws.readyState !== WebSocket.OPEN) return;

        ws.send(JSON.stringify({
            engineOn: engineOn,
            rpm: engineOn ? Math.floor(targetRPM) : 0
        }));
    }

    // -------------------------------
    // GAUGE DRAW
    // -------------------------------
    function drawGauge(ctx, value, max, color) {

        const w = 250, h = 250;
        const cx = w / 2, cy = h / 2;
        const radius = 100;

        ctx.clearRect(0, 0, w, h);

        ctx.beginPath();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 20;
        ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI);
        ctx.stroke();

        const angle = Math.PI + (value / max) * Math.PI;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 20;
        ctx.arc(cx, cy, radius, Math.PI, angle);
        ctx.stroke();

        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(Math.floor(value), cx, cy + 10);
    }

    // -------------------------------
    // MAIN LOOP
    // -------------------------------
    const engineResponse = 0.08;
    const drag = 0.985;

    function update() {

        if (!engineOn) {
            targetRPM = 0;
        }

        rpm += (targetRPM - rpm) * engineResponse;

        if (targetRPM === 0) rpm *= drag;

        const displayRPM = engineOn ? rpm : 0;
        const displaySpeed = speed;

        drawGauge(sctx, displaySpeed, 140, "#00ffcc");
        drawGauge(rctx, displayRPM, 5001, "#ff5555");

        rpmBar.style.width = (displayRPM / 5001) * 100 + "%";

        rpmBar.style.background =
            displayRPM > 6500
                ? (Math.sin(Date.now() / 80) > 0 ? "orange" : "red")
                : "red";

        const blink = Math.floor(Date.now() / 400) % 2 === 0;

        document.getElementById("left")
            .classList.toggle("active", leftOn && blink);

        document.getElementById("right")
            .classList.toggle("active", rightOn && blink);

        document.getElementById("engine")
            .classList.toggle("active", engineOn);

        requestAnimationFrame(update);
    }

    update();
};