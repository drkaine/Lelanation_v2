<template>
  <div class="team-page flex min-h-screen w-full min-w-0 flex-col text-text">
    <header class="team-head">
      <div class="team-head-inner">
        <div class="team-head-top">
          <div>
            <p class="team-eyebrow">Lelanation</p>
            <h1 class="team-h1">{{ t('gestion.title') }}</h1>
            <p v-if="session" class="mt-1 text-sm text-text/70">
              {{
                t('team.signedInAs', {
                  name: session.user.username,
                  role: t(`team.roles.${session.user.role}`),
                })
              }}
            </p>
          </div>
          <div class="flex gap-2">
            <NuxtLink
              v-if="session?.user.role === 'admin'"
              :to="localePath('/admin')"
              class="team-btn"
            >
              {{ t('nav.admin') }}
            </NuxtLink>
            <button type="button" class="team-btn" @click="signOut">
              {{ t('team.logout') }}
            </button>
          </div>
        </div>

        <nav
          v-if="canSeeGestionTabs"
          class="subnav team-subnav"
          role="tablist"
          :aria-label="t('gestion.title')"
        >
          <button
            v-for="tab in gestionTabs"
            :key="tab"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab"
            :class="['subnav-link', activeTab === tab ? 'is-active' : '']"
            @click="activeTab = tab"
          >
            {{ t(`gestion.tabs.${tab}`) }}
          </button>
        </nav>
      </div>
    </header>

    <main class="team-body">
      <p
        v-if="message"
        class="mb-4 rounded-lg border px-3 py-2 text-sm"
        :class="message.error ? 'border-error text-error' : 'border-accent/60'"
        role="status"
      >
        {{ message.text }}
      </p>

      <AdminGestionDataTab v-if="activeTab === 'data' && canSeeGestionTabs" />
      <AdminGestionOtpTab v-else-if="activeTab === 'otp' && canSeeGestionTabs" />
      <div v-else-if="activeTab === 'stats' && canSeeGestionTabs" class="flex flex-col gap-6">
        <AdminTierDistributionTab />
        <AdminStatsLimitsTab />
      </div>
      <AdminLimitsTab v-else-if="activeTab === 'limits' && session?.user.role === 'admin'" />
      <AdminBalanceRulesTab v-else-if="activeTab === 'balance' && canSeeGestionTabs" />
      <AdminVideosTab v-else-if="activeTab === 'videos' && canSeeGestionTabs" ref="videosTabRef" />

      <div v-else class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section class="team-card">
          <h2 class="team-h2 mb-1">{{ t('team.invite.title') }}</h2>
          <p class="mb-4 text-sm text-text/70">{{ t('team.invite.help') }}</p>
          <form class="flex flex-wrap items-end gap-3" @submit.prevent="createInvitation">
            <label class="flex flex-col gap-1 text-sm">
              {{ t('team.role') }}
              <select
                v-model="inviteRole"
                class="rounded-lg border border-primary/50 bg-background px-3 py-2"
              >
                <option v-for="r in invitable" :key="r" :value="r">
                  {{ t(`team.roles.${r}`) }}
                </option>
              </select>
            </label>
            <button
              type="submit"
              class="team-btn team-btn--primary disabled:opacity-50"
              :disabled="busy || !inviteRole"
            >
              {{ t('team.invite.create') }}
            </button>
          </form>

          <ul v-if="invitations.length" class="mt-5 divide-y divide-primary/20">
            <li
              v-for="inv in invitations"
              :key="inv.code"
              class="flex flex-wrap items-center gap-3 py-3"
            >
              <code class="rounded bg-background px-2 py-1 font-mono text-base tracking-wider">{{
                inv.code
              }}</code>
              <span class="text-sm">{{ t(`team.roles.${inv.role}`) }}</span>
              <span class="text-xs text-text/60">{{
                t('team.invite.expires', { date: formatDate(inv.expiresAt) })
              }}</span>
              <span class="ml-auto flex gap-2">
                <button
                  type="button"
                  class="rounded border border-primary/50 px-3 py-1 text-sm hover:bg-surface"
                  @click="copyLink(inv.code)"
                >
                  {{ copied === inv.code ? t('team.invite.copied') : t('team.invite.copy') }}
                </button>
                <button
                  type="button"
                  class="rounded border border-error/60 px-3 py-1 text-sm text-error hover:bg-error/10"
                  @click="revokeInvitation(inv.code)"
                >
                  {{ t('team.invite.revoke') }}
                </button>
              </span>
            </li>
          </ul>
          <p v-else class="mt-4 text-sm text-text/60">{{ t('team.invite.none') }}</p>
        </section>

        <section class="team-card">
          <h2 class="team-h2 mb-4">
            {{ t('team.users.title') }} <span class="text-text/60">({{ users.length }})</span>
          </h2>
          <p v-if="loading" class="text-sm text-text/60">…</p>
          <p v-else-if="!users.length" class="text-sm text-text/60">{{ t('team.users.none') }}</p>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs uppercase text-text/60">
                <tr>
                  <th class="py-2 pr-3">{{ t('team.users.username') }}</th>
                  <th class="py-2 pr-3">{{ t('team.role') }}</th>
                  <th class="py-2 pr-3">{{ t('team.users.since') }}</th>
                  <th class="py-2" />
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20">
                <tr v-for="u in users" :key="u.id">
                  <td class="py-2 pr-3 font-medium">{{ u.username }}</td>
                  <td class="py-2 pr-3">
                    <span v-if="u.id === session?.user.id"
                      >{{ t(`team.roles.${u.role}`) }} · {{ t('team.users.you') }}</span
                    >
                    <select
                      v-else
                      :value="u.role"
                      :disabled="busy || roleChoicesFor(invitable, u.role).length < 2"
                      class="rounded border border-primary/50 bg-background px-2 py-1"
                      :aria-label="t('team.role')"
                      @change="
                        changeRole(u, ($event.target as HTMLSelectElement).value as UserRole)
                      "
                    >
                      <option v-for="r in roleChoicesFor(invitable, u.role)" :key="r" :value="r">
                        {{ t(`team.roles.${r}`) }}
                      </option>
                    </select>
                  </td>
                  <td class="py-2 pr-3 text-text/70">{{ formatDate(u.createdAt) }}</td>
                  <td class="py-2 text-right">
                    <button
                      v-if="u.id !== session?.user.id"
                      type="button"
                      class="rounded border border-error/60 px-3 py-1 text-error hover:bg-error/10 disabled:opacity-50"
                      :disabled="busy"
                      @click="removeUser(u)"
                    >
                      {{ t('team.users.delete') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useUserSession } from '~/composables/useUserSession'
import {
  canAccessTeamPage,
  gestionTabsFor,
  inviteLink,
  roleChoicesFor,
  type GestionTab,
} from '~/utils/teamAccess'
import { isUserRole, type UserRole } from '~/utils/userSession'

interface TeamUser {
  id: number
  username: string
  role: UserRole
  createdAt: string
}
interface Invitation {
  code: string
  role: UserRole
  expiresAt: string
}

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { session, load, logout, authFetch } = useUserSession()
const gestionTabs = computed(() => gestionTabsFor(session.value?.user.role ?? null))
const activeTab = ref<GestionTab>('team')
const canSeeGestionTabs = computed(() => canAccessTeamPage(session.value?.user.role ?? null))
/** VideosTab ne charge rien seul : load() à son montage (v-else-if). */
const videosTabRef = ref<{ load: () => unknown } | null>(null)
watch(videosTabRef, tab => {
  tab?.load()
})

useHead({ title: () => t('team.title'), meta: [{ name: 'robots', content: 'noindex' }] })

const users = ref<TeamUser[]>([])
const invitations = ref<Invitation[]>([])
const invitable = ref<UserRole[]>([])
const inviteRole = ref<UserRole | ''>('')
const loading = ref(true)
const busy = ref(false)
const copied = ref<string | null>(null)
const message = ref<{ text: string; error: boolean } | null>(null)

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(locale.value, { dateStyle: 'medium' })
}

