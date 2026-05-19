import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { theorycraftTooltipTestUtils } from './TheorycraftDataBuilderService.js'

const {
  formatValueSeries,
  trimByMaxRank,
  extractBinDataValues,
  extractBinCalculations,
  extractSpellRatios,
  parseTooltip,
  findBinSpellForDDragon,
  findPassiveBinSpell,
  resolvePassiveTooltipContent,
  buildChampionSharedVariableMap,
} = theorycraftTooltipTestUtils

test('formatValueSeries collapses uniform values', () => {
  assert.equal(formatValueSeries([40, 40, 40, 40, 40]), '40')
  assert.equal(formatValueSeries([20, 45, 70, 95, 120], ' / '), '20 / 45 / 70 / 95 / 120')
  assert.equal(formatValueSeries([45, 45, 45, 45, 45]), '45')
  assert.equal(formatValueSeries([800, 800, 800, 800, 800]), '800')
  assert.equal(formatValueSeries([9, 8.5, 8, 7.5, 7]), '9/8.5/8/7.5/7')
})

test('trimByMaxRank skips leading rank-0 bin slot', () => {
  const raw = [-5, 20, 45, 70, 95, 120, 145]
  assert.deepEqual(trimByMaxRank(raw, 5), [20, 45, 70, 95, 120])
})

test('Ornn Q totaldamage aligns base and AD ratio from bin', () => {
  const binPath = join(process.cwd(), 'data/theorycraft-cache/cdragon-bin-ornn.json')
  const championBin = JSON.parse(readFileSync(binPath, 'utf-8')) as Record<string, unknown>
  const binSpell = findBinSpellForDDragon(championBin, ['OrnnQ'])
  assert.ok(binSpell)

  const dataValues = extractBinDataValues(binSpell!, 5)
  const baseDamage = dataValues.find((v) => v.name === 'BaseDamage')
  assert.deepEqual(baseDamage?.values, [20, 45, 70, 95, 120])

  const calculations = extractBinCalculations(binSpell!, dataValues)
  const totalDamage = calculations.find((c) => c.key === 'totaldamage')
  assert.ok(totalDamage)
  assert.equal(totalDamage.expression, '20 / 45 / 70 / 95 / 120 (+ 110% AD)')
  assert.deepEqual(totalDamage.baseValues, [20, 45, 70, 95, 120])
  assert.equal(totalDamage.ratios.length, 1)
  assert.equal(totalDamage.ratios[0]?.stat, 'totalAD')
  assert.deepEqual(totalDamage.ratios[0]?.coefficient, [1.1])

  const ddSpell = {
    maxrank: 5,
    tooltip:
      'Ornn strikes, dealing <physicalDamage>{{ totaldamage }} physical damage</physicalDamage> and slowing by {{ slowamount }}% for {{ slowduration }} sec. Pillar lasts {{ pillarduration }} sec.',
    effect: [null, [20, 45, 70, 95, 120], [1, 1, 1, 1, 1], [4, 4, 4, 4, 4], [0, 0, 0, 0, 0], [40, 40, 40, 40, 40], [2, 2, 2, 2, 2]],
    vars: [],
    cooldown: [9, 8.5, 8, 7.5, 7],
    cost: [45, 45, 45, 45, 45],
    range: [800, 800, 800, 800, 800],
  }
  const cdSpell = {
    maxLevel: 5,
    coefficients: { coefficient1: 1.1, coefficient2: 0 },
    effectAmounts: {},
  }

  const ratios = extractSpellRatios(ddSpell, cdSpell, binSpell)
  assert.equal(ratios.length, 1)
  assert.equal(ratios[0]?.stat, 'totalAD')
  assert.equal(ratios[0]?.type, 'physical')

  const tooltip = parseTooltip(String(ddSpell.tooltip), ddSpell, cdSpell, binSpell)
  assert.ok(tooltip.descriptionText.includes('20 / 45 / 70 / 95 / 120'))
  assert.ok(tooltip.descriptionText.includes('(+ 110% AD)'))
  assert.ok(tooltip.descriptionText.includes('40%'))
  assert.ok(!tooltip.descriptionText.includes('40/40'))
})

