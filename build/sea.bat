node -e "const fs = require('fs');if(!fs.existsSync('dist'))fs.mkdirSync('dist');fs.writeFileSync('dist/version.txt', require('./package.json').version)"
call npm run build:bundle
node --experimental-sea-config build/sea-config.json
node -e "require('fs').copyFileSync(process.execPath, 'dist/sc4.exe')"
call npm run build:postject
