#!/usr/bin/env bash
# 邦国录 · 批量生成补齐 7 条 BGM（聚落低/危机已有）。每条 gen_music.py 生成 + 接入 public/audio/<key>.mp3
set -u
cd "$(dirname "$0")/.."

declare -A PROMPTS
PROMPTS[bgm_prosper_mid]="ancient chinese court music, a growing prosperous walled town, warm and content, guqin zither with bamboo flute and light bamboo percussion and a gentle xun ocarina, flowing melody, hopeful and busy but calm, cinematic instrumental ambient, spring and autumn period, no drums of war"
PROMPTS[bgm_prosper_high]="grand ancient chinese imperial court music of a flourishing golden-age hegemon state, majestic full ensemble with large bronze bell chimes bianzhong, stone chimes, guqin, sheng mouth organ, dignified and triumphant and serene, ceremonial grandeur, cinematic orchestral instrumental, spring and autumn period"
PROMPTS[bgm_war]="ancient chinese battle music, urgent and martial, pounding war drums and bronze gongs, low brass-like bronze horns, driving relentless rhythm, tension and momentum of armies marching, heroic, cinematic instrumental, spring and autumn period warfare, no melody just rhythm and power"
PROMPTS[bgm_ritual]="ancient chinese solemn ancestral ritual ceremony music, slow and sacred, deep bronze bell chimes and stone chimes and ceremonial drums, sparse reverent,  ritual offering to ancestors in a zongmiao temple, austere and dignified, cinematic instrumental ambient, spring and autumn period"
PROMPTS[bgm_ending_gong]="ancient chinese music of hope and renewal, the people taking power together, warm uplifting and communal, gentle rising guqin and flute blossoming into a hopeful full ensemble, dawn of a fair commonwealth, emotional and resolving, cinematic instrumental, spring and autumn period"
PROMPTS[bgm_ending_jia]="ancient chinese dynastic imperial music, the founding of a grand hereditary dynasty, heavy and majestic and solemn, deep ceremonial drums and bronze bells, grandeur with a weight of absolute power, awe and gravity, cinematic orchestral instrumental, spring and autumn period"
PROMPTS[bgm_ending_huo]="ancient chinese bustling prosperous market music, an age of merchants and wealth and trade, lively and bright, plucked strings and bamboo flute and cheerful light percussion, busy thriving commerce, energetic and worldly, cinematic instrumental, spring and autumn period"

ORDER=(bgm_prosper_mid bgm_prosper_high bgm_war bgm_ritual bgm_ending_gong bgm_ending_jia bgm_ending_huo)

for key in "${ORDER[@]}"; do
  echo "==== generating $key ===="
  outdir="art-library/audio/music/$key"
  python scripts/gen_music.py --n 1 --out "$outdir" --prompt "${PROMPTS[$key]}"
  mp3=$(ls -t "$outdir"/*.mp3 2>/dev/null | head -1)
  if [ -n "$mp3" ] && [ -f "$mp3" ]; then
    cp "$mp3" "public/audio/$key.mp3"
    echo "WIRED $key <- $mp3"
  else
    echo "MISSING_MP3 $key"
  fi
done
echo "==== BGM batch done ===="
ls -la public/audio/
