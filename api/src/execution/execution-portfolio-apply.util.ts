import type { ExecutionAction } from './execution.types';

export type WeightRow = { carId: string; weight: number };

function normalizeWeights(rows: WeightRow[]): WeightRow[] {
  const pos = rows.filter((r) => r.weight > 1e-9);
  const s = pos.reduce((a, r) => a + r.weight, 0);
  if (s < 1e-9) return [];
  return pos.map((r) => ({ carId: r.carId, weight: r.weight / s }));
}

/**
 * اعمال تقریبی اکشن‌های پلان روی وزن‌ها (مدل MVP بدون لایه معاملات واقعی).
 */
export function applyExecutionActionsToPortfolio(
  before: WeightRow[],
  actions: ExecutionAction[],
): WeightRow[] {
  let rows = normalizeWeights([...before]);
  if (!rows.length) return [];

  const byPriority = [...actions].sort((a, b) => b.priority - a.priority);

  for (const a of byPriority) {
    const m = new Map(rows.map((r) => [r.carId, r.weight]));

    switch (a.actionType) {
      case 'REBALANCE_PORTFOLIO':
        if (a.targetAllocation && Object.keys(a.targetAllocation).length) {
          for (const [carId, dw] of Object.entries(a.targetAllocation)) {
            if (!Number.isFinite(dw)) continue;
            m.set(carId, (m.get(carId) ?? 0) + dw);
          }
          for (const [k, v] of m) {
            if (v < 1e-6) m.delete(k);
            else m.set(k, v);
          }
          rows = normalizeWeights(
            [...m].map(([carId, weight]) => ({ carId, weight })),
          );
        }
        break;
      case 'BUY_CAR':
        if (a.relatedCars?.length) {
          const addEach = 0.04 / a.relatedCars.length;
          for (const id of a.relatedCars) {
            m.set(id, (m.get(id) ?? 0) + addEach);
          }
          rows = normalizeWeights(
            [...m].map(([carId, weight]) => ({ carId, weight })),
          );
        }
        break;
      case 'SELL_CAR':
        if (a.relatedCars?.length) {
          for (const id of a.relatedCars) {
            const w = m.get(id);
            if (w != null) m.set(id, w * 0.35);
          }
          rows = normalizeWeights(
            [...m].map(([carId, weight]) => ({ carId, weight })),
          );
        }
        break;
      case 'REDUCE_RISK':
      case 'MOVE_TO_CASH': {
        for (const [k, v] of m) {
          m.set(k, v * 0.88);
        }
        rows = normalizeWeights(
          [...m].map(([carId, weight]) => ({ carId, weight })),
        );
        break;
      }
      case 'INCREASE_RISK': {
        for (const [k, v] of m) {
          m.set(k, v * 1.04);
        }
        rows = normalizeWeights(
          [...m].map(([carId, weight]) => ({ carId, weight })),
        );
        break;
      }
      default:
        break;
    }
  }

  return rows.length ? normalizeWeights(rows) : normalizeWeights([...before]);
}

export function totalAllocationChange(
  before: WeightRow[],
  after: WeightRow[],
): number {
  const a = new Map(before.map((r) => [r.carId, r.weight]));
  const b = new Map(after.map((r) => [r.carId, r.weight]));
  const keys = new Set([...a.keys(), ...b.keys()]);
  let s = 0;
  for (const k of keys) {
    s += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
  }
  return s * 0.5;
}
