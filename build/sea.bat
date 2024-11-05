call npm run build:bundle
node --experimental-sea-config build/sea-config.json
node -e "require('fs').writeFileSync('dist/version.txt', require('./package.json').version)"
node -e "require('fs').copyFileSync(process.execPath, 'dist/sc4.exe')"
call npm run build:postject
