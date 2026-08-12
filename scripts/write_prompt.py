q = chr(39)
bt = chr(96)
ds = chr(36)

lines = [
  "Task: Implement labor-occupation system for TypeScript/Phaser colony game.",
  "Produce exact before/after diffs using real TypeScript with Chinese string literals.",
  "",
  "GOAL:",
  "- people resource = total population, only changed by population.ts. Never deducted.",
  "- Each placed building occupies def.cost.people labor slots (constructing OR working).",
  "- employedLabor = sum of (getBuildingDef(b.defId)?.cost.people ?? 0) over this.state.buildings.",
  "- idleLabor = Math.max(0, people - employedLabor).",
  "- Build gate: if idleLabor < def.cost.people return insufficient_labor.",
  "- canPlace material check excludes people. Labor gate is in gameStore.",
  "- HUD people token: show idleLabor/total.",
]

def diff(title, before_lines, after_lines):
  out = ["=== " + title + " ===", "BEFORE:"]
  out.extend(before_lines)
  out.append("AFTER:")
  out.extend(after_lines)
  return out
