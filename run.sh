#!/bin/bash
cd /home/mark/Repos/projects/headlines
export $(grep -v '^#' .env | xargs)
 /home/mark/.nvm/versions/node/v22.18.0/bin/node app.js
