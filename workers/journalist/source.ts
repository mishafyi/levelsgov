/**
 * The journalist `Source` — turns the OPM signal query into the engine's
 * domain-agnostic `DiscoverySignal`, and prior posts into `CoveredTopic`s for
 * anti-repetition. The engine owns the LOGIC (cluster → research → story pick);
 * this owns the DATA (gathering the raw signal + formatting it into the summary
 * text the discovery LLM reads).
 */
import type {
  Source,
  DiscoverySignal,
  SignalItem,
  CoveredTopic,
} from "ai-journalist/ports";
import { agencySpikes, latestFlowMonth, type SpikeRow } from "./db.ts";
import { coveredPosts } from "./pbPosts.ts";
import { titleCase } from "./util.ts";
import { recordSignalEntities } from "./runState.ts";

/** Pretty-print a signed integer, e.g. 1936 → "+1,936", -12 → "-12". */
function signed(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${Math.abs(n).toLocaleString("en-US")}`;
}

/** One spike row → a `SignalItem` the discovery pass clusters into a story. */
function toSignalItem(row: SpikeRow): SignalItem {
  const agency = titleCase(row.agency);
  const hireDelta = row.hires - row.hiresPrev;
  const sepDelta = row.seps - row.sepsPrev;
  const occs = row.topHireOccupations.map(titleCase);
  const cats = row.topSepCategories.map(titleCase);

  const title = `${agency}: ${signed(hireDelta)} hires / ${signed(sepDelta)} separations MoM`;
  const summary =
    `${agency} recorded ${row.hires.toLocaleString()} hires ` +
    `(prior month ${row.hiresPrev.toLocaleString()}) and ` +
    `${row.seps.toLocaleString()} separations (prior month ${row.sepsPrev.toLocaleString()}) ` +
    `in the latest OPM flow month. ` +
    (occs.length
      ? `Top hiring occupations: ${occs.join(", ")}. `
      : "") +
    (cats.length
      ? `Dominant separation categories: ${cats.join(", ")}.`
      : "");

  return {
    title,
    summary,
    // agency first, then the hiring occupations (typed entities re-extracted by
    // the linker from the finished article — this is just clustering material).
    entities: [agency, ...occs],
    weight: row.absDelta,
  };
}

export function createSource(): Source {
  return {
    async gatherSignal(): Promise<DiscoverySignal> {
      const [rows, month] = await Promise.all([
        agencySpikes(),
        latestFlowMonth("accessions"),
      ]);
      const priorLabel = month; // YYYYMM; the framing states "vs prior"
      const items = rows.map(toSignalItem);
      // Record the run's entities so the Sink can populate posts.entities.
      recordSignalEntities(items.flatMap((it) => it.entities));
      return {
        framing: `US federal workforce, latest OPM month ${priorLabel} vs prior`,
        items,
      };
    },

    async coveredTopics(): Promise<CoveredTopic[]> {
      const posts = await coveredPosts();
      return posts.map((p) => ({
        title: p.title,
        slug: p.slug,
        entities: p.entities,
        date: p.date,
      }));
    },
  };
}
