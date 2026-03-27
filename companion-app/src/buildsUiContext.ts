import type { InjectionKey, Ref } from "vue";
import type { Build, Role } from "@lelanation/shared-types";
import type { ImageResolvers, RuneLookup } from "@lelanation/builds-ui";

export interface CompanionBuildsUiContext {
  t: (key: string, params?: Record<string, string | number>) => string;
  searchQuery: Ref<string>;
  selectedRole: Ref<Role | null>;
  onlyUpToDate: Ref<boolean>;
  sortBy: Ref<"recent" | "name">;
  hasActiveFilters: Ref<boolean>;
  roleOptions: Ref<Array<{ value: Role; label: string; icon: string }>>;
  sortOptions: Ref<Array<{ value: string; label: string }>>;
  discoverBuilds: Ref<Build[]>;
  imageResolvers: Ref<ImageResolvers>;
  runeLookup: Ref<RuneLookup>;
  importedBuildIds: Ref<Set<string>>;
  isFavorite: (buildId: string) => boolean;
  toggleFavorite: (buildId: string) => void;
  buildVersion: (build: Build) => string;
  openDetail: (build: Build) => void;
  onVariantChange: (buildId: string, idx: number | null) => void;
  clearFilters: () => void;
}

export const CompanionBuildsUiKey: InjectionKey<CompanionBuildsUiContext> = Symbol(
  "CompanionBuildsUiKey"
);
