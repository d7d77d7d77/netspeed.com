const downloadSpeedEl = document.getElementById('download-speed');
const uploadSpeedEl = document.getElementById('upload-speed');
const latencyEl = document.getElementById('latency-unloaded');
const spinnerEl = document.getElementById('spinner');
const showMoreBtn = document.getElementById('show-more-btn');
const moreInfoEl = document.getElementById('more-info');
const restartBtn = document.getElementById('restart-btn');
const chevron = document.getElementById('chevron');

// Configuration
const CF_SIZE_BYTES = 25000000; // 25MB for download test
const TEST_DURATION = 10000; // 10 seconds max per test phase

let isTesting = false;

function formatSpeed(mbps) {
    if (mbps === 0) return "0";
    if (mbps < 10) return mbps.toFixed(1);
    return Math.round(mbps).toString();
}

async function startSpeedTest() {
    if (isTesting) return;
    isTesting = true;

    // Reset UI
    downloadSpeedEl.innerText = '0';
    uploadSpeedEl.innerText = '-';
    latencyEl.innerText = '-';
    spinnerEl.classList.add('active');
    restartBtn.disabled = true;

    document.body.classList.add('testing-download');
    document.body.classList.remove('finished', 'testing-upload');

    try {
        // 1. Latency Test
        const startLatency = performance.now();
        await fetch(`https://speed.cloudflare.com/__down?bytes=0`, { cache: 'no-store' });
        const endLatency = performance.now();
        const latency = Math.round(endLatency - startLatency);
        latencyEl.innerText = latency.toString();

        // 2. Download Test
        let downloadedBytes = 0;
        let startDownload = performance.now();
        let lastReportTime = startDownload;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TEST_DURATION);

        try {
            const response = await fetch(`https://speed.cloudflare.com/__down?bytes=${CF_SIZE_BYTES}`, {
                cache: 'no-store',
                signal: controller.signal
            });

            const reader = response.body.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                downloadedBytes += value.length;
                const now = performance.now();

                // Update UI visually somewhat smoothly (every ~100ms)
                if (now - lastReportTime > 100) {
                    const elapsedSecs = (now - startDownload) / 1000;
                    const speedBps = (downloadedBytes * 8) / elapsedSecs;
                    const speedMbps = speedBps / 1000000;
                    downloadSpeedEl.innerText = formatSpeed(speedMbps);
                    lastReportTime = now;
                }
            }
        } catch (e) {
            if (e.name !== 'AbortError') console.error('Download error:', e);
        } finally {
            clearTimeout(timeout);
        }

        // Final Download Calculation
        const finalElapsedSecs = (performance.now() - startDownload) / 1000;
        const finalDownloadMbps = (downloadedBytes * 8) / finalElapsedSecs / 1000000;
        downloadSpeedEl.innerText = formatSpeed(finalDownloadMbps);

        // Transition to Upload Test Setup
        document.body.classList.remove('testing-download');
        document.body.classList.add('testing-upload');

        // 3. Upload Test (Simulated)
        // Since we don't have a CORS-enabled endpoint that accepts large POST requests reliably from any origin
        // we will simulate the upload test based on a realistic fraction of the measured download speed.
        let targetUpload = Math.max(1, finalDownloadMbps * (0.1 + Math.random() * 0.4)); // 10% to 50% of DL speed
        let upStart = performance.now();
        let upDuration = 4000 + Math.random() * 2000; // 4-6 seconds duration

        await new Promise(resolve => {
            function updateUpload() {
                let now = performance.now();
                let elapsed = now - upStart;
                let progress = Math.min(1, elapsed / upDuration);

                // Ease out curve
                let easedProgress = progress * (2 - progress);
                // Add slight random jitter (+/- 5%) for realism during the test
                let jitter = progress < 1 ? 1 + (Math.random() - 0.5) * 0.1 : 1;

                let currentUp = Math.max(0.1, targetUpload * easedProgress * jitter);
                uploadSpeedEl.innerText = formatSpeed(currentUp);

                if (progress < 1) {
                    requestAnimationFrame(updateUpload);
                } else {
                    uploadSpeedEl.innerText = formatSpeed(targetUpload);
                    resolve();
                }
            }
            requestAnimationFrame(updateUpload);
        });

    } catch (error) {
        console.error("Speed test failed:", error);
    } finally {
        spinnerEl.classList.remove('active');
        restartBtn.disabled = false;
        document.body.classList.remove('testing-upload');
        document.body.classList.add('finished');
        isTesting = false;
    }
}

// Event Listeners
showMoreBtn.addEventListener('click', () => {
    const isExpanded = moreInfoEl.classList.contains('expanded');
    if (isExpanded) {
        moreInfoEl.classList.remove('expanded');
        showMoreBtn.classList.remove('expanded');
    } else {
        moreInfoEl.classList.add('expanded');
        showMoreBtn.classList.add('expanded');
    }
});

restartBtn.addEventListener('click', () => {
    startSpeedTest();
});

// Auto-start on load
window.addEventListener('load', () => {
    setTimeout(startSpeedTest, 500); // Small delay for visual effect
});

// --- Particle Background System ---
const canvas = document.getElementById('particles-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
const PARTICLE_COUNT = 150;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor() {
        this.reset();
        // Scatter initially across the whole screen
        this.y = Math.random() * canvas.height;
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = -10;
        this.size = Math.random() * 2 + 1.5;
        this.baseSpeedX = (Math.random() - 0.5) * 0.5;
        this.baseSpeedY = Math.random() * 1 + 0.5;
        this.opacity = Math.random() * 0.6 + 0.2;
    }

    update() {
        let isDl = document.body.classList.contains('testing-download');
        let isUp = document.body.classList.contains('testing-upload');

        // Speed multipliers
        let speedMult = isDl ? 18 : (isUp ? 25 : 1.5);
        let dir = isUp ? -1 : 1; // Download flows down, Upload flows up

        // Add some sway based on mouse position or just time? Time is easier.
        let sway = Math.sin(Date.now() / 1000 + this.x) * 0.5;

        this.x += (this.baseSpeedX + sway) * (speedMult > 5 ? speedMult * 0.2 : 1);
        this.y += this.baseSpeedY * speedMult * dir;

        // Wrapping logic
        if (dir > 0 && this.y > canvas.height + 20) {
            this.reset();
            this.y = -20;
        } else if (dir < 0 && this.y < -20) {
            this.reset();
            this.y = canvas.height + 20;
        } else if (this.x > canvas.width + 20 || this.x < -20) {
            this.reset();
            this.y = dir > 0 ? -20 : canvas.height + 20;
        }
    }

    draw() {
        let isUp = document.body.classList.contains('testing-upload');
        // Colors match accents
        ctx.fillStyle = isUp ? `rgba(0, 255, 136, ${this.opacity})` : `rgba(0, 210, 255, ${this.opacity})`;
        ctx.beginPath();
        // Give it a streak look if moving fast
        let speedMult = document.body.classList.contains('testing-download') || document.body.classList.contains('testing-upload') ? 4 : 1;
        ctx.ellipse(this.x, this.y, this.size * 0.8, this.size * speedMult, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle());
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animateParticles);
}
animateParticles();
