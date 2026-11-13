#!/bin/sh
# Quick pose odds for one die: tools/odds.sh <id> [throws]
npx tsx tools/calibrate.ts "${2:-150}" "$1" "$1" --json 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s.slice(s.indexOf('{')));const p=j.posePct;console.log(j.animals[0].padEnd(9),'side',(p.sideMarkUp+p.sideMarkDown).toFixed(1),'back',p.back,'up',p.upright,'nose',p.noseDown,'tail',p.tailDown,'| avg',j.avgPointsPerRoll,'scat',j.resultPct.scattered)})"
