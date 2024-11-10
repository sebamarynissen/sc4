#!/usr/bin/env bash
node -e "const fs = require('fs');if(!fs.existsSync('dist'))fs.mkdirSync('dist');fs.writeFileSync('dist/version.txt', require('./package.json').version)"
npm run build:bundle
node --experimental-sea-config build/sea-config.json
cp $(command -v node) sc4 
npx postject sc4 NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 
