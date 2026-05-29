import fs from 'fs';
import path from 'path';

const skip = new Set([
  'authRoutes.js',
  'authMiddleware.js',
  'adminSeed.js',
  'User.js',
  'db.js',
  'index.js',
  'auth.js',
  'role.js',
  'authController.js',
]);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else if (name.endsWith('.js')) files.push(p);
  }
  return files;
}

const files = [...walk('src'), ...walk('seeds')];

for (const file of files) {
  if (skip.has(path.basename(file))) continue;

  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('require(') && !content.includes('module.exports')) {
    continue;
  }

  content = content.replace(
    /^const mongoose = require\('mongoose'\);/m,
    "import mongoose from 'mongoose';"
  );

  content = content.replace(
    /const router = require\('express'\)\.Router\(\);/g,
    "import express from 'express';\n\nconst router = express.Router();"
  );

  content = content.replace(
    /const \{([^}]+)\} = require\('([^']+)'\);/g,
    (match, imports, mod) => {
      const fixed = mod
        .replace(/^\.\.\/models\//, '../models/')
        .replace(/^\.\.\/controllers\//, '../controllers/')
        .replace(/^\.\.\/middleware\//, '../middleware/')
        .replace(/^\.\.\/utils\//, '../utils/')
        .replace(/^\.\.\/config$/, '../config/index.js')
        .replace(/^\.\.\/src\/config$/, '../src/config/index.js')
        .replace(/^\.\.\/src\/models\//, '../src/models/');

      const withExt = fixed.endsWith('.js') ? fixed : `${fixed}.js`;
      return `import { ${imports} } from '${withExt}';`;
    }
  );

  content = content.replace(
    /const (\w+) = require\('([^']+)'\);/g,
    (match, name, mod) => {
      if (mod === 'pdfkit') return `import ${name} from 'pdfkit';`;
      if (mod === 'dotenv') return "import dotenv from 'dotenv';";

      let fixed = mod
        .replace(/^\.\.\/models\//, '../models/')
        .replace(/^\.\.\/src\/models\//, '../src/models/')
        .replace(/^\.\.\/config$/, '../config/index.js')
        .replace(/^\.\.\/src\/config$/, '../src/config/index.js');

      if (!fixed.startsWith('.') && !fixed.startsWith('../')) {
        return `import ${name} from '${mod}';`;
      }

      const withExt = fixed.endsWith('.js') ? fixed : `${fixed}.js`;
      return `import ${name} from '${withExt}';`;
    }
  );

  content = content.replace(
    /module\.exports = mongoose\.model\(([^)]+)\);/g,
    'export default mongoose.model($1);'
  );

  content = content.replace(
    /module\.exports = \{([^}]+)\};/gs,
    'export { $1 };'
  );

  content = content.replace(
    /module\.exports = (\w+);/g,
    'export default $1;'
  );

  content = content.replace(
    /module\.exports = router;/g,
    'export default router;'
  );

  if (file.includes('seed.js') && content.includes("import dotenv from 'dotenv'")) {
    content = content.replace(
      "import dotenv from 'dotenv';",
      "import dotenv from 'dotenv';\n\ndotenv.config();"
    );
    content = content.replace(/require\('dotenv'\)\.config\(\);\n?/g, '');
  }

  fs.writeFileSync(file, content);
  console.log('converted:', file);
}
