let player;
let pitchShift;
let hands;
let camera;
let canvasCtx;
let audioContext;

const statusEl = document.getElementById('status');
const pitchEl = document.getElementById('pitch');
const speedEl = document.getElementById('speed');
const detectionEl = document.getElementById('detection');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('startBtn');

startBtn.addEventListener('click', async () => {
    startBtn.style.display = 'none';
    document.getElementById('videoContainer').style.display = 'block';
    await init();
});

async function init() {
    try {
        statusEl.textContent = 'Loading audio...';
        console.log('Starting Tone.js...');
        
        await Tone.start();
        console.log('Tone.js started');
        
        statusEl.textContent = 'Creating audio nodes...';
        pitchShift = new Tone.PitchShift().toDestination();
        
        statusEl.textContent = 'Loading audio file...';
        console.log('Loading audio from /audio');
        
        player = new Tone.Player({
            url: '/audio',
            loop: true,
            autostart: false,
            onload: () => {
                console.log('Audio loaded successfully');
            },
            onerror: (err) => {
                console.error('Audio loading error:', err);
                statusEl.textContent = 'Error loading audio: ' + err;
            }
        }).connect(pitchShift);
        
        await Tone.loaded();
        console.log('All audio loaded');
        
        statusEl.textContent = 'Initializing camera...';
        
        canvasCtx = canvas.getContext('2d');
    
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    hands.onResults(onResults);
    
    camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 640,
        height: 480
    });
    
    await camera.start();
    player.start();
    
    statusEl.textContent = 'Ready! Show 4 fingers to control audio.';
    } catch (err) {
        console.error('Init error:', err);
        statusEl.textContent = 'Error: ' + err.message;
    }
}

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    const selectedPoints = [];
    
    console.log('=== Hand Detection Results ===');
    console.log('Number of hands detected:', results.multiHandLandmarks ? results.multiHandLandmarks.length : 0);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // Process each hand
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i];
            const worldLandmarks = results.multiHandWorldLandmarks[i];
            
            console.log(`\nHand ${i + 1}: ${handedness.label} (confidence: ${handedness.score.toFixed(3)})`);
            
            drawHand(landmarks);
            
            // Get thumb tip (landmark 4) and index finger tip (landmark 8)
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            
            // Log finger positions
            console.log(`  Thumb tip: x=${(thumbTip.x * 100).toFixed(1)}%, y=${(thumbTip.y * 100).toFixed(1)}%, z=${thumbTip.z.toFixed(3)}`);
            console.log(`  Index tip: x=${(indexTip.x * 100).toFixed(1)}%, y=${(indexTip.y * 100).toFixed(1)}%, z=${indexTip.z.toFixed(3)}`);
            
            // Check visibility (z-coordinate indicates depth, negative = closer to camera)
            console.log(`  Thumb visibility: ${thumbTip.z < 0 ? 'Good' : 'Poor'} (z=${thumbTip.z})`);
            console.log(`  Index visibility: ${indexTip.z < 0 ? 'Good' : 'Poor'} (z=${indexTip.z})`);
            
            // Add to selected points
            selectedPoints.push({
                point: thumbTip,
                type: 'thumb',
                hand: handedness.label
            });
            
            selectedPoints.push({
                point: indexTip,
                type: 'index',
                hand: handedness.label
            });
            
            // Draw large dots on thumb and index fingertips
            canvasCtx.fillStyle = handedness.label === 'Left' ? '#00FFFF' : '#FF00FF';
            
            // Thumb
            canvasCtx.beginPath();
            canvasCtx.arc(
                thumbTip.x * canvas.width,
                thumbTip.y * canvas.height,
                12, 0, 2 * Math.PI
            );
            canvasCtx.fill();
            
            // Index
            canvasCtx.beginPath();
            canvasCtx.arc(
                indexTip.x * canvas.width,
                indexTip.y * canvas.height,
                12, 0, 2 * Math.PI
            );
            canvasCtx.fill();
            
            // Label the points
            canvasCtx.fillStyle = 'white';
            canvasCtx.font = '12px Arial';
            canvasCtx.fillText(
                `${handedness.label[0]}-T`,
                thumbTip.x * canvas.width - 10,
                thumbTip.y * canvas.height - 15
            );
            canvasCtx.fillText(
                `${handedness.label[0]}-I`,
                indexTip.x * canvas.width - 10,
                indexTip.y * canvas.height - 15
            );
        }
        
        if (selectedPoints.length >= 4) {
            const points = selectedPoints.slice(0, 4).map(p => p.point);
            const shape = calculateShape(points);
            updateAudioParams(shape);
            drawShape(points);
            detectionEl.textContent = `${results.multiHandLandmarks.length} hand(s) detected - controlling audio`;
            console.log('\nShape calculated:', shape);
        } else {
            detectionEl.textContent = `${results.multiHandLandmarks.length} hand(s) detected - need 2 hands`;
        }
        
        // Draw debug info on canvas
        drawDebugInfo(results);
    } else {
        detectionEl.textContent = 'No hands detected - show both hands';
        console.log('No hands detected in this frame');
    }
    
    canvasCtx.restore();
}

