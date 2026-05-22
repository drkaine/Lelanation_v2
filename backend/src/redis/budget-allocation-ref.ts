import {
  DEFAULT_INITIAL_ALLOCATION,
  type BudgetAllocation,
} from "../lib/adaptiveBudget.js";

/** Ref mutable partagée scheduler ↔ rate-scheduler (sleep drip dynamique). */
export const currentBudgetAllocationRef: BudgetAllocation = {
  ...DEFAULT_INITIAL_ALLOCATION,
};

export function applyCurrentBudgetAllocation(alloc: BudgetAllocation): void {
  currentBudgetAllocationRef.discovery = alloc.discovery;
  currentBudgetAllocationRef.hydration = alloc.hydration;
  currentBudgetAllocationRef.rank = alloc.rank;
  currentBudgetAllocationRef.totalReq = alloc.totalReq;
}
