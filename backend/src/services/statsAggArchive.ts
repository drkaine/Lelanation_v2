/** Re-export — stats reads use `lelanation_statistiques` via statsPatchQuery. */
export {
  buildProgressionOldestOnlySql,
  buildProgressionSinceSql,
  comparePatchMajorMinor,
  invalidateAggArchivePartitionCache,
  listDistinctPatchVersions,
  liveAggRelationExists,
  matchVersionedAggFrom,
  normalizePatchMajorMinor,
  patchesInProgressionSinceRange,
  progressionHasComparableSinceRange,
  sqlAggOrArchiveRelation,
  sqlAggUnionAllLiveAndArchives,
} from '../stats/statsPatchQuery.js'
