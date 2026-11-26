<template>
  <AdminLimitsForm
    endpoint="/api/admin/admin-limits"
    prefix="gestion.adminLimits"
    :specs="ADMIN_LIMIT_SPECS"
  />
</template>

<script setup lang="ts">
import { ADMIN_LIMIT_SPECS } from '~/utils/limitsSettings'
</script>