test('Ornn W export includes header stats and tick stats', () => {
  const { buildExportedSpell } = theorycraftTooltipTestUtils
  const championFullPath = join(process.cwd(), 'data', 'game', '16.10.1', 'fr_FR', 'championFull.json')
  const championFull = JSON.parse(readFileSync(championFullPath, 'utf-8')) as {
    data: { Ornn: { spells: Array<Record<string, unknown>> } }
  }
  const ddSpell = championFull.data.Ornn.spells[1]
  assert.ok(ddSpell)
  const binPath = join(process.cwd(), 'data/theorycraft-cache/cdragon-bin-ornn.json')
  const championBin = JSON.parse(readFileSync(binPath, 'utf-8')) as Record<string, unknown>
  const binSpell = findBinSpellForDDragon(championBin, ['OrnnW'])
  assert.ok(binSpell)

  const exported = buildExportedSpell({
    championId: 'Ornn',
    slotIndex: 1,
    ddSpell,
    cdSpell: {},
    binSpell,
    sharedVars: new Map(),
    stringTable: {},
    lang: 'fr_FR',
  })

  const headerStats = exported.headerStats as Array<{ key: string; valueText: string }>
  assert.ok(headerStats.some((s) => s.key === 'cost'))
  assert.ok(headerStats.some((s) => s.key === 'cooldown'))
  assert.ok(headerStats.some((s) => s.key === 'targetRange' && s.valueText.includes('500')))
  const tickStats = exported.tickStats as Array<{ key: string; totalText: string; perTickText?: string }>
  assert.ok(tickStats.some((s) => s.key === 'maxHpMagicDamage' && s.perTickText?.includes('2.4%')))
  assert.ok(Array.isArray(exported.detailedTexts) && (exported.detailedTexts as string[]).length > 0)
})

test('Ornn E armor and MR ratios use dedicated scale colors in HTML', () => {
  const binPath = join(process.cwd(), 'data/theorycraft-cache/cdragon-bin-ornn.json')
  const championBin = JSON.parse(readFileSync(binPath, 'utf-8')) as Record<string, unknown>
  const binSpell = findBinSpellForDDragon(championBin, ['OrnnE'])
  assert.ok(binSpell)

  const ddSpell = {
    maxrank: 5,
    tooltip:
      'Ornn charges, dealing <physicalDamage>{{ totaldamage }} physical damage</physicalDamage>.',
    effect: [null, [80, 125, 170, 215, 260]],
    vars: [],
  }
  const cdSpell = { maxLevel: 5, coefficients: {}, effectAmounts: {} }
  const tooltip = parseTooltip(String(ddSpell.tooltip), ddSpell, cdSpell, binSpell)
  assert.ok(tooltip.descriptionText.includes('(+ 40% bonusArmor)'))
  assert.ok(tooltip.descriptionText.includes('(+ 40% bonusMagicResist)'))
})

test('Ornn W brittlepercentmaxhpcalc resolves interpolated max HP percent', () => {
  const binPath = join(process.cwd(), 'data/theorycraft-cache/cdragon-bin-ornn.json')
  const championBin = JSON.parse(readFileSync(binPath, 'utf-8')) as Record<string, unknown>
  const binSpell = findBinSpellForDDragon(championBin, ['OrnnW'])
  assert.ok(binSpell)

  const ddSpell = {
    maxrank: 5,
    id: 'OrnnW',
    tooltip:
      'Deal <magicDamage>{{ maxpercenthpperticktooltip }}% max Health</magicDamage> and <magicDamage>{{ brittlepercentmaxhpcalc }} max Health</magicDamage> bonus.',
    vars: [],
  }
  const cdSpell = { maxLevel: 5, coefficients: {}, effectAmounts: {} }
  const tooltip = parseTooltip(String(ddSpell.tooltip), ddSpell, cdSpell, binSpell)
  assert.ok(!tooltip.descriptionText.includes(' - '))
  assert.ok(tooltip.descriptionText.includes('9.9 / 10.9 / 11.8 / 12.8 / 13.7%'))
})

