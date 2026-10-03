"""邦国录 · 合成 6 个短音效（纯 stdlib，无外部依赖/无 ffmpeg）。

加性合成 + 指数衰减包络，写 16-bit 单声道 WAV 到 public/audio/<key>.wav：
  sfx_bell  事件提示——明亮编钟（含非谐分音）
  sfx_chime 建成——清亮上行二音 ding
  sfx_gong  危机——低沉铜锣（非谐分音 + 长衰减 + 微噪）
  sfx_place 落子——短促木质 thunk + click
  sfx_click 按钮轻响——极短全频 tick（c1002-20 补生成通道；时长与在册 0.10s 档一致）
  sfx_warn  警报——双音下行短促警笛（c1002-20 补生成通道；≤0.30s，远低于 c924-23 体积闸 0.388s）
青铜礼器气质，克制不刺耳。
"""
from __future__ import annotations
import math
import struct
import wave
from pathlib import Path

SR = 44100
OUT = Path("D:/code/colony-game/public/audio")


def _env(n: int, total: int, decay: float, attack: float = 0.004) -> float:
    t = n / SR
    a = min(1.0, t / attack) if attack > 0 else 1.0
    return a * math.exp(-t / decay)


def _write(key: str, samples: list[float]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # 归一化到 -0.9..0.9，防削顶
    peak = max(1e-9, max(abs(s) for s in samples))
    g = 0.9 / peak
    frames = b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s * g)) * 32767)) for s in samples)
    with wave.open(str(OUT / f"{key}.wav"), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames)
    print(f"  wrote {key}.wav  ({len(samples)/SR:.2f}s)")


def bell() -> None:
    dur = int(0.7 * SR)
    partials = [(1.0, 1.0), (2.76, 0.5), (5.40, 0.28), (8.93, 0.12)]  # 编钟非谐分音
    f0 = 784.0
    out = []
    for n in range(dur):
        t = n / SR
        s = sum(amp * math.sin(2 * math.pi * f0 * mult * t) for mult, amp in partials)
        out.append(s * _env(n, dur, 0.32))
    _write("sfx_bell", out)


def chime() -> None:
    dur = int(0.5 * SR)
    out = []
    for n in range(dur):
        t = n / SR
        # 上行二音 C6->G6，后音延迟进入
        s = math.sin(2 * math.pi * 1046.5 * t) * _env(n, dur, 0.18)
        if t > 0.09:
            s += 0.9 * math.sin(2 * math.pi * 1568.0 * (t - 0.09)) * _env(n - int(0.09 * SR), dur, 0.22)
        out.append(s)
    _write("sfx_chime", out)


def gong() -> None:
    dur = int(1.3 * SR)
    partials = [(1.0, 1.0), (1.5, 0.6), (2.39, 0.5), (3.7, 0.35), (5.1, 0.22)]
    f0 = 150.0
    # 简单确定性伪噪（金属撞击的初始 sizzle），不用 random 保证可复现
    out = []
    for n in range(dur):
        t = n / SR
        s = sum(amp * math.sin(2 * math.pi * f0 * mult * t) for mult, amp in partials)
        noise = (((n * 1103515245 + 12345) >> 16) & 0x7FFF) / 0x7FFF - 0.5
        s += noise * 0.5 * math.exp(-t / 0.05)  # 仅开头一闪
        out.append(s * _env(n, dur, 0.55))
    _write("sfx_gong", out)


def place() -> None:
    dur = int(0.18 * SR)
    out = []
    for n in range(dur):
        t = n / SR
        # 低频木质 + 高频 click
        s = math.sin(2 * math.pi * 196.0 * t) * _env(n, dur, 0.05)
        s += 0.4 * math.sin(2 * math.pi * 1200.0 * t) * math.exp(-t / 0.012)
        out.append(s)
    _write("sfx_place", out)


def click() -> None:
    """按钮轻响：极短全频 tick——瞬态 + 高频泛音快衰减（在册 sfx_click 0.10s 档同口径）。"""
    dur = int(0.10 * SR)
    out = []
    for n in range(dur):
        t = n / SR
        # 2.2kHz 主频 + 5kHz 泛音，双快衰减（8ms/25ms）＝「嗒」的瞬态形态
        s = math.sin(2 * math.pi * 2200.0 * t) * math.exp(-t / 0.008)
        s += 0.5 * math.sin(2 * math.pi * 5000.0 * t) * math.exp(-t / 0.025)
        out.append(s)
    _write("sfx_click", out)


def warn() -> None:
    """警报：双音下行短促警笛——两组 A5→E5 交替，各带颤感；≤0.30s（c924-23 体积闸 0.388s 内）。"""
    dur = int(0.30 * SR)
    out = []
    for n in range(dur):
        t = n / SR
        # 两组下行音对（880→659Hz），0.15s 交接；每段内 28Hz 幅度调制＝警笛颤感
        seg = 0 if t < 0.15 else 1
        f = 880.0 if seg == 0 else 659.3
        tt = t if seg == 0 else t - 0.15
        trem = 0.82 + 0.18 * math.sin(2 * math.pi * 28.0 * t)
        s = math.sin(2 * math.pi * f * t) * _env(n, dur, 0.14) * trem
        s += 0.3 * math.sin(2 * math.pi * f * 2.0 * t) * math.exp(-tt / 0.05)  # 泛音只在段首亮
        out.append(s)
    _write("sfx_warn", out)


if __name__ == "__main__":
    bell()
    chime()
    gong()
    place()
    click()
    warn()
    print("[sfx] done")
