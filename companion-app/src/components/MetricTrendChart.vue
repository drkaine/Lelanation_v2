<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  label: string;
  points: Array<{ playedAtMs: number; value: number }>;
  benchmark: number | null;
  lowerIsBetter?: boolean;
}>();

const W = 280;
const H = 72;
const pad = { t: 8, r: 8, b: 18, l: 8 };

const plot = computed(() => {
  const pts = props.points;
  if (pts.length === 0) return null;

  const values = pts.map((p) => p.value);
  if (props.benchmark != null) values.push(props.benchmark);

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;

  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const toX = (i: number) =>
    pad.l + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  const toY = (v: number) => pad.t + innerH - ((v - min) / range) * innerH;

  const line = pts.map((p, i) => `${toX(i)},${toY(p.value)}`).join(" ");

  let benchY: number | null = null;
  if (props.benchmark != null) {
    benchY = toY(props.benchmark);
  }

  return { line, benchY, last: pts[pts.length - 1]?.value ?? null };
});

function deltaClass(last: number | null, bench: number | null): string {
  if (last == null || bench == null) return "";
  const d = last - bench;
  const good = props.lowerIsBetter ? d < 0 : d > 0;
  const bad = props.lowerIsBetter ? d > 0 : d < 0;
  if (good) return "good";
  if (bad) return "bad";
  return "";
}
</script>

<template>
  <div class="trend-chart">
    <div class="trend-head">
      <span class="trend-label">{{ label }}</span>
      <span
        v-if="plot && benchmark != null"
        class="trend-delta"
        :class="deltaClass(plot.last, benchmark)"
      >
        {{ plot.last != null ? plot.last.toFixed(0) : "—" }}
        <span class="vs-bench">/ {{ benchmark.toFixed(0) }} DB</span>
      </span>
    </div>
    <svg v-if="plot" :viewBox="`0 0 ${W} ${H}`" class="trend-svg" aria-hidden="true">
      <line
        v-if="plot.benchY != null"
        :x1="pad.l"
        :y1="plot.benchY"
        :x2="W - pad.r"
        :y2="plot.benchY"
        class="bench-line"
      />
      <polyline :points="plot.line" class="player-line" fill="none" />
    </svg>
    <p v-else class="trend-empty">—</p>
  </div>
</template>

<style scoped>
.trend-chart {
  background: #0f1419;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
}
.trend-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.78rem;
}
.trend-label {
  color: #9aa0a6;
}
.trend-delta {
  font-variant-numeric: tabular-nums;
  color: #e8eaed;
}
.trend-delta.good {
  color: #7ee787;
}
.trend-delta.bad {
  color: #f28b82;
}
.vs-bench {
  color: #9aa0a6;
  font-size: 0.72rem;
}
.trend-svg {
  width: 100%;
  height: 72px;
  display: block;
}
.bench-line {
  stroke: #fdd663;
  stroke-width: 1;
  stroke-dasharray: 4 3;
  opacity: 0.85;
}
.player-line {
  stroke: #8ab4f8;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.trend-empty {
  margin: 0;
  font-size: 0.78rem;
  color: #5f6368;
}
</style>
