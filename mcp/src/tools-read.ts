import type { Api } from "./api.js";
import { type ToolOut, cellId, cellLabel, eur, findRelease, latestPerCell, matchesCell, when } from "./format.js";

export async function getBands(api: Api): Promise<ToolOut> {
  const releases = await api.releases();
  if (releases.length === 0) return { text: "No release has been published yet.", data: { bands: [], withheld: [] } };
  const newest = [...releases].sort((a, b) => b.id - a.id)[0]!;
  const bands = latestPerCell(releases);
  const withheld = newest.suppressed.map((s) => ({ release_id: newest.id, ...s }));

  const lines = [`Latest released pay bands (mean gross annual pay, EUR). Newest release is #${newest.id} (${newest.status}).`, ""];
  for (const { release_id, cell } of bands) {
    const stale = release_id !== newest.id ? `  [last published in release #${release_id}]` : "";
    lines.push(`- ${cellLabel(cell.key)}: ${eur(cell.mean_eur)} (average of ${cell.n} members)${stale}`);
  }
  lines.push("");
  if (withheld.length === 0) lines.push(`Nothing was withheld in release #${newest.id}.`);
  else {
    lines.push(`Withheld in release #${newest.id} (not published, on purpose):`);
    for (const w of withheld) lines.push(`- ${cellLabel(w.key)} [${w.reason}]: ${w.witness}`);
  }
  return {
    text: lines.join("\n"),
    data: { newest_release: newest.id, bands: bands.map((b) => ({ ...b.cell, as_of_release: b.release_id })), withheld },
  };
}

export async function listReleases(api: Api): Promise<ToolOut> {
  const releases = [...(await api.releases())].sort((a, b) => a.id - b.id);
  if (releases.length === 0) return { text: "No release has been published yet.", data: { releases: [] } };
  const rows = releases.map((r) => ({
    id: r.id, status: r.status, released_cells: r.cells.length, withheld_cells: r.suppressed.length,
    group_by: r.query?.group_by ?? [], logged_at: when(r), output_sha256: r.output_sha256 ?? null,
  }));
  const text = rows
    .map((r) => `#${r.id}  ${r.status.toUpperCase()}  group by ${r.group_by.join("+") || "?"}  released ${r.released_cells}, withheld ${r.withheld_cells}  (${r.logged_at})`)
    .join("\n");
  return { text: `Releases logged on NEAR testnet:\n${text}`, data: { releases: rows } };
}

const WHY: Record<string, string> = {
  differencing:
    "Publishing this cell would let anyone subtract an earlier release from this one and solve for a single member's pay. Bandsheet checks every earlier release too, not just this one, and withholds a cell the moment it becomes solvable.",
  small_cell:
    "Too few members fall in this cell, so the average would expose, or nearly expose, individual pay. Cells under the policy minimum are never published.",
};

export async function explainRefusal(api: Api, releaseId: number, cell: string): Promise<ToolOut> {
  const releases = await api.releases();
  const r = findRelease(releases, releaseId);
  const hit = r.suppressed.find((s) => matchesCell(s.key, cell));
  if (!hit) {
    const avail = r.suppressed.map((s) => cellLabel(s.key)).join("; ") || "nothing was withheld";
    const pub = r.cells.find((c) => matchesCell(c.key, cell));
    return {
      text: pub
        ? `${cellLabel(pub.key)} was NOT refused in release #${releaseId}: it was published (${eur(pub.mean_eur)}, average of ${pub.n} members).`
        : `No cell matching "${cell}" was withheld in release #${releaseId}. Withheld there: ${avail}.`,
      data: { found: false, published: Boolean(pub) },
    };
  }
  const earlier = [...releases].filter((x) => x.id < releaseId).sort((a, b) => b.id - a.id)
    .map((x) => ({ id: x.id, c: x.cells.find((c) => cellId(c.key) === cellId(hit.key)) })).find((x) => x.c);
  const lines = [
    `Release #${releaseId} withheld ${cellLabel(hit.key)}.`,
    `Reason: ${hit.reason}.`,
    `Witness (the exact check that failed): "${hit.witness}"`,
    "",
    WHY[hit.reason] ?? "The audit found this cell unsafe to publish.",
  ];
  if (earlier?.c && hit.reason === "differencing") {
    lines.push("", `For scale: release #${earlier.id} published ${cellLabel(hit.key)} as an average of ${earlier.c.n} members at ${eur(earlier.c.mean_eur)}. A newer average over a slightly different group, minus that, leaves exactly the difference between the groups: one person's pay.`);
  }
  return { text: lines.join("\n"), data: { found: true, release_id: releaseId, cell: hit.key, reason: hit.reason, witness: hit.witness } };
}
