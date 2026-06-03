#!/usr/bin/env node
/**
 * 每次 start/build 前自增构建号，并写入 src/buildInfo.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const counterPath = path.join(root, 'build-counter.json');
const outPath = path.join(root, 'src', 'buildInfo.js');

let build = 1;
if (fs.existsSync(counterPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
    build = (Number(data.build) || 0) + 1;
  } catch {
    build = 1;
  }
}

fs.writeFileSync(counterPath, JSON.stringify({ build }, null, 2) + '\n');

const content = `// 由 scripts/bump-build.js 自动生成，请勿手改
export const APP_NAME = '儿童涂色分析工具';
export const APP_COPYRIGHT = '华东师范大学';
export const APP_VERSION = '${pkg.version}';
export const APP_BUILD = ${build};
`;

fs.writeFileSync(outPath, content);
console.log(`[bump-build] v${pkg.version} build #${build}`);
