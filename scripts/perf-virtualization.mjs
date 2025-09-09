#!/usr/bin/env bun
// Synthetic perf harness comparing naive render, chunked render, and virtualization
// using JSDOM. Results are relative (jsdom is slower than browsers) but useful for tuning.

import { JSDOM } from 'jsdom';
import fs from 'fs';

const datasetPath = process.argv[2] || 'sample-bookmarks.json';
if (!fs.existsSync(datasetPath)) {
  console.error(`Dataset not found: ${datasetPath}\nGenerate with: bun run perf:gen > sample-bookmarks.json`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : data;

// Group by videoId and select the largest group
const groups = new Map();
for (const b of bookmarks) {
  const arr = groups.get(b.videoId) || [];
  arr.push(b);
  groups.set(b.videoId, arr);
}
let largest = null;
for (const [vid, arr] of groups.entries()) {
  if (!largest || arr.length > largest.items.length) largest = { vid, items: arr };
}
if (!largest) {
  console.error('No groups in dataset.');
  process.exit(1);
}

const N = largest.items.length;

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    pretendToBeVisual: true,
  });
  global.window = dom.window;
  global.document = dom.window.document;
  return dom;
}

function createBookmarkElement() {
  const div = document.createElement('div');
  div.className = 'bookmark-card';
  // Simulate a typical height ~96px via inline style
  div.style.height = '96px';
  // minimal children
  const inner = document.createElement('div');
  inner.className = 'bookmark-card-content';
  div.appendChild(inner);
  return div;
}

function naiveRender(container, items) {
  const t0 = performance.now();
  for (let i = 0; i < items.length; i++) container.appendChild(createBookmarkElement(items[i]));
  return { ms: +(performance.now() - t0).toFixed(2), nodes: container.querySelectorAll('.bookmark-card').length };
}

function chunkedRender(container, items, chunkSize = 60) {
  const t0 = performance.now();
  let rendered = 0;
  while (rendered < items.length) {
    const end = Math.min(rendered + chunkSize, items.length);
    const frag = document.createDocumentFragment();
    for (let i = rendered; i < end; i++) frag.appendChild(createBookmarkElement(items[i]));
    container.appendChild(frag);
    rendered = end;
  }
  return { ms: +(performance.now() - t0).toFixed(2), nodes: container.querySelectorAll('.bookmark-card').length };
}

function virtualRender(container, items, { viewport = 800, overscan = 20, itemH = 96, start = 0 } = {}) {
  const top = document.createElement('div');
  const mount = document.createElement('div');
  const bottom = document.createElement('div');
  container.innerHTML = '';
  container.appendChild(top);
  container.appendChild(mount);
  container.appendChild(bottom);

  const t0 = performance.now();
  const perView = Math.ceil(viewport / itemH);
  const s = Math.max(0, start - overscan);
  const e = Math.min(items.length, start + perView + overscan);
  top.style.height = `${s * itemH}px`;
  bottom.style.height = `${Math.max(0, items.length - e) * itemH}px`;
  for (let i = s; i < e; i++) mount.appendChild(createBookmarkElement(items[i]));
  return { ms: +(performance.now() - t0).toFixed(2), nodes: mount.querySelectorAll('.bookmark-card').length };
}

function scenario(label, fn) {
  const dom = setupDom();
  const root = document.getElementById('root');
  const res = fn(root);
  dom.window.close();
  return { label, ...res };
}

const results = [];
results.push(scenario(`naive all (${N})`, (root) => naiveRender(root, largest.items)));
results.push(scenario(`chunked all (${N})`, (root) => chunkedRender(root, largest.items)));
for (const overscan of [10, 20, 40]) {
  results.push(
    scenario(`virtual init overscan=${overscan}`, (root) => virtualRender(root, largest.items, { overscan }))
  );
  results.push(
    scenario(`virtual scroll update overscan=${overscan}`, (root) => virtualRender(root, largest.items, { overscan, start: 100 }))
  );
}

console.log(`Largest group: ${N} items (of ${bookmarks.length} total)`);
for (const r of results) console.log(`${r.label}: ${r.ms}ms, nodes=${r.nodes}`);