function fail(key: string) {
  message.value = { text: t(key), error: true }
}

async function guard(res: Response): Promise<boolean> {
  if (res.status === 401) {
    await navigateTo({
      path: localePath('/admin/login'),
      query: { redirect: localePath('/equipe') },
    })
    return false
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    fail(
      body?.error === 'SELF'
        ? 'team.errors.self'
        : res.status === 403
          ? 'team.errors.forbidden'
          : 'team.errors.generic'
    )
    return false
  }
  return true
}

async function refresh() {
  loading.value = true
  try {
    const [me, list, inv] = await Promise.all([
      authFetch('/api/users/me'),
      authFetch('/api/users'),
      authFetch('/api/users/invitations'),
    ])
    if (!(await guard(me))) return
    const meBody = (await me.json()) as { invitableRoles?: unknown[] }
    invitable.value = (meBody.invitableRoles ?? []).filter(isUserRole)
    if (!inviteRole.value || !invitable.value.includes(inviteRole.value)) {
      inviteRole.value = invitable.value.includes('lelateam')
        ? 'lelateam'
        : (invitable.value[0] ?? '')
    }
    if (await guard(list)) users.value = ((await list.json()) as { users: TeamUser[] }).users
    if (await guard(inv))
      invitations.value = ((await inv.json()) as { invitations: Invitation[] }).invitations
  } catch {
    fail('team.errors.generic')
  } finally {
    loading.value = false
  }
}

