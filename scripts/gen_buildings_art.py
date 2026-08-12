"""邦国录 · 补齐 17 栋建筑原画（复用 D:/code/scripts/gen_wanxiang_batch.py 的春秋校正 STYLE_TAIL + async 管线）。

用法：
  python scripts/gen_buildings_art.py --model wan2.7-image-pro                 # 全部
  python scripts/gen_buildings_art.py --model wan2.7-image --only bld_well,bld_market   # 子集/换模型
额度顺序由调用方用 --model 控制（pro 33 → image 50 → pro 20）。输出 public/art/buildings/<bld_id>.png。
"""
from __future__ import annotations
import argparse
import json
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, "D:/code/scripts")
import gen_wanxiang_batch as gw  # noqa: E402  复用 submit_one / poll_one / Job

# 2026-06-03：改真等距(2:1 dimetric)建筑精灵——footprint 是菱形、与等距地面网格对齐（用户选 A 重画）。
ISO_STYLE = (
    "TRUE ISOMETRIC video-game building sprite, strict 2:1 dimetric projection viewed from the fixed classic "
    "isometric camera angle (exactly like Age of Empires II, Caesar III, Pharaoh, Nebuchadnezzar isometric "
    "building sprites). The building stands on a FLAT DIAMOND/RHOMBUS ground footprint that follows the 2:1 "
    "isometric grid (ground tile edges recede at the isometric angle — NOT a square, NOT a front-on 3/4 view). "
    "Camera looks down at the isometric angle: you see the roof and two walls in iso. "
    "Spring and Autumn period (770-476 BC) pre-imperial bronze-age rural China: rammed-earth walls, raw timber, "
    "weathered grey unglazed tile roofs, low fieldstone base. NO glaze, NO vermilion lacquer, NO flying upturned "
    "eaves, NO imperial features. Painted in Anno1404 / Nebuchadnezzar concept-art style, heavily desaturated "
    "earthy tones, thick visible brushwork, ultra-detailed. Pure pitch-black void background (will be cut to "
    "transparent), the diamond footprint centered in frame, the whole building fully visible with a small margin. "
    "Cinematic light from the upper-right. "
    "ABSOLUTELY NOT: front-on elevation, 3/4 perspective, square footprint, anime, manga, cartoon, flat vector, "
    "cel shading, 3D PBR render, text, watermark, frame, people."
)

