(function () {
  "use strict";
  var host = (location.hostname || "").toLowerCase();
  if (host.indexOf("lelanation.fr") < 0) return;
  if (location.protocol !== "https:") return;

  var pending = false;

  function deliver(build) {
    if (!build || !build.id) return;
    var msg = {
      type: "lelanation:companion-import-build",
      payload: { build: build },
    };

    try {
      if (window.top && window.top !== window) {
        window.top.postMessage(msg, "*");
      }
    } catch (e) {}

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: "lelanation:companion-proxy-import", payload: { build: build } },
          "*"
        );
      }
    } catch (e) {}

    try {
      var tauri = window.__TAURI__;
      if (tauri && tauri.core && typeof tauri.core.invoke === "function") {
        tauri.core.invoke("companion_import_build", { build: build });
      }
    } catch (e) {}
  }

  function resolveBuildId(btn) {
    var item = btn.closest(".build-grid-item");
    if (!item) return null;
    var el = item.querySelector("[data-build-id]");
    return el ? el.getAttribute("data-build-id") : null;
  }

  function mergeActiveSubBuild(build, btn) {
    if (!build || !build.subBuilds || !build.subBuilds.length) return build;
    var item = btn.closest(".build-grid-item");
    if (!item) return build;
    var raw = item.getAttribute("data-active-sub-index");
    if (raw === null || raw === "") return build;
    var idx = parseInt(raw, 10);
    if (isNaN(idx) || idx < 0) return build;
    var sub = build.subBuilds[idx];
    if (!sub) return build;
    return {
      id: build.id,
      name: sub.title || build.name,
      description: sub.description !== undefined ? sub.description : build.description,
      champion: build.champion,
      items: sub.items,
      runes: sub.runes,
      shards: sub.shards,
      summonerSpells: sub.summonerSpells,
      skillOrder: sub.skillOrder,
      roles: sub.roles,
      tags: sub.tags || build.tags,
      gameVersion: sub.gameVersion || build.gameVersion,
      subBuilds: build.subBuilds,
    };
  }

  document.addEventListener(
    "click",
    function (ev) {
      var target = ev.target;
      if (!target || !target.closest) return;
      var btn = target.closest(".build-grid-action-button--companion");
      if (!btn) return;
      if (pending) return;

      var buildId = resolveBuildId(btn);
      if (!buildId) return;

      pending = true;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();

      fetch(location.origin + "/api/builds/" + encodeURIComponent(buildId), {
        credentials: "omit",
      })
        .then(function (res) {
          return res.ok ? res.json() : null;
        })
        .then(function (build) {
          pending = false;
          if (build) deliver(mergeActiveSubBuild(build, btn));
        })
        .catch(function () {
          pending = false;
        });
    },
    true
  );
})();
