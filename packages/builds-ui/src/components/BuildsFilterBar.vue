<template>
  <div class="builds-filter-bar">
    <input
      :value="searchQuery"
      type="text"
      class="builds-filter-bar__search"
      :placeholder="searchPlaceholder"
      @input="onSearchInput"
    />

    <div v-if="roles.length > 0" class="builds-filter-bar__roles">
      <button
        v-for="role in roles"
        :key="role.value"
        type="button"
        class="builds-filter-bar__role-chip"
        :class="{ 'is-active': selectedRole === role.value }"
        @click="emit('toggle-role', role.value)"
      >
        <img :src="role.icon" :alt="role.label" class="builds-filter-bar__role-icon" />
        <span>{{ role.label }}</span>
      </button>
    </div>

    <label class="builds-filter-bar__uptodate">
      <input :checked="onlyUpToDate" type="checkbox" @change="onOnlyUpToDateChange" />
      <span>{{ upToDateLabel }}</span>
    </label>

    <div class="builds-filter-bar__sort-row">
      <label class="builds-filter-bar__sort-label">{{ sortLabel }}</label>
      <select :value="sortBy" class="builds-filter-bar__sort-select" @change="onSortChange">
        <option v-for="option in sortOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <button
        v-if="hasActiveFilters"
        type="button"
        class="builds-filter-bar__clear-btn"
        @click="emit('clear-filters')"
      >
        {{ clearFiltersLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export type FilterRoleValue = string | null
export type FilterSortValue = string

defineProps<{
  searchQuery: string
  selectedRole: FilterRoleValue
  onlyUpToDate: boolean
  sortBy: FilterSortValue
  hasActiveFilters: boolean
  searchPlaceholder: string
  upToDateLabel: string
  sortLabel: string
  clearFiltersLabel: string
  roles: Array<{ value: string; label: string; icon: string }>
  sortOptions: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:onlyUpToDate': [value: boolean]
  'update:sortBy': [value: string]
  'toggle-role': [role: string]
  'clear-filters': []
}>()

const onSearchInput = (event: Event) => {
  emit('update:searchQuery', (event.target as HTMLInputElement).value)
}

const onOnlyUpToDateChange = (event: Event) => {
  emit('update:onlyUpToDate', (event.target as HTMLInputElement).checked)
}

const onSortChange = (event: Event) => {
  emit('update:sortBy', (event.target as HTMLSelectElement).value)
}
</script>

<style scoped>
.builds-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.builds-filter-bar__search {
  flex: 1 1 200px;
  min-width: 180px;
  background: rgba(9, 20, 40, 0.95);
  color: #f0e6d2;
  border: 1px solid rgba(200, 155, 60, 0.45);
  border-radius: 8px;
  padding: 0.4rem 0.65rem;
  font-size: 0.82rem;
}

.builds-filter-bar__search::placeholder {
  color: rgba(240, 230, 210, 0.45);
}

.builds-filter-bar__roles {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.builds-filter-bar__role-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid rgba(200, 155, 60, 0.4);
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  cursor: pointer;
  background: rgba(30, 40, 45, 0.6);
  color: #c8aa6e;
  transition: all 0.15s;
}

.builds-filter-bar__role-chip.is-active {
  border-color: #c89b3c;
  background: rgba(200, 155, 60, 0.2);
  color: #f0e6d2;
}

.builds-filter-bar__role-chip:hover {
  border-color: #c89b3c;
  background: rgba(200, 155, 60, 0.1);
}

.builds-filter-bar__role-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.builds-filter-bar__uptodate {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: #f0e6d2;
  cursor: pointer;
  white-space: nowrap;
}

.builds-filter-bar__sort-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.builds-filter-bar__sort-label {
  font-size: 0.78rem;
  color: rgba(240, 230, 210, 0.7);
}

.builds-filter-bar__sort-select {
  background: rgba(9, 20, 40, 0.95);
  color: #f0e6d2;
  border: 1px solid rgba(200, 155, 60, 0.45);
  border-radius: 6px;
  padding: 0.25rem 0.4rem;
  font-size: 0.78rem;
}

.builds-filter-bar__clear-btn {
  font-size: 0.72rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.35);
  background: rgba(30, 40, 45, 0.5);
  color: #c8aa6e;
  cursor: pointer;
}

.builds-filter-bar__clear-btn:hover {
  background: rgba(200, 155, 60, 0.15);
}
</style>
