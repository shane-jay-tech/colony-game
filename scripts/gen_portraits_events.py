"""邦国录 · 生成将领立绘 + 事件插画（复用 D:/code/scripts/gen_wanxiang_batch.py 的 async 管线）。

与建筑不同：人物/场景**不是等距、不需要黑底**（是肖像/场景画，带柔和背景）。故另起一套风格尾。

用法：
  python scripts/gen_portraits_events.py --model wan2.7-image-pro                 # 全部(5将领+10事件)
  python scripts/gen_portraits_events.py --only gen_pei_shao,evt_art_battle       # 子集
  python scripts/gen_portraits_events.py --kind generals|events                   # 只做一类
输出：将领 → public/art/generals/<id>.png（竖图）；事件 → public/art/events/<name>.png（16:9）。
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

# 将领立绘风格尾——春秋写实人物半身像，柔和背景（非黑底），禁秦汉后元素。
PORTRAIT_STYLE = (
    "Character portrait of a Spring and Autumn period (770-476 BC) pre-imperial ancient Chinese figure, "
    "half-body waist-up, three-quarter view facing the viewer, dignified expression. "
    "Bronze-age military costume: lamellar leather-and-bronze scale armor over a hemp/silk robe, cloth headwrap or "
    "simple bronze helm. STRICTLY pre-Qin: NO Ming/Qing dynasty costume, NO steel plate armor, NO flying upturned "
    "eaves behind, NO red lacquer. Painted in classical Chinese ink-and-color painting fused with Western portrait "
    "oil painting, heavily desaturated earthy tones, thick brushwork, ultra-detailed face. "
    "Soft neutral or blurred rammed-earth/landscape background (NOT pure black). Cinematic light from upper-right. "
    "ABSOLUTELY NOT: anime, manga, cartoon, chibi, cel shading, flat vector, 3D PBR render, modern clothing, text, watermark, frame."
)

# 事件插画风格尾——春秋历史场景，16:9 横构图，完整背景。
SCENE_STYLE = (
    "Historical scene illustration of the Spring and Autumn period (770-476 BC) pre-imperial ancient China, "
    "wide 16:9 cinematic composition with multiple period-accurate figures and rammed-earth / raw-timber / grey-tile "
    "architecture. STRICTLY pre-Qin/Han: NO red lacquered imperial palace, NO flying upturned eaves, NO Ming/Qing "
    "costume. Classical Chinese landscape painting fused with Western concept-art oil painting, heavily desaturated "
    "earthy cinematic palette, dramatic lighting, rich historical detail, masterpiece quality. "
    "ABSOLUTELY NOT: anime, manga, cartoon, chibi, flat vector, 3D PBR render, text, watermark, frame, modern elements."
)

# (id, 中文人物设定)——5 将领
GENERALS: list[tuple[str, str]] = [
    ("gen_pei_shao",
     "A composed veteran general about forty years old, sharp steady eyes, short beard, wearing layered bronze-studded "
     "leather armor over a dark robe, one hand resting on the hilt of a sheathed bronze sword. Authoritative, inspiring, calm."),
    ("gen_hu_ben",
     "A fierce muscular young warrior in his late twenties, fur-trimmed leather armor and a bronze pauldron, a faint scar on "
     "the brow, intense fearless glare, gripping a bronze dagger-axe (ge). Aggressive, ambush-ready, wild energy."),
    ("gen_xie_changqing",
     "A steady older defensive commander, weathered face, grey at the temples, plain sturdy lamellar armor, a round bronze-rimmed "
     "shield on the arm, frugal and unadorned. Patient, reliable, guardian-like."),
    ("gen_tian_zhong",
     "A kindly scholar-soldier in his fifties, gentle dignified face, simple cloth robe with light leather armor, holding a bamboo "
     "slip in one hand. Warm, inspiring, modest and thrifty in bearing."),
    ("gen_barbarian",
     "A surrendered frontier general of a non-Zhou tribe, foreign-styled fur and hide garb with bone/bronze ornaments, a wary but "
     "proud weathered face, braided hair. An outsider warlord now serving a new lord."),
]

# (id_no_prefix, 中文场景设定)——10 事件插画（artManifest 的 evt_art_*）
EVENTS: list[tuple[str, str]] = [
    ("unification",
     "The moment of unification: on a windswept plain the banners of many small rival states topple and fall, while one great "
     "banner rises tall; rows of vanquished feudal lords kneel in submission before it. Epic, solemn, historic."),
    ("coronation",
     "A pre-imperial coronation ceremony: a ruler in austere bronze-age ceremonial robes ascends the broad earthen-and-fieldstone "
     "stair of a grey-tiled timber ancestral hall; ranks of officials bow; large bronze ding tripod vessels flank the stair; incense smoke. Solemn, austere."),
    ("battle",
     "A great bronze-age battle: two armies clash on a dusty field, two-wheeled war chariots charging, archers loosing arrows, "
     "spearmen in lamellar armor, banners and war-drums, swirling dust and chaos."),
    ("flood",
     "A catastrophic river flood: a low rammed-earth farming village half-submerged, broken earthen dikes, peasants fleeing "
     "rising muddy water carrying baskets and children, grey storm sky. Desperate, somber."),
    ("feast",
     "A Spring and Autumn court banquet inside an austere timber hall: nobles seated on mats at low lacquer-free wooden tables, "
     "bronze wine vessels and ding, musicians with bells and zithers, warm lamplight. Refined but unornamented."),
    ("diplomacy",
     "A diplomatic meeting between two states: envoys in formal robes exchange jade and silk gifts before a timber guest-lodge "
     "gate, pennant flags of two states, attendants and a tethered chariot horse. Tense courtesy."),
    ("rebellion",
     "A brewing rebellion: angry commoners and disaffected soldiers gather with torches and improvised weapons before a "
     "rammed-earth town gate at dusk, fists raised, tension and unrest in the air."),
    ("ending_gong",
     "Allegory of the Commonwealth ('the realm belongs to all'): a harmonious idealized scene of people of all classes tending "
     "shared fields and deliberating together under open sky, equality and concord, warm hopeful light."),
    ("ending_jia",
     "Allegory of the Dynastic House ('the realm as family estate'): a single ruler enthroned on a raised earthen dais, "
     "hereditary heirs and bowing courtiers, centralized solemn power, shadowed grand hall."),
    ("ending_huo",
     "Allegory of the Mercantile Realm ('the realm ruled by wealth'): a bustling market dominated by rich merchants, "
     "scales and stacks of bronze coins and bolts of cloth, trade caravans, gold-tinged opportunistic atmosphere."),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="wan2.7-image-pro")
    ap.add_argument("--only", default="")
    ap.add_argument("--kind", default="", choices=["", "generals", "events"])
    ap.add_argument("--workers", type=int, default=3)
    args = ap.parse_args()

    if not gw.KEY:
        print("[FAIL] WANXIANG_API_KEY missing")
        return 2
    gw.MODEL = args.model

    base = Path("D:/code/colony-game/public/art")
    gen_dir = base / "generals"
    evt_dir = base / "events"
    gen_dir.mkdir(parents=True, exist_ok=True)
    evt_dir.mkdir(parents=True, exist_ok=True)

    only = {x.strip() for x in args.only.split(",") if x.strip()}

    jobs: list[tuple[gw.Job, str, Path]] = []  # (job, size, out_dir)
    if args.kind in ("", "generals"):
        for gid, d in GENERALS:
            if only and gid not in only:
                continue
            jobs.append((gw.Job(id=gid, desc=d, prompt=f"{d} {PORTRAIT_STYLE}"), "720*1280", gen_dir))
    if args.kind in ("", "events"):
        for ename, d in EVENTS:
            key = f"evt_art_{ename}"
            if only and key not in only and ename not in only:
                continue
            jobs.append((gw.Job(id=ename, desc=d, prompt=f"{d} {SCENE_STYLE}"), "1280*720", evt_dir))

    if not jobs:
        print(f"[FAIL] no jobs match (only={args.only} kind={args.kind})")
        return 2
    print(f"[batch] {len(jobs)} jobs, model={gw.MODEL}")

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(gw.submit_one, j, size): (j, size, od) for (j, size, od) in jobs}
        for f in as_completed(futs):
            j = f.result()
            print(f"  [submit-{'ok' if j.task_id else 'err'}] {j.id} -> {j.task_id or j.error}")

    submitted = [(j, od) for (j, size, od) in jobs if j.task_id]
    if not submitted:
        print("[FAIL] zero submitted")
        return 1
    print(f"[batch] polling {len(submitted)} ...")
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(gw.poll_one, j, od): j for (j, od) in submitted}
        for f in as_completed(futs):
            j = f.result()
            print(f"  [{'done' if j.saved else 'fail'}] {j.id} ({j.elapsed_s:.0f}s) -> {j.saved or j.error}")

    manifest = base / f"manifest_portraits_{int(time.time())}.json"
    manifest.write_text(json.dumps(
        [{"id": j.id, "saved": j.saved, "error": j.error} for (j, size, od) in jobs], indent=2, ensure_ascii=False),
        encoding="utf-8")
    ok = sum(1 for (j, size, od) in jobs if j.saved)
    print(f"[batch] {ok}/{len(jobs)} succeeded -> {manifest}")
    return 0 if ok == len(jobs) else 1


if __name__ == "__main__":
    sys.exit(main())
