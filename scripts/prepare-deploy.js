const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const sourceFile = isProduction ? '_routes.json' : '_routes.dev.json';
const targetFile = '_routes.json';

const sourcePath = path.join(__dirname, '../src/main/webapp', sourceFile);
const targetPath = path.join(__dirname, '../src/main/webapp', targetFile);

// Copy the appropriate routes file
fs.copyFileSync(sourcePath, targetPath);
console.log(`✅ Copied ${sourceFile} to ${targetFile} for ${isProduction ? 'production' : 'development'} environment`); 