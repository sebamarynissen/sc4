call npm run build:bundle
node --experimental-sea-config build/sea-config.json
node -e "require('fs').copyFileSync(process.execPath, 'dist/sc4.exe')"
call npm run build:postject -- --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 
