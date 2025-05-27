# Hand Audio Controller

Control audio playback parameters using hand gestures detected through your camera.

## Installation

```bash
npm install
```

Note: This requires opencv4nodejs which has native dependencies. You may need to install OpenCV on your system first.

## Usage

```bash
node src/index.js --audio path/to/audio.mp3
```

Options:
- `--audio, -a`: Path to audio file (required)
- `--camera, -c`: Camera index (default: 0)

## How it works

1. The app captures video from your camera
2. It detects your hand and identifies fingertips
3. When 4 fingertips are visible, it forms a quadrilateral shape
4. The shape's dimensions control:
   - Average side length → Pitch shift (-12 to +12 semitones)
   - Shape area → Playback speed (0.5x to 2x)

Press ESC or 'q' to quit.