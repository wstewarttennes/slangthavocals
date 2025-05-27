import cv from 'opencv4nodejs';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import * as Tone from 'tone';
import { createCanvas, createImageData } from 'canvas';

export class HandAudioController {
  constructor(audioPath, cameraIndex = 0) {
    this.audioPath = audioPath;
    this.cameraIndex = cameraIndex;
    this.player = null;
    this.pitchShift = null;
    this.cap = null;
    this.hands = null;
    this.isRunning = false;
  }

  async start() {
    console.log('Initializing audio...');
    await this.initAudio();
    
    console.log('Initializing camera and hand detection...');
    await this.initCamera();
    
    console.log('Starting detection loop...');
    this.isRunning = true;
    this.detectLoop();
  }

  async initAudio() {
    await Tone.start();
    
    this.pitchShift = new Tone.PitchShift().toDestination();
    this.player = new Tone.Player({
      url: this.audioPath,
      loop: true,
      autostart: true
    }).connect(this.pitchShift);
    
    await Tone.loaded();
  }

  async initCamera() {
    this.cap = new cv.VideoCapture(this.cameraIndex);
    this.cap.set(cv.CAP_PROP_FRAME_WIDTH, 640);
    this.cap.set(cv.CAP_PROP_FRAME_HEIGHT, 480);
    
    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });
    
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    this.hands.onResults(this.onHandResults.bind(this));
  }

  async detectLoop() {
    while (this.isRunning) {
      const frame = this.cap.read();
      if (frame.empty) continue;
      
      const canvas = createCanvas(frame.cols, frame.rows);
      const ctx = canvas.getContext('2d');
      const imageData = createImageData(
        new Uint8ClampedArray(frame.getData()),
        frame.cols,
        frame.rows
      );
      ctx.putImageData(imageData, 0, 0);
      
      await this.hands.send({ image: canvas });
      
      cv.imshow('Hand Audio Controller', frame);
      
      const key = cv.waitKey(30);
      if (key === 27 || key === 113) { // ESC or 'q'
        this.stop();
        break;
      }
    }
  }

  onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const fingerTips = this.getFingerTips(landmarks);
      
      if (fingerTips.length >= 4) {
        const shape = this.calculateShape(fingerTips.slice(0, 4));
        this.updateAudioParams(shape);
      }
    }
  }

  getFingerTips(landmarks) {
    const tipIndices = [4, 8, 12, 16, 20];
    return tipIndices.map(i => landmarks[i]).filter(tip => tip.y < 0.7);
  }

  calculateShape(points) {
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
    
    return { sides, area: this.calculateArea(sortedPoints) };
  }

  calculateArea(points) {
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  }

  updateAudioParams(shape) {
    const avgSideLength = shape.sides.reduce((a, b) => a + b) / 4;
    const pitch = Math.floor((avgSideLength - 0.1) * 24) - 12;
    this.pitchShift.pitch = Math.max(-12, Math.min(12, pitch));
    
    const playbackRate = 0.5 + shape.area * 3;
    this.player.playbackRate = Math.max(0.5, Math.min(2, playbackRate));
    
    console.log(`Pitch: ${pitch}, Playback Rate: ${playbackRate.toFixed(2)}`);
  }

  stop() {
    this.isRunning = false;
    if (this.player) {
      this.player.stop();
      this.player.dispose();
    }
    if (this.pitchShift) {
      this.pitchShift.dispose();
    }
    if (this.cap) {
      this.cap.release();
    }
    cv.destroyAllWindows();
    process.exit(0);
  }
}