# (bld_id, 建筑描述)——春秋(770-476 BC)写实，材料=夯土/原木/灰陶瓦/毛石，含完整性强制(门/梯/阶)
BUILDINGS: list[tuple[str, str]] = [
    ("bld_farm",
     "A Spring and Autumn period (770-476 BC) Chinese peasant farm plot. Cultivated rectangular field strips of millet and wheat with raised earth ridges and a small irrigation ditch running between them. At one corner a tiny rough field shelter: four bare timber posts holding a low thatch lean-to roof, storing a wooden ard-plough and hoes. A patient ox stands yoked near the field. Scattered: a woven basket, a clay water jar, a straw hat hung on a post. Open farmland, low fieldstone markers at the plot edge."),
    ("bld_well",
     "A Spring and Autumn period (770-476 BC) Chinese village water well. A round well-mouth ringed by a low rough fieldstone curb, knee height. MANDATORY: a CLEARLY VISIBLE wooden windlass — two forked timber posts holding a horizontal log axle with a hand-crank, a hemp rope wound on it descending into the well, a wooden bucket hanging from the rope. A small four-post thatch canopy shades the well-mouth. Around the base: several unfired clay water jars, a wooden trough, a puddle of spilled water on the packed dirt, a worn stone slab path."),
    ("bld_market",
     "A Spring and Autumn period (770-476 BC) Chinese open-air rural market. NOT a grand building — a cluster of simple temporary trade stalls around an open packed-dirt plaza. Each stall is four bare timber poles holding a slanted reed-mat or thatch awning over a low wooden trestle table or woven floor mat. Goods spread out: stacked grey pottery jars, piled grain in open sacks, bolts of undyed hemp cloth, bundled firewood, baskets of vegetables, hanging dried fish. A couple of plain pennant flags on poles mark the market. Worn dirt ground, a hitching rail to one side."),
    ("bld_woodcutter",
     "A Spring and Autumn period (770-476 BC) Chinese woodcutter's logging yard. An open-sided work shelter: bare timber posts holding a low thatch roof over a work area. MANDATORY visible: a large tree-stump chopping block with a bronze-headed axe embedded in it, and a long sawpit (a trench with a felled log over it for two-man pit-sawing). Stacks of felled timber logs and split firewood piled high, loose wood chips and bark scattered over the dirt, a wooden sledge for hauling logs, a coil of hemp rope. Rammed-earth low wall on one side."),
    ("bld_quarry",
     "A Spring and Autumn period (770-476 BC) Chinese stone quarry. A cut grey rock face / shallow open pit with stepped ledges where stone has been hewn out. Several large rough-cut rectangular stone blocks sit on the ground, some half-split with wooden wedges driven into drill-line holes. MANDATORY visible: heavy timber levers, a wooden sledge with log rollers under a block, hemp ropes. A simple workers' lean-to of timber and thatch at the pit edge for shade, with stone chisels and mallets on a bench. Rock dust and rubble over the ground."),
    ("bld_loom_house",
     "A Spring and Autumn period (770-476 BC) Chinese state weaving workshop (zhiguan). A three-bay timber-frame building with grey unglazed tile single-tier hip roof and rammed-earth walls, the front bay open-sided showing the interior. MANDATORY visible inside: two or three wooden floor looms with warp threads stretched on them. Outside under the eave: long bamboo poles strung with lengths of drying undyed and earth-dyed hemp/silk cloth, woven baskets heaped with spun thread and silk cocoons, a dye vat of dark liquid. Bare timber columns, low fieldstone base, a plank-wood door."),
    ("bld_smithy",
     "A Spring and Autumn period (770-476 BC) Chinese bronze foundry workshop. A timber-and-rammed-earth open-fronted workshop with grey tile roof, soot-blackened around the opening. MANDATORY visible: a domed clay smelting furnace with a leather double-bag bellows beside it, glowing orange embers inside, a clay crucible held in tongs. On a heavy stone work-bench: bronze casting moulds (piece-moulds), cast bronze ingots, a half-finished bronze ritual vessel and a bronze halberd blade. Charcoal heaps, ash, soot stains on the walls, bronze-green oxidation tints. Austere industrious atmosphere."),
    ("bld_academy",
     "A Spring and Autumn period (770-476 BC) Chinese scholars' academy (xuegong). A dignified three-bay rectangular hall, larger and statelier than a commoner house but austere, with a grey unglazed tile single-tier hip roof, bare raw timber columns forming a front portico, rammed-earth walls. A LOW two-step fieldstone foundation. MANDATORY: a CLEARLY VISIBLE central stone stair of two steps up to a plain plank-wood double door. In the swept dirt forecourt: low wooden writing desks under the portico, stacks of bound bamboo-slip books, an old gnarled tree giving shade, a bronze water basin. No carving, no color, no ornament."),
    ("bld_palace",
     "A Spring and Autumn period (770-476 BC) Chinese feudal-state ruler's palace — the grandest building of a small state but STILL pre-imperial and austere, NOT a Tang/Ming imperial palace. A large multi-bay timber hall with a grey unglazed tile single-tier hip roof on a LOW rammed-earth platform (knee-to-waist height, NOT a tall white-stone terrace). Bare heavy timber columns across a deep front portico. MANDATORY: a CLEARLY VISIBLE wide central earthen-and-fieldstone stair leading up the platform to a large plank-wood double door. A rammed-earth perimeter wall with a timber gatehouse encloses a dirt courtyard; a large bronze ritual ding tripod stands on each side of the stair. Dignified, weighty, but unpainted and unornamented — no glaze, no vermilion, no flying eaves."),
    ("bld_beacon_tower",
     "A Spring and Autumn period (770-476 BC) Chinese frontier signal beacon tower (fengsui). A tall square tapering tower of rammed earth and exposed timber bracing, much taller than it is wide. MANDATORY visible: an iron/bronze fire-basket brazier on the flat top platform for sending smoke-and-fire signals, and a CLEARLY VISIBLE rough wooden ladder running up one side of the tower to the top platform, which has a low timber railing. At the base: a small rammed-earth guard hut with thatch roof, a stack of firewood and bundled dry brush (and wolf-dung) for signal smoke, a bronze-tipped spear leaning by the door. Lonely windswept frontier mood."),
    ("bld_post_road",
     "A Spring and Autumn period (770-476 BC) Chinese post road relay station (yi). A straight packed-earth highway crossing the scene, with a small timber-and-thatch courier relay hut beside it. MANDATORY visible: a wooden hitching rail with a horse tethered to it, and a low stone milestone marker at the roadside. A simple open thatch shelter with a bench where couriers rest, a water trough for horses, a wooden signpost with plain bamboo-slip tags hanging from it. Cart ruts worn into the road, a two-wheeled wooden cart parked nearby. Open travelled countryside."),
    ("bld_water_mill",
     "A Spring and Autumn period (770-476 BC) Chinese water-powered trip-hammer for hulling grain (shuidui). A timber-frame structure straddling a flowing stream, with a grey tile / thatch roof. MANDATORY visible: a large wooden undershot water-wheel turned by the stream current, its axle fitted with cams that lift and drop a pivoted timber tilt-hammer pounding grain in a stone mortar set in the ground. Sacks of unhulled and hulled grain stacked beside it, a wooden scoop, splashing water and wet stones, a plank footbridge over the stream. Green moss on the wet timber and stones."),
    ("bld_iron_forge",
     "A late Spring and Autumn period (770-476 BC) Chinese iron-smelting works (yetie), grittier and larger than a bronze smithy. A tall clay bloomery shaft furnace with a large leather bellows worked at its base, glowing red-orange molten iron and sparks at the tap-hole. MANDATORY visible: a heavy stone anvil with iron hammers, a spongy iron bloom gripped in long tongs, stacked iron bars. A dark slag heap and charcoal piles beside the furnace, a timber-and-earth open shed with grey tile roof heavily blackened by soot, smoke rising. Heat-haze, embers, heavy industrial labour atmosphere — but bronze-age/early-iron-age authentic, no machinery."),
    ("bld_mulberry_grove",
     "A Spring and Autumn period (770-476 BC) Chinese mulberry orchard for sericulture (sangyuan). Neat rows of pollarded mulberry trees with broad green leaves on cultivated earth ridges. MANDATORY visible: a small caretaker's hut of rammed earth and thatch at the edge of the grove, and woven bamboo leaf-baskets propped against the trees and on the ground, some piled with picked mulberry leaves. A low wooden fence of lashed branches around the grove, a wooden ladder leaning against a tree for picking, a couple of flat silkworm-rearing trays stacked by the hut. Dappled afternoon light through the leaves."),
    ("bld_stele_yard",
     "A Spring and Autumn period (770-476 BC) Chinese stone stele yard (where law/ritual texts are carved in stone). Several tall upright rough grey stone steles standing in a row on a swept dirt yard, their faces carved with columns of incised archaic seal-script glyphs (no readable modern text, just suggestion of carving). MANDATORY visible: a half-finished stele lying on heavy wooden trestle supports with a stonemason's iron chisel and wooden mallet resting on it, and stone chips scattered on the ground. A low rammed-earth wall with a simple timber gate encloses the yard, a thatch lean-to shelters the mason's tools and a water jar."),
    ("bld_village_school",
     "A Spring and Autumn period (770-476 BC) Chinese village school (shu), modest and small. A single-bay timber-and-rammed-earth building with a grey unglazed tile and thatch roof, smaller and humbler than an academy. The plank-wood front door stands open. MANDATORY visible through the open door: a few low wooden writing desks and a teacher's slightly raised seat. Bare timber columns, a low fieldstone base, one shallow step at the door. In the small dirt yard: a single old tree, bundles of bamboo writing-slips stacked under the eave, an ink-grinding stone on a bench, a hand-bell hanging by the door."),
    ("bld_envoy_lodge",
     "A Spring and Autumn period (770-476 BC) Chinese diplomatic guest lodge (keguan) for visiting envoys of other states. A comfortable multi-room single-story timber lodge with a grey unglazed tile single-tier hip roof and rammed-earth walls, more cared-for than common dwellings but still austere and unpainted. A rammed-earth perimeter wall encloses a tidy dirt courtyard. MANDATORY: a CLEARLY VISIBLE timber double-leaf gate in the front wall, two timber gateposts and a horizontal lintel, the gate open in welcome. Outside the gate: a hitching post with a visiting envoy's horse and a two-wheeled wooden chariot, two plain pennant flags on poles flanking the gate. Inside: a swept courtyard with a water jar and a small tree."),
    # ===== 2026-06-19：补齐 13 栋缺图建筑（之前走文字沙印占位）=====
    ("bld_pottery_kiln",
     "A Spring and Autumn period (770-476 BC) Chinese pottery kiln workshop. MANDATORY visible: a sloped earthen updraft/dragon kiln built of rammed earth and clay banked against a low mound, a stoking firebox mouth at the bottom glowing orange with embers and a thin wisp of smoke rising from the top vent. Beside it: rows of freshly thrown grey earthenware pots, jars and tripod vessels drying on wooden plank racks and on the ground, a foot-powered potter's wheel under a small four-post thatch lean-to, mounds of raw grey clay and stacked firewood. Ash and clay dust over the packed dirt, a water jar."),
    ("bld_granary",
     "A Spring and Autumn period (770-476 BC) Chinese grain granary storehouse. MANDATORY: a sturdy raised wooden storehouse lifted off the ground on short stone-and-timber stilt posts (keeping grain dry and away from vermin), with a steep overhanging grey thatch-and-tile gable roof and plank-board walls, and a CLEARLY VISIBLE short wooden ramp or ladder up to a plank door. Beside it: stacked woven straw grain sacks and sealed clay storage jars, a round woven grain silo with a conical thatch cap, a wooden grain-measuring scoop, loose millet spilled on the packed dirt. Solid, well-built, full-harvest abundance feel."),
    ("bld_watchtower",
     "A Spring and Autumn period (770-476 BC) Chinese timber scout watchtower, smaller and lighter than a stone beacon tower. MANDATORY: a tall four-post timber-frame observation tower, taller than wide, with diagonal cross-bracing and a CLEARLY VISIBLE wooden ladder climbing to a small railed lookout platform at the top sheltered by a simple thatch canopy. A signal drum and a bronze-tipped spear lean on the platform. At the base: a small rammed-earth guard hut, a fence of lashed timber stakes, a plain pennant on a pole. Lonely frontier vigilance mood."),
    ("bld_censor",
     "A Spring and Autumn period (770-476 BC) Chinese censor's inspection hall — the austere office that audits officials. A dignified single-bay timber hall with a grey unglazed tile hip roof on a low fieldstone base, bare timber columns and a plank-wood double door. MANDATORY: a CLEARLY VISIBLE central two-step stone stair up to the door, and a tall plain bronze petition-bell hanging from a timber frame in the swept dirt forecourt (rung to report wrongdoing). A standing stone tablet, low desks with stacked bamboo-slip records under the eave. Solemn, upright, judicial atmosphere, unpainted and unornamented."),
    ("bld_grand_temple",
     "A Spring and Autumn period (770-476 BC) Chinese ancestral grand temple — the most sacred hall of the state, large and imposing but PRE-IMPERIAL and austere (NOT a Ming temple, no glaze, no vermilion, no flying eaves). A tall multi-bay timber hall with a broad grey unglazed tile single-tier hip roof on a substantial rammed-earth platform, a deep front portico of massive bare timber columns. MANDATORY: a CLEARLY VISIBLE wide central earthen-and-fieldstone ceremonial stair up to large plank-wood double doors, flanked by large bronze ritual ding tripod vessels, with smoke rising from a bronze incense brazier in the swept ritual courtyard enclosed by a rammed-earth wall. Weighty, sacred, solemn."),
    ("bld_observatory",
     "A Spring and Autumn period (770-476 BC) Chinese astronomical observation platform for watching stars and celestial omens. MANDATORY: a stepped rammed-earth and fieldstone terrace raised in tiers, with a CLEARLY VISIBLE stone stair climbing to a flat top observation deck ringed by a low timber railing. On the top deck: a vertical bronze shadow-gnomon pole set in a carved stone base and a simple bronze sighting tube on a stand, a low table with rolled bamboo star-charts. A small timber-and-thatch scholars' hut at the base. Quiet, contemplative, night-watch mood, austere."),
    ("bld_relay_station",
     "A Spring and Autumn period (770-476 BC) Chinese courier relay post-house (a dedicated station, statelier than a roadside hut). A tidy single-story timber-and-rammed-earth building with a grey tile roof and one open-fronted bay. MANDATORY visible: a long wooden hitching rail with two fresh relay horses tethered, and a CLEARLY VISIBLE signpost board hung with bamboo-slip message tags. A two-wheeled wooden courier cart parked at the side, a water trough, a mounting block, an announcing drum, bundled scrolls. Worn cart ruts in the packed-earth yard, a low timber fence."),
    ("bld_nine_cauldrons",
     "A Spring and Autumn period (770-476 BC) Chinese shrine of the Nine Sacred Bronze Ding Cauldrons — the supreme symbol of the Mandate of Heaven. MANDATORY centerpiece: NINE massive ceremonial bronze tripod ding vessels, each with three legs and two upright handles, dark patinated bronze-green with archaic taotie motifs, arranged in rows on a raised rammed-earth and fieldstone ceremonial terrace reached by a CLEARLY VISIBLE central stone stair. An open-air timber pavilion with a grey tile roof on bare columns shelters them; bronze incense braziers with rising smoke flank the cauldrons, ritual banners on poles. Awe-inspiring, supremely sacred, austere pre-imperial bronze-age grandeur."),
    ("bld_training_ground",
     "A Spring and Autumn period (770-476 BC) Chinese military training ground and drill yard. MANDATORY: a large open swept packed-earth drill field with a row of wooden practice pells (striking posts) and straw archery targets at one end, and a CLEARLY VISIBLE timber weapon-rack holding bronze halberds (ge), spears and large shields. At the side: a low timber-and-thatch open arms shed, a raised timber commander's reviewing stand, a war drum on a frame, a banner pole with a plain pennant. A rammed-earth low wall around the yard. Disciplined martial atmosphere, dust on the ground."),
    ("bld_stable",
     "A Spring and Autumn period (770-476 BC) Chinese cavalry horse stable. MANDATORY: a long open-fronted timber stable building with a grey thatch-and-tile roof divided into stalls, with two or three horses standing in the stalls and one tethered outside, and a CLEARLY VISIBLE timber-fenced paddock corral attached to one side. Feed troughs of grain and hay, woven hay bales stacked under the eave, a water trough, harness and bronze horse-bits hanging on the timber posts, straw and a dung heap on the ground. Rammed-earth low base, lived-in working feel."),
    ("bld_chariot_works",
     "A Spring and Autumn period (770-476 BC) Chinese war-chariot workshop. An open-sided timber-frame workshop with a grey tile roof. MANDATORY visible: a half-built two-wheeled wooden war chariot up on trestle blocks with one large multi-spoked wheel mounted and another leaning beside it, and a CLEARLY VISIBLE wheelwright's bending-jig with stacks of steam-bent wheel rims and spokes. Bronze chariot fittings and axle-caps on a heavy workbench, seasoning timber planks racked, wood shavings and sawdust over the dirt, bronze woodworking tools, coils of leather lashing. Skilled craft-industry atmosphere."),
    ("bld_city_wall",
     "A Spring and Autumn period (770-476 BC) Chinese city defensive rampart section, a LONG LOW structure much wider than deep (it sits on a long elongated diamond footprint). MANDATORY: a long massive section of rammed-earth (hangtu) fortification wall, thick battered earthen ramparts faced with rough fieldstone at the base, a flat walkable top parapet with a low crenellated timber palisade, and a CLEARLY VISIBLE timber stair or earthen ramp up to the wall-walk at one end with a small timber gate-tower. Bronze-tipped spears stacked on the parapet, a banner pennant. Imposing, defensive, weathered earthen mass."),
    ("bld_imperial_guard",
     "A Spring and Autumn period (770-476 BC) Chinese royal guard garrison hall housing the elite palace guards, sturdier and more martial than a common barracks. A solid imposing two-bay timber-and-rammed-earth barracks hall with a grey unglazed tile hip roof on a fieldstone base. MANDATORY: a CLEARLY VISIBLE timber gateway flanked by two armed guard posts, and a weapon-rack of bronze halberds and tall shields beside the gate. A walled drill courtyard with a banner pole and a war drum, racks of lamellar armour on stands under the eave, a watch-brazier. Elite, disciplined, well-equipped, austere pre-imperial military feel."),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="D:/code/colony-game/public/art/buildings")
    ap.add_argument("--size", default="1024*1024")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--model", default="wan2.7-image-pro")
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    if not gw.KEY:
        print("[FAIL] WANXIANG_API_KEY missing")
        return 2
    gw.MODEL = args.model  # 额度控制：调用方指定模型

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    only = {x.strip() for x in args.only.split(",") if x.strip()}
    jobs = [gw.Job(id=bid, desc=d, prompt=f"{d} {ISO_STYLE}") for bid, d in BUILDINGS if not only or bid in only]
    if not jobs:
        print(f"[FAIL] no jobs match --only={args.only}")
        return 2
    print(f"[batch] {len(jobs)} jobs, model={gw.MODEL}, size={args.size}, out={out_dir}")

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(gw.submit_one, j, args.size): j for j in jobs}
        for f in as_completed(futs):
            j = f.result()
            print(f"  [submit-{'ok' if j.task_id else 'err'}] {j.id} -> {j.task_id or j.error}")

    submitted = [j for j in jobs if j.task_id]
    if not submitted:
        print("[FAIL] zero submitted")
        return 1
    print(f"[batch] polling {len(submitted)} ...")
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(gw.poll_one, j, out_dir): j for j in submitted}
        for f in as_completed(futs):
            j = f.result()
            print(f"  [{'done' if j.saved else 'fail'}] {j.id} ({j.elapsed_s:.0f}s) -> {j.saved or j.error}")

    manifest = out_dir / f"manifest_buildings_{int(time.time())}.json"
    manifest.write_text(json.dumps([
        {"id": j.id, "model": gw.MODEL, "task_id": j.task_id, "saved": j.saved, "error": j.error} for j in jobs
    ], indent=2, ensure_ascii=False), encoding="utf-8")
    ok = sum(1 for j in jobs if j.saved)
    print(f"[batch] {ok}/{len(jobs)} succeeded -> manifest {manifest}")
    return 0 if ok == len(jobs) else 1


if __name__ == "__main__":
    sys.exit(main())
