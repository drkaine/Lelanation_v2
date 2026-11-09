export type MobileFilterChipId = 'compare' | 'otp' | 'role' | 'division' | 'addRole'

export interface MobileFilterChip {
  id: MobileFilterChipId
  value: string
}

/** Puces de filtres actifs sous l'en-tête mobile (maquette 02 : « vs 16.20 × », « Sans OTP × », « + Rôle »). */
export function mobileFilterChips(input: {
  compareVersion: string
  otp: 'oui' | 'non' | 'solo'
  role: string
  divisions: readonly string[]
  showRole: boolean
  showDivision: boolean
  showOtp: boolean
}): MobileFilterChip[] {
  const chips: MobileFilterChip[] = []
  if (input.compareVersion) chips.push({ id: 'compare', value: input.compareVersion })
  if (input.showOtp && input.otp !== 'oui') chips.push({ id: 'otp', value: input.otp })
  if (input.showRole && input.role) chips.push({ id: 'role', value: input.role })
  if (input.showDivision && input.divisions.length)
    chips.push({ id: 'division', value: input.divisions.join(',') })
  if (input.showRole && !input.role) chips.push({ id: 'addRole', value: '' })
  return chips
}
