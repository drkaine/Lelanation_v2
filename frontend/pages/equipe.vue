<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-8 text-text">
    <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-text-accent">{{ t('team.title') }}</h1>
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
          class="rounded border border-primary/50 px-3 py-2 text-sm hover:bg-surface"
        >
          {{ t('nav.admin') }}
        </NuxtLink>
        <button
          type="button"
          class="rounded border border-primary/50 px-3 py-2 text-sm hover:bg-surface"
          @click="signOut"
        >
          {{ t('team.logout') }}
        </button>
      </div>
    </header>

    <p
      v-if="message"
      class="mb-4 rounded border px-3 py-2 text-sm"
      :class="message.error ? 'border-error text-error' : 'border-accent/60'"
      role="status"
    >
      {{ message.text }}
    </p>

    <section class="mb-10 rounded-lg border border-primary/30 bg-surface/40 p-5">
      <h2 class="mb-1 text-lg font-semibold">{{ t('team.invite.title') }}</h2>
      <p class="mb-4 text-sm text-text/70">{{ t('team.invite.help') }}</p>
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="createInvitation">
        <label class="flex flex-col gap-1 text-sm">
          {{ t('team.role') }}
          <select
            v-model="inviteRole"
            class="rounded border border-primary/50 bg-background px-3 py-2"
          >
            <option v-for="r in invitable" :key="r" :value="r">{{ t(`team.roles.${r}`) }}</option>
          </select>
        </label>
        <button
          type="submit"
          class="rounded bg-accent px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
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

    <section class="rounded-lg border border-primary/30 bg-surface/40 p-5">
      <h2 class="mb-4 text-lg font-semibold">
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
                  @change="changeRole(u, ($event.target as HTMLSelectElement).value as UserRole)"
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
</template>

<script setup lang="ts">
import { useUserSession } from '~/composables/useUserSession'
import { inviteLink, roleChoicesFor } from '~/utils/teamAccess'
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
