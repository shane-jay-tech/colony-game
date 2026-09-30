# -*- coding: utf-8 -*-
"""suite-timings 台账生成器（c927-57：把 tmp/ 临时生成器扶正为长期可复跑脚本）。

背景（c922-09 遗留 1 + c927-57 任务书）：docs/insights/colony-suite-timings-20260921.json
是静态快照，新增测试即"过期"——已连续发生三次刷新史（c922-07 首版 → c923-12 → c924-12），
且刷新脚本一直住在不入库的 tmp/ 里，长期不可复跑。本脚本把它变成一条命令：

    1) npx vitest run --reporter=json --outputFile=tmp/<班名>/vitest.json
    2) python scripts/suite_timings_ledger.py --from tmp/<班名>/vitest.json \\
           --produced-by "<班名/单号>（一句话现场说明）"

漂移机制（c927-57 落地）：台账头部带 driftPolicy——计数是**生成时点值**而非断言，
新增/删除测试不算台账失真、不阻塞任何功能单（区间容忍语义：刷新前后的差值即漂移量，
逐次记进 refreshHistory）；要新鲜读数就跑上面两条命令，不要求功能单顺手刷新。

用法（生成器本体）：
    python scripts/suite_timings_ledger.py --from <vitest.json> [--out <台账路径>] \\
        [--produced-by <署名>] [--git-head <hash>]
只读 vitest 输出与既有台账；唯一写点是 --out 指定的台账文件。
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DEFAULT_LEDGER = BASE / "docs" / "insights" / "colony-suite-timings-20260921.json"

DRIFT_POLICY = (
    "漂移机制（c927-57 定稿）：本台账的 testFiles/tests 计数与逐文件耗时都是【生成时点值】，"
    "不是断言基线——功能单新增/删除测试**不构成台账失真**，无需顺手刷新、也不得被当成回归信号；"
    "刷新前后的计数差即漂移量，由 refreshHistory 逐次留痕（区间容忍语义）。"
    "要新鲜读数时跑两条命令重生成：npx vitest run --reporter=json --outputFile=tmp/<班名>/vitest.json "
    "&& python scripts/suite_timings_ledger.py --from tmp/<班名>/vitest.json --produced-by <班名>。"
    "其余口径（文件墙钟/并发污染/跨次只比 totals 与 top 序）沿 ledgerMaintenanceNote 不变。"
)


def _load_vitest(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if "testResults" not in data:
        raise SystemExit(f"{path} 不像 vitest JSON 输出（缺 testResults）")
    return data


def _file_rows(vitest: dict) -> list[dict]:
    rows = []
    base_posix = str(BASE).replace("\\", "/")
    for tr in vitest.get("testResults", []):
        name = tr.get("name", "")
        posix = name.replace("\\", "/")
        rel = posix[len(base_posix) + 1:] if posix.startswith(base_posix + "/") else posix
        start, end = tr.get("startTime"), tr.get("endTime")
        dur = max(0, int(end - start)) if start and end else 0
        # assertionResults 在文件级就是扁平数组；tests 数直接取其长度
        n = len(tr.get("assertionResults", []) or [])
        rows.append({"file": rel, "tests": n, "durationMs": dur})
    total_wall = sum(r["durationMs"] for r in rows) or 1
    for r in rows:
        r["sharePct"] = round(r["durationMs"] * 100.0 / total_wall, 2)
    rows.sort(key=lambda r: r["durationMs"], reverse=True)
    return rows


def build(args) -> dict:
    vitest = _load_vitest(Path(args.from_))
    rows = _file_rows(vitest)
    totals = {
        # numTotalTestSuites 含嵌套 describe（600 级），台账口径 = 测试文件数（沿 c922-07 首版）
        "testFiles": len(rows),
        "tests": vitest.get("numTotalTests"),
        "passed": vitest.get("numPassedTests"),
        "failed": vitest.get("numFailedTests"),
        "pending": vitest.get("numPendingTests"),
    }
    now = datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")
    produced_by = args.produced_by or "suite_timings_ledger.py（未署名刷新）"

    ledger = {
        "ledgerMaintenanceNote": (
            "口径头注：本台账由 scripts/suite_timings_ledger.py 维护（c927-57 起长期可复跑），"
            "不随功能单顺手改；每次刷新用同一条 vitest command、同一次 run 的读数整体重生成，"
            "不得手填单个文件耗时。durationMs 是文件级墙钟（endTime-startTime），并发跑测时互相污染，"
            "跨次比较只比 totals 与 top 序、不比绝对毫秒。刷新史：c922-07 首版 → c923-12 → c924-12 "
            "→ c927-57 起脚本化。"
        ),
        "driftPolicy": DRIFT_POLICY,
        "generatedAt": "2026-09-21T21:56:50+0800",
        "regeneratedAt": now,
        "producedBy": produced_by,
        "command": "npx vitest run --reporter=json --outputFile=tmp/<班名>/vitest.json",
        "measureNote": (
            "durationMs = 该文件 endTime-startTime（含 collect/setup 的文件墙钟），"
            "非 vitest 终端 summary 的 tests 汇总口径；本表总和可大于并跑墙钟——"
            "文件是并发跑的，本表用于「哪个文件慢」排序，不可当套件总时长用。"
        ),
        "gitHead": args.git_head or _git_head(),
        "totals": totals,
        "top10": rows[:10],
        "files": rows,
        "byDir": _by_dir(rows),
        "refreshHistory": _refresh_history(args),
    }
    return ledger


def _by_dir(rows: list[dict]) -> dict:
    out: dict[str, dict] = {}
    for r in rows:
        d = "/".join(r["file"].split("/")[:-1]) or "."
        agg = out.setdefault(d, {"tests": 0, "durationMs": 0, "files": 0})
        agg["tests"] += r["tests"]
        agg["durationMs"] += r["durationMs"]
        agg["files"] += 1
    return dict(sorted(out.items(), key=lambda kv: kv[1]["durationMs"], reverse=True))


def _git_head() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=BASE,
                              capture_output=True, text=True).stdout.strip()
    except Exception:
        return "unknown"


def _refresh_history(args) -> list[dict]:
    """继承既有台账的刷新链（漂移逐次留痕），并追加本次。"""
    history: list[dict] = []
    out = Path(args.out)
    if out.exists():
        try:
            prev = json.loads(out.read_text(encoding="utf-8"))
            history = list(prev.get("refreshHistory") or [])
            # 旧台账无链时，把上一版的信息折叠成首条
            if not history:
                history.append({
                    "at": prev.get("regeneratedAt") or prev.get("generatedAt"),
                    "producedBy": prev.get("producedBy"),
                    "totals": prev.get("totals"),
                })
        except Exception as e:  # 旧台账损坏也不阻断重生成
            print(f"[warn] 旧台账读取失败（{e}），刷新链从头记", file=sys.stderr)
    history.append({
        "at": datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S%z"),
        "producedBy": args.produced_by or "suite_timings_ledger.py（未署名刷新）",
        "totals": None,  # 占位，build() 返回前回填
    })
    return history


def main() -> int:
    ap = argparse.ArgumentParser(description="colony 套件耗时台账生成器（c927-57）")
    ap.add_argument("--from", dest="from_", required=True, help="vitest --reporter=json 的输出文件")
    ap.add_argument("--out", default=str(DEFAULT_LEDGER), help="台账输出路径（默认现台账）")
    ap.add_argument("--produced-by", help="本次刷新署名（班名/单号）")
    ap.add_argument("--git-head", help="生成时 HEAD（默认自动取）")
    args = ap.parse_args()

    ledger = build(args)
    # 回填 refreshHistory 末条的 totals
    ledger["refreshHistory"][-1]["totals"] = ledger["totals"]

    out = Path(args.out)
    out.write_text(json.dumps(ledger, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"ledger regenerated: {out}")
    print(f"totals: {json.dumps(ledger['totals'], ensure_ascii=False)}")
    print(f"refreshHistory entries: {len(ledger['refreshHistory'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
