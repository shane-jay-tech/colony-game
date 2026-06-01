"""邦国录 · 生成 5 张手绘地貌平铺贴图（万相，复用 gen_wanxiang_batch 的 async 管线）。

地貌专用风格尾:俯视 top-down、可平铺、均匀光照(无强方向阴影便于拼接)、无建筑无人。
输出 public/art/terrain/<type>.png。用法同建筑脚本:--model 控制额度。
"""
from __future__ import annotations
import argparse
import json
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, "D:/code/scripts")
import gen_wanxiang_batch as gw  # noqa: E402

TERRAIN_STYLE = (
    "Seamless tileable top-down overhead ground texture, aerial map view looking straight down from above, "
    "NO perspective, NO buildings, NO structures, NO people, NO animals. "
    "Painted in the official art style of Anno 1800 and Manor Lords: traditional digital oil painting, "
    "matte painting, visible brushwork, naturalistic and heavily desaturated dusty earth tones, "
    "Spring and Autumn period (770-476 BC) pre-imperial rural China landscape ground. "
    "EVEN flat overhead lighting with NO strong directional cast shadows (so the tile repeats cleanly), "
    "organic natural irregular variation across the whole frame, no single focal point, "
    "fills the entire square edge to edge, ultra-detailed 8k, ArtStation. "
    "ABSOLUTELY NOT: anime, cartoon, cel shading, flat vector, saturated colors, isometric angle, "
    "perspective view, any building, any path, any grid lines, text, watermark, border, vignette, frame."
)

TERRAINS: list[tuple[str, str]] = [
    ("plain", "Lush but earthy temperate grassland meadow with patches of cultivated millet field furrows and bare tilled soil, scattered wild grass tufts, small stones, dry and green mixed."),
    ("hills", "Dry rolling loess hill ground, ochre and tan packed earth with sparse dry yellow grass, subtle undulating contours, eroded soil, a few scattered rocks."),
    ("forest", "Dense temperate broadleaf forest canopy seen straight from directly above, tops of pine and locust and mulberry trees, layered green and umber foliage clumps, deep shadow gaps between crowns."),
    ("river", "Calm shallow river and stream water surface seen from above, gentle ripples and eddies, muddy green-brown water with subtle reflections, a few wet pebbles and reed patches at the edges."),
    ("mountain", "Bare rugged grey mountain rock ground from above, weathered fractured stone, cracks and scree, patches of moss and a little sparse alpine grass in crevices, cold grey and slate tones."),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="D:/code/colony-game/public/art/terrain")
    ap.add_argument("--size", default="1024*1024")
    ap.add_argument("--workers", type=int, default=2)  # 降并发避开限流
    ap.add_argument("--model", default="wan2.7-image-pro")
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    if not gw.KEY:
        print("[FAIL] WANXIANG_API_KEY missing")
        return 2
    gw.MODEL = args.model
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    only = {x.strip() for x in args.only.split(",") if x.strip()}
    jobs = [gw.Job(id=t, desc=d, prompt=f"{d} {TERRAIN_STYLE}") for t, d in TERRAINS if not only or t in only]
    if not jobs:
        print(f"[FAIL] no jobs match --only={args.only}")
        return 2
    print(f"[terrain] {len(jobs)} jobs, model={gw.MODEL}, out={out_dir}")
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(gw.submit_one, j, args.size): j for j in jobs}
        for f in as_completed(futs):
            j = f.result()
            print(f"  [submit-{'ok' if j.task_id else 'err'}] {j.id} -> {j.task_id or j.error}")
    submitted = [j for j in jobs if j.task_id]
    if not submitted:
        print("[FAIL] zero submitted")
        return 1
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(gw.poll_one, j, out_dir): j for j in submitted}
        for f in as_completed(futs):
            j = f.result()
            print(f"  [{'done' if j.saved else 'fail'}] {j.id} ({j.elapsed_s:.0f}s) -> {j.saved or j.error}")
    (out_dir / f"manifest_terrain_{int(time.time())}.json").write_text(
        json.dumps([{"id": j.id, "model": gw.MODEL, "saved": j.saved, "error": j.error} for j in jobs], indent=2, ensure_ascii=False),
        encoding="utf-8")
    ok = sum(1 for j in jobs if j.saved)
    print(f"[terrain] {ok}/{len(jobs)} ok")
    return 0 if ok == len(jobs) else 1


if __name__ == "__main__":
    sys.exit(main())