test('Thresh E passive min/max damage resolves from bin BuffCounter calculations', () => {
  const binPath = join(process.cwd(), 'data/theorycraft-cache/cdragon-bin-thresh.json')
  const championBin = JSON.parse(readFileSync(binPath, 'utf-8')) as Record<string, unknown>
  const binSpell = findBinSpellForDDragon(championBin, ['ThreshE'])
  assert.ok(binSpell)

  const dataValues = extractBinDataValues(binSpell!, 5)
  const calculations = extractBinCalculations(binSpell!, dataValues, { maxRank: 5, slotIndex: 2 })
  const minDamage = calculations.find((c) => c.key === 'pattackdamagemin')
  const maxDamage = calculations.find((c) => c.key === 'pattackdamagemax')
  assert.ok(minDamage)
  assert.ok(maxDamage)
  assert.equal(minDamage.expression, '0')
  assert.ok(maxDamage.expression.includes('90'))
  assert.ok(maxDamage.expression.includes('AD'))

  const ddSpell = {
    maxrank: 5,
    id: 'ThreshE',
    tooltip:
      'Deal between <magicDamage>{{ pattackdamagemin }}</magicDamage> and <magicDamage>{{ pattackdamagemax }} magic damage</magicDamage>.',
    effect: [null, [75, 120, 165, 210, 255], [20, 25, 30, 35, 40]],
    vars: [],
  }
  const cdSpell = { maxLevel: 5, coefficients: {}, effectAmounts: {} }
  const tooltip = parseTooltip(String(ddSpell.tooltip), ddSpell, cdSpell, binSpell)
  assert.ok(!tooltip.descriptionText.includes(' - '))
  assert.match(tooltip.descriptionText, /\b0\b.*AD/)
})

test('Kindred Q resolves damage and attack speed from DDragon effects', () => {
  const binSpell = {
    mEffectAmount: [
      { value: [25, 40, 65, 90, 115, 140, 175], __type: 'SpellEffectAmount' },
      { __type: 'SpellEffectAmount' },
      { value: [500, 500, 500, 500, 500, 500, 500], __type: 'SpellEffectAmount' },
      { value: [4.5, 4, 3.5, 3, 2.5, 2, 2], __type: 'SpellEffectAmount' },
      { value: [100, 100, 100, 100, 100, 100, 100], __type: 'SpellEffectAmount' },
      { value: [12, 12, 12, 12, 12, 12, 12], __type: 'SpellEffectAmount' },
      { value: [0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35], __type: 'SpellEffectAmount' },
      { value: [4, 4, 4, 4, 4, 4, 4], __type: 'SpellEffectAmount' },
    ],
    mSpellCalculations: {
      TotalDamage: {
        __type: 'GameCalculation',
        mFormulaParts: [
          { __type: 'EffectValueCalculationPart', mEffectIndex: 1 },
          { __type: 'StatByCoefficientCalculationPart', mStat: 2, mCoefficient: 0.75 },
        ],
      },
      TotalQAttackSpeed: {
        __type: 'GameCalculation',
        mFormulaParts: [
          { __type: 'EffectValueCalculationPart', mEffectIndex: 7 },
          {
            __type: 'BuffCounterByCoefficientCalculationPart',
            mCoefficient: 0.05,
          },
        ],
      },
    },
  }
  const ddSpell = {
    maxrank: 5,
    id: 'KindredQ',
    tooltip:
      'Kindred fait une cabriole et tire sur un maximum de 3 ennemis, infligeant <physicalDamage>{{ totaldamage }} pts de dégâts physiques</physicalDamage> et gagnant <attackSpeed>+{{ totalqattackspeed }} vitesse d attaque</attackSpeed> pendant {{ e8 }} sec.',
    effect: [
      null,
      [40, 65, 90, 115, 140],
      [0, 0, 0, 0, 0],
      [500, 500, 500, 500, 500],
      [4, 3.5, 3, 2.5, 2],
      [100, 100, 100, 100, 100],
      [12, 12, 12, 12, 12],
      [0.35, 0.35, 0.35, 0.35, 0.35],
      [4, 4, 4, 4, 4],
    ],
    vars: [],
    cooldown: [9, 9, 9, 9, 9],
    cost: [35, 35, 35, 35, 35],
    range: [340, 340, 340, 340, 340],
  }
  const cdSpell = { maxLevel: 5, coefficients: {}, effectAmounts: {} }
  const tooltip = parseTooltip(String(ddSpell.tooltip), ddSpell, cdSpell, binSpell)
  assert.ok(tooltip.descriptionText.includes('40 / 65 / 90 / 115 / 140'))
  assert.ok(tooltip.descriptionText.includes('(+ 75% AD)'))
  assert.ok(tooltip.descriptionText.includes('35%'))
  assert.ok(tooltip.descriptionText.includes('(+ 5% per mark)'))
})

