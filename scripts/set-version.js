// CI 전용: VERSION 환경변수(예: 1.0.12)를 package.json, app/version.js, 안드로이드 build.gradle 에 반영한다.
const fs = require('fs');
const version = process.env.VERSION;
if (!/^\d+\.\d+\.\d+$/.test(version || '')) { console.error('VERSION 환경변수가 필요합니다 (예: 1.0.12)'); process.exit(1); }
const repo = process.env.GITHUB_REPOSITORY || 'harp1455/Prompt-editor';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = version;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync('app/version.js', 'window.APP_INFO = ' + JSON.stringify({ version, repo }) + ';\n');
const gradle = 'android/app/build.gradle';
if (fs.existsSync(gradle)) {
  const code = Number(version.split('.')[2]) || 1;
  let g = fs.readFileSync(gradle, 'utf8');
  g = g.replace(/versionCode\s+\d+/, 'versionCode ' + code).replace(/versionName\s+"[^"]*"/, 'versionName "' + version + '"');
  fs.writeFileSync(gradle, g);
}
console.log('version set to', version);
