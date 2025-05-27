#!/usr/bin/env node

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import open from 'open';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argv = yargs(hideBin(process.argv))
  .option('audio', {
    alias: 'a',
    type: 'string',
    description: 'Path to audio file',
    demandOption: true
  })
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'Server port',
    default: 3000
  })
  .help()
  .argv;

const app = express();

app.use(express.static(join(__dirname, 'public')));

app.get('/audio', (req, res) => {
  const audioPath = resolve(argv.audio);
  if (!fs.existsSync(audioPath)) {
    return res.status(404).send('Audio file not found');
  }
  res.sendFile(audioPath);
});

app.listen(argv.port, () => {
  console.log(`Server running at http://localhost:${argv.port}`);
  console.log(`Audio file: ${argv.audio}`);
  console.log('Opening browser...');
  
  open(`http://localhost:${argv.port}`)
    .then(() => {
      console.log('Browser opened successfully');
      console.log('Waiting for connections...');
    })
    .catch(err => {
      console.error('Failed to open browser:', err);
      console.log(`Please manually open: http://localhost:${argv.port}`);
    });
});

app.get('/', (req, res, next) => {
  console.log('Client connected from:', req.ip);
  next();
});