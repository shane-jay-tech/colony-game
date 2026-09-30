/**
 * c930-26：双写守卫 AST 轨（dualwrite 设计稿 20260924 §A2 落地）。
 *
 * 与 canary 15 例（运行时轨，c927-48）**分工不合并**：
 *   - canary 轨：migrations[8] 行为在运行时真跑（那条"migrations[8] 存在"的运行时证明）。
 *   - 本件 AST 轨：静态断言 migrations 写侧结构与 deserialize gameState 字面量的双写不变量
 *     （A2：注入字段集合 ⊆ gameState 兜底键集；步号完备 1..SAVE_SCHEMA_VERSION−1）。
 *     取数器移植自 tmp/c924-20/census.mts（c927-64 §A2 指名复用；tmp 被 gitignore 故常驻化重写）。
 * 变异自证：内存副本把步 8 改号 90 ⇒ 步完备判据当场可检红（不触盘、验后即弃）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../../src/renderer/state/saveLoad';

const FILE = join(__dirname, '..', '..', 'src', 'renderer', 'state', 'saveLoad.ts');

interface Extracted {
  /** 迁移步号（属性名字面量，如 1..8） */
  steps: number[];
  /** 迁移注入字段 → 注入步号列表（schemaVersion 版本位不计） */
  migWrites: Map<string, number[]>;
  /** deserialize 内 gameState 字面量顶层键 */
  gameStateKeys: string[];
}

function objLiteral(node: ts.Node): ts.ObjectLiteralExpression | null {
  return ts.isObjectLiteralExpression(node) ? node : null;
}

function findConst(sf: ts.SourceFile, name: string): ts.Node | null {
  let found: ts.Node | null = null;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) found = n.initializer ?? null;
    if (!found) ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

function extract(src: string): Extracted {
  const sf = ts.createSourceFile(FILE, src, ts.ScriptTarget.ESNext, true);
  const migWrites = new Map<string, number[]>();
  const steps: number[] = [];
  let gameStateKeys: string[] = [];

  const migInit = findConst(sf, 'migrations');
  if (migInit && objLiteral(migInit)) {
    for (const prop of objLiteral(migInit)!.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const step = Number(prop.name.getText());
      steps.push(step);
      if (!ts.isArrowFunction(prop.initializer)) continue;
      const stmts = ts.isBlock(prop.initializer.body) ? [...prop.initializer.body.statements] : [prop.initializer.body];
      for (const d of stmts) {
        if (!ts.isExpressionStatement(d)) continue;
        const e = d.expression;
        if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isElementAccessExpression(e.left)) {
          const idx = e.left.argumentExpression;
          if (ts.isStringLiteral(idx) && idx.text !== 'schemaVersion') {
            const f = idx.text;
            migWrites.set(f, [...(migWrites.get(f) ?? []), step]);
          }
        }
      }
    }
  }

  const walk = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'gameState') {
      const lit = objLiteral(n.initializer ?? ts.NullLiteral);
      if (lit) gameStateKeys = lit.properties.filter(ts.isPropertyAssignment).map((p) => (p as ts.PropertyAssignment).name.getText());
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);

  return { steps, migWrites, gameStateKeys };
}

const real = extract(readFileSync(FILE, 'utf8'));

describe('c930-26 双写守卫 AST 轨', () => {
  it('A2：migrations 注入字段集合 ⊆ deserialize gameState 兜底键集（今天 15/15，恒真不变量）', () => {
    expect(real.migWrites.size).toBeGreaterThanOrEqual(8); // 8 步迁移、15 字段（设计稿 §1 实测），塌方即红
    const migOnly = [...real.migWrites.keys()].filter((f) => !real.gameStateKeys.includes(f));
    expect(migOnly).toEqual([]); // 「只迁移不兜底」必须为 0——非 0 即双写面破
  });

  it('步号完备：migrations 键＝1..SAVE_SCHEMA_VERSION−1（删/改号任一步即红）', () => {
    expect([...real.steps].sort((a, b) => a - b)).toEqual(
      Array.from({ length: SAVE_SCHEMA_VERSION - 1 }, (_, i) => i + 1),
    );
  });

  it('变异自证：内存副本把步 8 改号 90 ⇒ 步完备判据当场可检红（tmp 副本验后即弃，不触盘）', () => {
    const src = readFileSync(FILE, 'utf8');
    const marker = '\n  8: (blob) => {';
    expect(src.includes(marker)).toBe(true);
    const mutated = extract(src.replace(marker, '\n  90: (blob) => {'));
    expect(mutated.steps).not.toContain(8); // 步 8 消失
    expect(mutated.steps).toContain(90); // 改号被 AST 轨看见
  });
});
