#!/bin/bash
# concatenates src/*.js into game.js and publishes to /srv/site
set -e
cd /root/game
cat src/1_core.js src/2_logic.js src/3_update.js src/4_draw.js src/5_main.js > game.js
for f in game.js; do node --check $f; done
mkdir -p /srv/site
cp index.html game.js audio.js /srv/site/; mkdir -p /srv/site/bug /srv/site/img; cp bug.html /srv/site/bug/index.html; cp img/* /srv/site/img/; [ -d devlog ] && cp -r devlog/* /srv/site/devlog/ || true
echo deployed
