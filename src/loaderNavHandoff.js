/** Custom event so nav `GlyphLogo` can match the loading overlay during the fly-to-nav animation. */
export const LOADER_NAV_HANDOFF = "strangecolor:loader-nav-handoff";

export function setLoaderNavHandoffActive(active) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LOADER_NAV_HANDOFF, { detail: { active } }),
  );
}
