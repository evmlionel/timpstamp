#!/usr/bin/env bun
/**
 * Generate a large sample export file for perf testing the popup.
 * Usage: bun scripts/generate-sample-bookmarks.mjs > sample-bookmarks.json
 */

function pad(n) {
  return n.toString().padStart(2, '0');
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom(arr) {
  return arr[randInt(0, arr.length - 1)];
}

const TAGS = [
  'study',
  'todo',
  'clip',
  'ux',
  'music',
  'idea',
  'bug',
  'reference',
  'inspo',
  'demo',
];

const now = Date.now();

const numVideos = 120; // number of distinct videos
const maxPerVideo = 200; // max timestamps per video
const total = 5000; // approximate total timestamps

const bookmarks = [];
let idCounter = 0;

for (let v = 0; v < numVideos; v++) {
  const videoId = Math.random().toString(36).slice(2, 13);
  const videoTitle = `Sample Video ${v + 1}`;
  const perVideo = randInt(10, maxPerVideo);
  for (let i = 0; i < perVideo; i++) {
    if (bookmarks.length >= total) break;
    const seconds = randInt(10, 60 * 60 * 2); // up to 2 hours
    const savedAt = now - randInt(0, 1000 * 60 * 60 * 24 * 90); // last 90 days
    const id = `${videoId}-${pad(i)}-${idCounter++}`;
    const tags = Array.from(new Set([randomFrom(TAGS), randomFrom(TAGS)])).slice(
      0,
      randInt(0, 2),
    );
    bookmarks.push({
      id,
      videoId,
      videoTitle,
      timestamp: seconds,
      savedAt,
      favorite: Math.random() < 0.1,
      notes: Math.random() < 0.05 ? 'Example note' : '',
      tags,
    });
  }
}

const out = {
  version: '1.0',
  exportDate: new Date().toISOString(),
  bookmarks,
};

process.stdout.write(JSON.stringify(out, null, 2));

