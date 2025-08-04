#!/bin/bash

npm run build
pkg -t node22-linux,node22-win --public build/src/main.js