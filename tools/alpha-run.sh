#!/bin/sh
# Long Auto-roll runs for the Alpha check, as chunks of 50,000 throws (LANES at a time, at
# below-normal priority). Finished chunks are kept, so an interrupted run can be resumed by
# running the same command again.
#
#   sh tools/alpha-run.sh NAME ROUNDS LANES SEEDBASE [--dump]
#   sh tools/alpha-run.sh confirm 4 2 6000    # 400,000 throws on two cores
#
# Each chunk writes calibration/NAME-ROUND-LANE.report.json (and .dump.json with --dump).
# Then: npx tsx tools/record-odds.ts calibration/NAME-*.report.json
name=${1:-alpha}; rounds=${2:-4}; lanes=${3:-4}; base=${4:-0}; dump=$5
round=1
while [ "$round" -le "$rounds" ]; do
  lane=1
  while [ "$lane" -le "$lanes" ]; do
    out=calibration/$name-$round-$lane.report.json
    if ! { [ -s "$out" ] && grep -q '"throws"' "$out"; }; then
      extra=""
      [ "$dump" = "--dump" ] && extra="--dump=calibration/$name-$round-$lane.dump.json"
      node --import tsx tools/calibrate.ts 50000 winter winter --json --seed=$((base + round * 100 + lane)) $extra > "$out" 2>&1 &
    fi
    lane=$((lane + 1))
  done
  wait
  echo "round $round done: $(ls calibration/$name-*.report.json | wc -l) chunks"
  round=$((round + 1))
done