test('Malphite W strips %i:scaleArmor% and unresolved f1/f2 parentheticals', () => {
  const binSpell = {
    DataValues: [
      {
        name: 'BonusArmorPassive',
        values: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35],
      },
      { name: 'BonusArmorPassiveMultiplier', values: [3, 3, 3, 3, 3, 3, 3] },
    ],
    mSpellCalculations: {
      TotalBonusDamage: {
        __type: 'GameCalculation',
        mFormulaParts: [
          { __type: 'NamedDataValueCalculationPart', mDataValue: 'ThunderclapBaseDamage' },
        ],
      },
    },
  }
  const ddSpell = {
    maxrank: 5,
    tooltip:
      "<spellPassive>Passive : </spellPassive>Malphite gagne <scaleArmor>+{{ bonusarmorpassive*100 }}% d'armure (%i:scaleArmor%{{ f1 }})</scaleArmor>. Cet effet est augmenté à <scaleArmor>+{{ bonusarmorpassive*300 }}% (%i:scaleArmor%{{ f2 }})</scaleArmor> quand <spellName>Bouclier de granit</spellName> est actif.",
    effect: [null],
    vars: [],
  }
  const cdSpell = { maxLevel: 5, coefficients: {}, effectAmounts: {} }
  const tooltip = parseTooltip(String(ddSpell.tooltip), ddSpell, cdSpell, binSpell)
  assert.ok(tooltip.descriptionText.includes("10/15/20/25/30% d'armure"))
  assert.ok(tooltip.descriptionText.includes('30/45/60/75/90%'))
  assert.ok(!tooltip.descriptionText.includes('%i:scaleArmor%'))
  assert.ok(!tooltip.descriptionText.includes('scaleArmor%-'))
  assert.ok(!tooltip.unresolvedVariables.includes('f1'))
  assert.ok(!tooltip.unresolvedVariables.includes('f2'))
})

