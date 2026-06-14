import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const pages = [
  "index.html",
  "896_practical_entry_hub_20260606.html",
  "914_daily_operation_flow_20260606.html",
  "post_0618_operation_board_20260613.html",
  "post_0618_prebuy_final_verification_20260613.html",
  "912_june_event_actual_input_sheet_20260606.html",
  "post_0618_event_reflection_workflow_20260613.html",
  "post_0618_event_update_runbook_20260613.html",
  "post_0618_event_csv_apply_helper_20260613.html",
  "system_health_check_20260613.html",
  "candidate_selection_health_check_20260613.html",
  "candidate10_partial_resolution_20260613.html",
  "post0618_prebuy_ticket_20260613.html",
  "candidate10_reaction_backfill_20260613.html",
  "june_gate_operation.html",
  "capital_allocation_plan.html",
  "june_event_gate_engine.html",
  "latest_practical_start_20260614.html",
  "daily_practical_compact_board_20260614.html",
  "ticker_unlock_checklist_20260614.html",
  "unlock_input_workflow_20260614.html",
  "unlock_next_action_tickets_20260614.html",
];

const missing = [];
for (const page of pages) {
  const text = fs.readFileSync(path.join(ROOT, page), "utf8");
  const links = Array.from(text.matchAll(/href="([^"]+)"/g))
    .map((match) => match[1])
    .filter((href) => !href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto:"));

  for (const href of links) {
    const target = href.split("#")[0].split("?")[0];
    if (target && !fs.existsSync(path.join(ROOT, target))) {
      missing.push({ page, href });
    }
  }
}

if (missing.length > 0) {
  console.log("missing links");
  for (const item of missing) console.log(`${item.page} -> ${item.href}`);
  process.exit(1);
}

console.log("critical links OK");
