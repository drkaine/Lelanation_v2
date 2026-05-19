/** Re-export — stats reads use `lelanation_statistiques` via statsPatchQuery. */
export {
  invalidateAggArchivePartitionCache,
  liveAggRelationExists,
  matchVersionedAggFrom,
  normalizePatchMajorMinor,
  sqlAggOrArchiveRelation,
  sqlAggUnionAllLiveAndArchives,
} from '../stats/statsPatchQuery.js'
