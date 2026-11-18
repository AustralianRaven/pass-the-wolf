#!/bin/sh
# Measure one pig tuning at full precision: 10,000 throws as four parallel seeded batches.
# Usage: sh tools/calibrate-full.sh <name> '<tune json>'
name=$1; tune=$2
for sd in 11 22 33 44; do node --import tsx tools/calibrate.ts 2500 winter winter --json --seed=$sd "--tune=$tune" --dump=calibration/$name-$sd.json > calibration/$name-$sd.report.json 2>&1 & done; wait
echo "== $name $tune"; node tools/summarize.mjs calibration/$name-*.report.json
