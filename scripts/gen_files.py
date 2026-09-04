import sys, os
sys.path.insert(0, "D:/code/scripts")
import llm_call as lc
lc._load_env_local()
from openai import OpenAI

base_url = os.environ["GPT_BASE_URL"]
api_key = os.environ["GPT_API_KEY"]
model = os.environ["GPT_MODEL"]
client = OpenAI(base_url=base_url, api_key=api_key, timeout=300.0)
SYSTEM = "You are a senior full-stack engineer. Write clean TypeScript. Inline // comments only. Complete file, no ellipsis. strict + noUncheckedIndexedAccess."

def gpt(prompt, max_tokens=4096):
    resp = client.responses.create(model=model, input=prompt, instructions=SYSTEM, reasoning={"effort":"medium"}, max_output_tokens=max_tokens)
    text = resp.output_text
    lines = text.strip().split("
")
    if lines and lines[0].startswith(""):
        lines = lines[:-1]
    return "
".join(lines)

def save(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="
") as f:
        f.write(content)
    print(f"Saved {path}: {len(content)} chars")
