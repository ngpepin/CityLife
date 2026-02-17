import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(repoRoot, 'citylife-config', 'citylifeSpriteMapping.json');
const targetDir = path.join(__dirname, '..', 'src', 'config');
const targetPath = path.join(targetDir, 'citylifeSpriteMapping.json');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`CityLife config source not found: ${sourcePath}`);
}

fs.mkdirSync(targetDir, { recursive: true });

if (fs.existsSync(targetPath)) {
  const stat = fs.lstatSync(targetPath);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(targetPath);
  }
}

fs.copyFileSync(sourcePath, targetPath);
console.log(`[citylife-config] synced ${path.relative(repoRoot, sourcePath)} -> ${path.relative(repoRoot, targetPath)}`);
