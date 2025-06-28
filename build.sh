#!/bin/bash

npm run build
pkg -t node22-linux,node22-win build/src/main.js