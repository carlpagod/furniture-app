// Logo background removal — flood-fill from edges to make pure black bg transparent
const { Jimp } = require('jimp');

async function processLogo() {
  const image = await Jimp.read('./assets/logo.png');
  const { width, height } = image.bitmap;
  const data = image.bitmap.data;
  const visited = new Uint8Array(width * height);

  function isBackground(idx) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    // Pure black or very dark colors near edges
    return r < 35 && g < 35 && b < 35;
  }

  // BFS flood-fill from all edge pixels
  const queue = [];
  for (let x = 0; x < width; x++) {
    queue.push(x, 0);
    queue.push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(0, y);
    queue.push(width - 1, y);
  }

  // Process queue as pairs [x, y]
  const pairs = [];
  for (let i = 0; i < queue.length; i += 2) {
    pairs.push([queue[i], queue[i + 1]]);
  }

  while (pairs.length > 0) {
    const [x, y] = pairs.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const pos = y * width + x;
    if (visited[pos]) continue;
    visited[pos] = 1;
    const idx = pos * 4;
    if (!isBackground(idx)) continue;
    // Make transparent
    data[idx + 3] = 0;
    pairs.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  await image.write('./assets/logo.png');
  console.log('✅ Logo processed: black background is now transparent');
}

processLogo().catch(err => {
  console.error('❌ Error:', err.stack || err.message);
  process.exit(1);
});
