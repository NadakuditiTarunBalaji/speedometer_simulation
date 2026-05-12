window.onload = () => {

    const speedCanvas = document.getElementById("speedo");
    const rpmCanvas = document.getElementById("rpm");

    const sctx = speedCanvas.getContext("2d");
    const rctx = rpmCanvas.getContext("2d");

    const rpmBar = document.getElementById("rpmBar");

    let rpm = 0;
    let speed = 0;
    let targetRPM = 0;

    // ✅ indicator state (FIXED POSITION)
    let leftOn = false;
    let rightOn = false;
    let engineOn = false;

    const engineBtn = document.getElementById("engineBtn");
    const engineWarning = document.getElementById("engineWarning");

    window.toggleEngine = () => {
        engineOn = !engineOn;
        engineBtn.textContent = engineOn ? "Turn Engine Off" : "Turn Engine On";
        engineWarning.textContent = engineOn ? "" : "Turn on engine";
        document.getElementById("engineON").classList.toggle("active", engineOn);
    };

    engineWarning.textContent = "Turn on engine";

    // WebSocket connection
    const ws = new WebSocket('ws://localhost:8000/ws');
    ws.onopen = () => console.log('Connected to server');
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.engineOn !== undefined) {
                engineOn = data.engineOn;
                engineBtn.textContent = engineOn ? "Turn Engine Off" : "Turn Engine On";
                document.getElementById("engineON").classList.toggle("active", engineOn);
                engineWarning.textContent = engineOn ? "" : "Turn on engine";
            }
            if (data.speed !== undefined) {
                speed = data.speed;  // Update speed from server
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    };
    ws.onerror = (error) => console.error('WebSocket error:', error);

    // 🎮 SCROLL CONTROL
    window.addEventListener("wheel", (e) => {
        e.preventDefault();

        if (e.deltaY < 0) targetRPM += 300;
        else targetRPM -= 300;

        targetRPM = Math.max(0, Math.min(5001, targetRPM));
    }, { passive: false });

    // 🎮 KEYBOARD CONTROL (RPM + INDICATORS)
    window.addEventListener("keydown", (e) => {

        // prevent page scrolling
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
        }

        // RPM control
        if (e.key === "ArrowUp") targetRPM += 400;
        if (e.key === "ArrowDown") targetRPM -= 400;

        // indicator control
        if (e.key === "ArrowLeft") {
            leftOn = !leftOn;
            rightOn = false;
        }

        if (e.key === "ArrowRight") {
            rightOn = !rightOn;
            leftOn = false;
        }

        targetRPM = Math.max(0, Math.min(5001, targetRPM));
    });

    function drawGauge(ctx, value, max, color) {
        const w = 250, h = 250;
        const cx = w / 2, cy = h / 2;
        const radius = 100;

        ctx.clearRect(0, 0, w, h);

        // background arc
        ctx.beginPath();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 20;
        ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI);
        ctx.stroke();

        // active arc
        const angle = Math.PI + (value / max) * Math.PI;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 20;
        ctx.arc(cx, cy, radius, Math.PI, angle);
        ctx.stroke();

        // text
        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(Math.floor(value), cx, cy + 10);
    }

    // physics
    const engineResponse = 0.08;
    const drag = 0.985;

    function update() {

        if (!engineOn) {
            targetRPM = 0;
        }

        // smooth RPM
        rpm += (targetRPM - rpm) * engineResponse;
        if (targetRPM === 0) rpm *= drag;

        const displayRPM = engineOn ? rpm : 0;
        const displaySpeed = engineOn ? speed : 0;

        // draw gauges
        drawGauge(sctx, displaySpeed, 140, "#00ffcc");
        drawGauge(rctx, displayRPM, 5001, "#ff5555");

        // RPM bar
        const pct = (displayRPM / 5001) * 100;
        rpmBar.style.width = pct + "%";

        rpmBar.style.background =
            displayRPM > 6500
                ? (Math.sin(Date.now() / 80) > 0 ? "orange" : "red")
                : "red";

        // ✅ indicator blinking (FIXED)
        const blink = Math.floor(Date.now() / 400) % 2 === 0;

        document.getElementById("left").classList.toggle(
            "active",
            leftOn && blink
        );

        document.getElementById("right").classList.toggle(
            "active",
            rightOn && blink
        );

        document.getElementById("engine")
            .classList.toggle("active", engineOn);

        // Send data to server only when engine is on
        if (ws.readyState === WebSocket.OPEN) {
            const payload = { engineOn };
            if (engineOn) {
                payload.rpm = Math.floor(displayRPM);
            }
            ws.send(JSON.stringify(payload));
        }

        requestAnimationFrame(update);
    }
    

    update();
};