test('Akali passive uses detailed stringtable tooltip with damage values', async () => {
  const { resolvePassiveTooltipContent, parseTooltip } = theorycraftTooltipTestUtils
  const stringTableRes = await fetch(
    'https://raw.communitydragon.org/latest/game/fr_fr/data/menu/en_us/lol.stringtable.json',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  assert.ok(stringTableRes.ok)
  const stringTable = ((await stringTableRes.json()) as { entries?: Record<string, string> }).entries ?? {}
  const content = resolvePassiveTooltipContent({
    championId: 'Akali',
    passiveBinSpell: null,
    stringTable,
  })
  assert.ok(content.main.includes('dégâts magiques') || content.main.includes('magicDamage'))
  const parsed = parseTooltip(
    content.main,
    { id: 'AkaliPassive', maxrank: 18 },
    {},
    null,
    new Map(),
    { isPassive: true }
  )
  assert.ok(parsed.descriptionText.includes('45'))
  assert.ok(
    parsed.descriptionText.includes('vitesse de déplacement') ||
      parsed.descriptionText.toLowerCase().includes('movement')
  )
})

test('Gangplank Q resolves Pourparlers tooltip from stringtable when DDragon meta template', async () => {
  const { buildExportedSpell, findBinSpellForDDragon, resolveSpellTooltipContent } =
    theorycraftTooltipTestUtils
  const championFullPath = join(process.cwd(), 'data', 'game', '16.10.1', 'fr_FR', 'championFull.json')
  const championFull = JSON.parse(readFileSync(championFullPath, 'utf-8')) as {
    data: { Gangplank: { spells: Array<Record<string, unknown>> } }
  }
  const ddSpell = championFull.data.Gangplank.spells[0]
  assert.ok(ddSpell)
  const binPath = join(process.cwd(), 'data/theorycraft-cache/cdragon-bin-gangplank.json')
  const championBin = JSON.parse(readFileSync(binPath, 'utf-8')) as Record<string, unknown>
  const binSpell = findBinSpellForDDragon(championBin, [String(ddSpell.id ?? ''), 'GangplankQ'])
  assert.ok(binSpell)

  const stringTableRes = await fetch(
    'https://raw.communitydragon.org/latest/game/fr_fr/data/menu/en_us/lol.stringtable.json',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  assert.ok(stringTableRes.ok)
  const stringTable = ((await stringTableRes.json()) as { entries?: Record<string, string> }).entries ?? {}

  const resolved = resolveSpellTooltipContent({
    ddSpell,
    cdSpell: {},
    binSpell,
    stringTable,
    sharedVars: new Map(),
  })
  assert.ok(resolved.main.includes('ShotDamage') || resolved.main.includes('physicalDamage'))
  assert.ok(!resolved.main.includes('Spell_GangplankQWrapper_Tooltip'))

  const exported = buildExportedSpell({
    championId: 'Gangplank',
    slotIndex: 0,
    ddSpell,
    cdSpell: {},
    binSpell,
    sharedVars: new Map(),
    stringTable,
    lang: 'fr_FR',
  })
  const text = String(exported.descriptionText ?? '')
  assert.ok(text.includes('Gangplank'))
  assert.ok(text.includes('dégâts physiques') || text.toLowerCase().includes('physical'))
  assert.ok(!text.includes('-}}'))
})

test('Fiora passive uses detailed stringtable tooltip with resolved values', async () => {
  const binPath = join(process.cwd(), 'data/theorycraft-cache/cdragon-bin-fiora.json')
  const championBin = JSON.parse(readFileSync(binPath, 'utf-8')) as Record<string, unknown>
  const binSpell = findPassiveBinSpell(championBin, 'Fiora')
  assert.ok(binSpell)

  const stringTableRes = await fetch(
    'https://raw.communitydragon.org/latest/game/fr_fr/data/menu/en_us/lol.stringtable.json'
  )
  assert.ok(stringTableRes.ok)
  const stringTablePayload = (await stringTableRes.json()) as { entries?: Record<string, string> }
  const stringTable = stringTablePayload.entries ?? {}

  const { main } = resolvePassiveTooltipContent({
    championId: 'Fiora',
    passiveBinSpell: binSpell,
    stringTable,
  })
  assert.ok(main.includes('PassiveDamageTotal'))
  assert.ok(main.includes('PassiveHealAmount'))

  const sharedVars = buildChampionSharedVariableMap(championBin)
  const passiveTooltip = parseTooltip(
    main,
    { id: 'FioraPassive', maxrank: 5 },
    {},
    binSpell,
    sharedVars,
    { isPassive: true }
  )
  assert.ok(passiveTooltip.descriptionText.includes('35 / 50.29'))
  assert.ok(passiveTooltip.descriptionText.includes('% de vitesse de déplacement'))
  assert.ok(passiveTooltip.descriptionText.toLowerCase().includes('dégâts bruts'))
  assert.ok(passiveTooltip.descriptionText.length > 200)
})

test('Twitch passive resolves OnHit token and venom damage from bin', () => {
  const binPath = '/tmp/twitch.bin.json'
  const bin = JSON.parse(readFileSync(binPath, 'utf-8')) as Record<string, unknown>
  const binSpell = findBinSpellForDDragon(bin, ['TwitchDeadlyVenomMarker'])
  assert.ok(binSpell)

  const passiveDescription =
    "Les attaques de base de Twitch contaminent sa cible %i:OnHit% <OnHit>à l'impact</OnHit>, lui infligeant des dégâts bruts chaque seconde."
  const passiveTooltip = parseTooltip(passiveDescription, {}, {}, binSpell)
  assert.ok(!passiveTooltip.descriptionText.includes('%i:OnHit%'))
  assert.ok(passiveTooltip.descriptionText.includes("à l'impact"))

  const { buildPassiveVenomDetailFromBin } = theorycraftTooltipTestUtils
  const venom = buildPassiveVenomDetailFromBin(binSpell!, 'fr_FR')
  assert.ok(venom)
  assert.ok(venom.descriptionText.includes('1 / 2 / 3 / 4 / 5'))
  assert.ok(venom.descriptionText.includes('(+ 3% AP)'))
  assert.ok(venom.descriptionText.includes('6 / 12 / 18 / 24 / 30'))
  assert.ok(venom.descriptionText.includes('36 / 72 / 108 / 144 / 180'))
})

test('Caitlyn passive headshot bonus uses level AD ratios without negative crit artifact', () => {
  const binPath = join(process.cwd(), 'data/theorycraft-cache/cdragon-bin-caitlyn.json')
  const championBin = JSON.parse(readFileSync(binPath, 'utf-8')) as Record<string, unknown>
  const passiveBin = findPassiveBinSpell(championBin, 'Caitlyn')
  assert.ok(passiveBin)

  const dataValues = extractBinDataValues(passiveBin!, 5)
  const calculations = extractBinCalculations(passiveBin!, dataValues, {
    maxRank: 5,
    isPassive: true,
  })
  const headshot = calculations.find((c) => c.key === 'headshotbonusdamage')
  assert.ok(headshot)
  assert.ok(headshot!.ratios.some((r) => r.stat === 'totalAD'))
  const adRatio = headshot!.ratios.find((r) => r.stat === 'totalAD')
  assert.ok(adRatio)
  assert.ok(adRatio!.coefficient.every((c) => c > 0))
  assert.ok(adRatio!.coefficient[0]! >= 0.5)

  const shared = buildChampionSharedVariableMap(championBin)
  const wBin = findBinSpellForDDragon(championBin, ['CaitlynW'])
  assert.ok(wBin)
  const wCalcs = extractBinCalculations(wBin!, extractBinDataValues(wBin!, 5), { maxRank: 5, slotIndex: 1 })
  const trapBonus = wCalcs.find((c) => c.key === 'headshotbonusdamage')
  assert.ok(trapBonus)
  assert.ok(shared.get('spell.caitlynw:headshotbonusdamage')?.includes('35'))

  const crossRef = parseTooltip(
    'Piège: @spell.CaitlynW:HeadshotBonusDamage@',
    { id: 'CaitlynPassive', maxrank: 5 },
    {},
    passiveBin,
    shared,
    { isPassive: true }
  )
  assert.ok(crossRef.descriptionText.includes('35'))
  assert.ok(!crossRef.descriptionText.includes('@spell'))
})

test('Lee Sin W shield ratio defaults to AP when bin omits mStat', () => {
  const binSpell = {
    DataValues: [{ name: 'ShieldValue', values: [-5, 40, 80, 120, 160] }],
    mSpellCalculations: {
      ShieldAmount: {
        __type: 'GameCalculation',
        mFormulaParts: [
          { __type: 'NamedDataValueCalculationPart', mDataValue: 'ShieldValue' },
          { __type: 'StatByCoefficientCalculationPart', mCoefficient: 0.8 },
        ],
      },
    },
  }
  const dataValues = extractBinDataValues(binSpell, 5)
  const calculations = extractBinCalculations(binSpell, dataValues, { maxRank: 5, slotIndex: 1 })
  const shield = calculations.find((c) => c.key === 'shieldamount')
  assert.ok(shield)
  assert.equal(shield.ratios[0]?.stat, 'AP')
  assert.ok(shield.expression.includes('(+ 80% AP)'))
})
