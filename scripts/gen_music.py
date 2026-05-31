#!/usr/bin/env python3
"""
邦国录 · Mureka AI 音乐生成脚本（探活版）

用法：
  python scripts/gen_music.py --prompt "ancient chinese, guqin..." --n 1 --out art-library/audio/music
  python scripts/gen_music.py --query <id>      # 单独查某个任务

密钥读 .env.local 的 MUREKA_API_KEY（不进代码、不进 git）。
第一次跑会把每步的原始 JSON 打出来，方便确认字段格式，之后再精修。
"""
import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = "https://api.mureka.cn/v1"

# Windows 控制台 GBK 会把中文 print 显示成乱码，强制 UTF-8 输出
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def load_key() -> str:
    """从 .env.local 读 MUREKA_API_KEY（优先环境变量）。"""
    key = os.environ.get("MUREKA_API_KEY")
    if key:
        return key
    here = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(os.path.dirname(here), ".env.local")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                if k.strip() == "MUREKA_API_KEY":
                    return v.strip().strip('"').strip("'")
    sys.exit("ERROR: MUREKA_API_KEY 未找到（检查 .env.local）")


def api(method: str, path: str, key: str, body: dict | None = None) -> dict:
    url = f"{BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {key}")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} on {method} {path}:\n{e.read().decode('utf-8', 'ignore')}")
    except Exception as e:
        sys.exit(f"网络/请求失败 {method} {path}: {e}")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print("返回非 JSON：", raw[:1000])
        sys.exit(1)


def pick_id(resp: dict):
    for k in ("id", "task_id", "song_id", "request_id"):
        if k in resp and resp[k]:
            return str(resp[k])
    return None


def pick_audio_urls(resp: dict) -> list[str]:
    urls = []

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if isinstance(v, str) and any(
                    v.lower().endswith(ext) for ext in (".mp3", ".flac", ".wav", ".ogg", ".m4a")
                ):
                    urls.append(v)
                elif isinstance(v, str) and v.startswith("http") and any(
                    t in k.lower() for t in ("url", "audio", "flac", "mp3")
                ):
                    urls.append(v)
                else:
                    walk(v)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(resp)
    return list(dict.fromkeys(urls))


def download(url: str, out_dir: str, idx: int):
    os.makedirs(out_dir, exist_ok=True)
    ext = os.path.splitext(url.split("?")[0])[1] or ".mp3"
    dest = os.path.join(out_dir, f"track_{int(time.time())}_{idx}{ext}")
    try:
        urllib.request.urlretrieve(url, dest)
        print(f"  ✅ 下载: {dest}")
    except Exception as e:
        print(f"  ⚠️ 下载失败 {url}: {e}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", default="traditional ancient chinese court music, guqin, bamboo flute, bronze bells, xun ocarina, serene, solemn, cinematic ambient, instrumental")
    ap.add_argument("--model", default="auto")
    ap.add_argument("--n", type=int, default=1)
    ap.add_argument("--out", default="art-library/audio/music")
    ap.add_argument("--query", default=None, help="只查询某个已有任务 id")
    ap.add_argument("--poll", type=int, default=40, help="最多轮询多少次")
    args = ap.parse_args()

    key = load_key()

    if args.query:
        resp = api("GET", f"/instrumental/query/{args.query}", key)
        print(json.dumps(resp, ensure_ascii=False, indent=2))
        return

    print(f"[1] 提交生成: prompt='{args.prompt[:60]}...' n={args.n}")
    submit = api("POST", "/instrumental/generate", key,
                 {"model": args.model, "prompt": args.prompt, "n": args.n})
    print("--- 提交返回原始 JSON ---")
    print(json.dumps(submit, ensure_ascii=False, indent=2))

    task_id = pick_id(submit)
    if not task_id:
        print("⚠️ 没从返回里认出任务 id —— 把上面 JSON 发我，我据此修脚本。")
        return

    print(f"[2] 任务 id = {task_id}，开始轮询 /instrumental/query/{task_id}")
    for i in range(args.poll):
        time.sleep(6)
        q = api("GET", f"/instrumental/query/{task_id}", key)
        status = str(q.get("status", "")).lower()
        print(f"  轮询 {i+1}: status={status or '(无status字段)'}")
        urls = pick_audio_urls(q)
        if urls or status in ("succeeded", "success", "completed", "finished", "done"):
            print("--- 完成时原始 JSON ---")
            print(json.dumps(q, ensure_ascii=False, indent=2))
            if not urls:
                urls = pick_audio_urls(q)
            for idx, u in enumerate(urls):
                download(u, args.out, idx)
            if not urls:
                print("⚠️ 状态完成但没找到音频链接 —— 把上面 JSON 发我。")
            return
        if status in ("failed", "error"):
            print("--- 失败原始 JSON ---")
            print(json.dumps(q, ensure_ascii=False, indent=2))
            return
    print("⚠️ 轮询超时，用 --query", task_id, "稍后再查。")


if __name__ == "__main__":
    main()
