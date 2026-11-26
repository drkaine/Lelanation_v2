<template>
  <AdminLimitsForm
    endpoint="/api/admin/stats-limits"
    prefix="gestion.statsLimits"
    :specs="STATS_LIMIT_SPECS"
    :defaults="DEFAULT_STATS_LIMITS"
  />
</template>

<script setup lang="ts">
import { DEFAULT_STATS_LIMITS, STATS_LIMIT_SPECS } from '~/utils/limitsSettings'
</script>