async function run(action: () => Promise<Response>, okKey: string) {
  busy.value = true
  message.value = null
  try {
    if (await guard(await action())) {
      message.value = { text: t(okKey), error: false }
      await refresh()
    }
  } catch {
    fail('team.errors.generic')
  } finally {
    busy.value = false
  }
}

function createInvitation() {
  if (!inviteRole.value) return
  return run(
    () =>
      authFetch('/api/users/invitations', {
        method: 'POST',
        body: JSON.stringify({ role: inviteRole.value }),
      }),
    'team.invite.created'
  )
}

function revokeInvitation(code: string) {
  return run(
    () => authFetch(`/api/users/invitations/${encodeURIComponent(code)}`, { method: 'DELETE' }),
    'team.invite.revoked'
  )
}

function changeRole(user: TeamUser, role: UserRole) {
  if (role === user.role) return
  return run(
    () => authFetch(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    'team.users.roleChanged'
  )
}

function removeUser(user: TeamUser) {
  if (!window.confirm(t('team.users.confirmDelete', { name: user.username }))) return
  return run(() => authFetch(`/api/users/${user.id}`, { method: 'DELETE' }), 'team.users.deleted')
}

async function copyLink(code: string) {
  const link = inviteLink(window.location.origin, localePath('/inscription'), code)
  try {
    await navigator.clipboard.writeText(link)
    copied.value = code
    setTimeout(() => {
      if (copied.value === code) copied.value = null
    }, 2000)
  } catch {
    window.prompt(t('team.invite.copy'), link)
  }
}

async function signOut() {
  await logout()
  await navigateTo(localePath('/'))
}

onMounted(() => {
  load()
  refresh()
})
</script>

<style scoped>
.team-page {
  font-family: Inter, system-ui, sans-serif;
}
.team-head {
  border-bottom: 1px solid var(--color-gold-500);
  background: var(--color-chrome);
}
.team-head-inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 32px 0;
}
.team-head-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 24px;
}
.team-eyebrow {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-grey-50);
}
.team-h1 {
  margin: 0;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  font-size: 40px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-gold-100);
}
.team-subnav {
  border-bottom: none;
}
.team-body {
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: 24px 32px 48px;
}
.team-card {
  border: 1px solid #463714;
  border-radius: 8px;
  background: var(--color-chrome);
  padding: 20px;
}
.team-h2 {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-gold-100);
}
.team-btn {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 16px;
  border: 1px solid #4f3c1c;
  border-radius: 8px;
  background: var(--color-chrome);
  color: #f0e6d2;
  font-size: 14px;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}
.team-btn:hover {
  border-color: var(--color-gold-50);
  color: var(--color-gold-50);
}
.team-btn--primary {
  border-color: var(--color-gold-500);
  color: var(--color-gold-100);
}
@media (max-width: 640px) {
  .team-head-inner {
    padding: 16px 16px 0;
  }
  .team-body {
    padding: 16px 16px 32px;
  }
  .team-h1 {
    font-size: 32px;
  }
}
</style>
