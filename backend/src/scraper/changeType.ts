/**
 * Infer buff/nerf from numeric before/after values and stat context.
 */

import type { ChangeType } from './types.js';

function extractFirstNumber(text: string): number | null {
  const normalized = text.replace(/\s/g, '').replace(/,/g, '.');
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return Number.isNaN(num) ? null : num;
}

/** Stats where a lower number is better for the player (cooldown, cost, etc.). */
export function isLowerIsBetterStat(...contextParts: string[]): boolean {
  const full = contextParts.join(' ').toLowerCase();

  if (
    full.includes('damage reduction') ||
    full.includes('réduction des dégâts') ||
    full.includes('reduction des degats')
  ) {
    return false;
  }

  return (
    full.includes('cooldown') ||
    full.includes('délai') ||
    full.includes('delai') ||
    full.includes('récupération') ||
    full.includes('recuperation') ||
    full.includes('cost') ||
    full.includes('coût') ||
    full.includes('cout')
  );
}

export function inferNumericChangeType(
  before: string,
  after: string,
  ...contextParts: string[]
): ChangeType {
  const beforeNum = extractFirstNumber(before);
  const afterNum = extractFirstNumber(after);

  if (beforeNum === null || afterNum === null || afterNum === beforeNum) {
    return 'adjustment';
  }

  const lowerIsBetter = isLowerIsBetterStat(...contextParts);

  if (lowerIsBetter) {
    return afterNum < beforeNum ? 'buff' : 'nerf';
  }

  return afterNum > beforeNum ? 'buff' : 'nerf';
}
