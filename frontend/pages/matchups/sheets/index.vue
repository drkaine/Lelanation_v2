<script setup lang="ts">
import { MATCHUP_SHEETS_DEFAULT_PATH } from '~/utils/matchupSheetsTabs'

const localePath = useLocalePath()
await navigateTo(localePath(MATCHUP_SHEETS_DEFAULT_PATH), { redirectCode: 301 })
</script>