function drawDebugInfo(results) {
    // Draw reference square guide (1/3 of screen)
    const refSize = canvas.width / 3;
    const refX = (canvas.width - refSize) / 2;
    const refY = (canvas.height - refSize) / 2;
    
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    canvasCtx.lineWidth = 2;
    canvasCtx.setLineDash([5, 5]);
    canvasCtx.strokeRect(refX, refY, refSize, refSize);
    canvasCtx.setLineDash([]);
    
    // Draw center text
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    canvasCtx.font = '14px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('Reference Size', canvas.width / 2, canvas.height / 2);
    canvasCtx.fillText('Pitch: 0, Speed: 1.0x', canvas.width / 2, canvas.height / 2 + 20);
    canvasCtx.textAlign = 'left';
    
    // Draw info box
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    canvasCtx.fillRect(0, 0, 200, 100);
    
    canvasCtx.fillStyle = 'white';
    canvasCtx.font = '12px monospace';
    
    let y = 20;
    canvasCtx.fillText(`FPS: ${(1000 / 30).toFixed(0)}`, 10, y);
    y += 15;
    canvasCtx.fillText(`Hands: ${results.multiHandLandmarks ? results.multiHandLandmarks.length : 0}`, 10, y);
    
    if (results.multiHandedness) {
        results.multiHandedness.forEach((hand, i) => {
            y += 15;
            canvasCtx.fillText(`${hand.label}: ${(hand.score * 100).toFixed(0)}%`, 10, y);
        });
    }
}

function drawHand(landmarks) {
    // Hand connections for MediaPipe
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],  // Index finger
        [5, 9], [9, 10], [10, 11], [11, 12],  // Middle finger
        [9, 13], [13, 14], [14, 15], [15, 16],  // Ring finger
        [13, 17], [17, 18], [18, 19], [19, 20],  // Pinky
        [0, 17]  // Palm
    ];
    
    canvasCtx.strokeStyle = '#00FF00';
    canvasCtx.lineWidth = 2;
    
    for (const connection of connections) {
        const from = landmarks[connection[0]];
        const to = landmarks[connection[1]];
        
        canvasCtx.beginPath();
        canvasCtx.moveTo(from.x * canvas.width, from.y * canvas.height);
        canvasCtx.lineTo(to.x * canvas.width, to.y * canvas.height);
        canvasCtx.stroke();
    }
    
    canvasCtx.fillStyle = '#FF0000';
    for (const landmark of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            5, 0, 2 * Math.PI
        );
        canvasCtx.fill();
    }
}

function getFingerTips(landmarks) {
    const fingerTips = [];
    
    // Thumb tip (4) if extended
    if (landmarks[4].y < landmarks[3].y) {
        fingerTips.push(landmarks[4]);
    }
    
    // Index finger (8) if extended
    if (landmarks[8].y < landmarks[6].y) {
        fingerTips.push(landmarks[8]);
    }
    
    // Middle finger (12) if extended
    if (landmarks[12].y < landmarks[10].y) {
        fingerTips.push(landmarks[12]);
    }
    
    // Ring finger (16) if extended
    if (landmarks[16].y < landmarks[14].y) {
        fingerTips.push(landmarks[16]);
    }
    
    // Pinky (20) if extended
    if (landmarks[20].y < landmarks[18].y) {
        fingerTips.push(landmarks[20]);
    }
    
    return fingerTips;
}

function calculateShape(points) {
    const centroid = {
        x: points.reduce((sum, p) => sum + p.x, 0) / 4,
        y: points.reduce((sum, p) => sum + p.y, 0) / 4
    };
    
    const sortedPoints = points.sort((a, b) => {
        const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
        const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
        return angleA - angleB;
    });
    
    const sides = [];
    for (let i = 0; i < 4; i++) {
        const p1 = sortedPoints[i];
        const p2 = sortedPoints[(i + 1) % 4];
        const length = Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
        );
        sides.push(length);
    }
    
    return { sides, area: calculateArea(sortedPoints), points: sortedPoints };
}

function calculateArea(points) {
    let area = 0;
    for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
}

function updateAudioParams(shape) {
    // Get the width and height of the shape
    const points = shape.points;
    const xCoords = points.map(p => p.x);
    const yCoords = points.map(p => p.y);
    
    const width = Math.max(...xCoords) - Math.min(...xCoords);
    const height = Math.max(...yCoords) - Math.min(...yCoords);
    
    // Reference values (1/3 of screen)
    const referenceSize = 1/3;
    
    // Width controls pitch (horizontal stretch)
    // When width = reference, pitch = 0
    const widthRatio = width / referenceSize;
    const pitch = Math.round((widthRatio - 1) * 12);  // -12 to +12 semitones
    pitchShift.pitch = Math.max(-12, Math.min(12, pitch));
    
    // Height controls speed (vertical stretch)
    // When height = reference, speed = 1.0
    const heightRatio = height / referenceSize;
    const playbackRate = heightRatio * 1.5;  // Scale to get good range
    player.playbackRate = Math.max(0.5, Math.min(2, playbackRate));
    
    pitchEl.textContent = pitch;
    speedEl.textContent = playbackRate.toFixed(2);
    
    // Log for debugging
    console.log(`Width: ${(width * 100).toFixed(0)}% (pitch: ${pitch}) | Height: ${(height * 100).toFixed(0)}% (speed: ${playbackRate.toFixed(2)})`);
}

function drawShape(points) {
    const centroid = {
        x: points.reduce((sum, p) => sum + p.x, 0) / 4,
        y: points.reduce((sum, p) => sum + p.y, 0) / 4
    };
    
    const sortedPoints = points.sort((a, b) => {
        const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
        const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
        return angleA - angleB;
    });
    
    canvasCtx.strokeStyle = '#FFFF00';
    canvasCtx.lineWidth = 3;
    canvasCtx.beginPath();
    
    sortedPoints.forEach((point, i) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        
        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }
    });
    
    canvasCtx.closePath();
    canvasCtx.stroke();
}

