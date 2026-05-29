import fs from 'fs';
import path from 'path';

const routeDir = 'src/routes';
const files = fs.readdirSync(routeDir).filter((f) => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(routeDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  const importLines = [];
  const bodyLines = [];

  for (const line of content.split('\n')) {
    if (line.startsWith('import ')) {
      if (!line.includes("from 'express'")) {
        importLines.push(line);
      }
    } else if (
      line.includes('const router = express.Router()') ||
      line.trim() === ''
    ) {
      continue;
    } else {
      bodyLines.push(line);
    }
  }

  const fixed = [
    "import express from 'express';",
    ...importLines,
    '',
    'const router = express.Router();',
    '',
    ...bodyLines,
  ].join('\n');

  fs.writeFileSync(filePath, fixed);
  console.log('fixed', file);
}
