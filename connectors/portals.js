// Maps each portal (by name as stored in the `portals` table) to its own
// read-only database connection and a description of what's queryable.
// When a new portal gets a database, add an entry here.

const { Pool } = require('pg');

const portalConnections = {
  'Leyland Tenders': {
    pool: new Pool({
      connectionString: process.env.LEYLAND_DATABASE_URL,
      ssl: false
    }),
    schema: `
Table: tenders
  Formal tender submissions Fox Brothers Leyland is actively bidding on.
  Columns: ref, client, scheme, estimator, location, value (numeric), gm (gross margin numeric),
  division, due_date, return_date, status, priority, notes, date_received
  NOTE: this table is often empty or sparsely populated - most current pipeline activity
  lives in intel_inbox and opportunities instead.

Table: opportunities
  Tracked sales opportunities and projects being pursued, before they become formal tenders.
  Columns: division, project_name, client, contact, value, owner, status, comments, opp_date

Table: intel_inbox
  Market intelligence: news articles and leads about upcoming projects, scraped daily from
  external sources (planning portals, news, contract finder sites) and scored by AI for relevance.
  This is the PRIMARY source of "new opportunities" and "pipeline" data - use this table for
  any question about new leads, opportunities awaiting review/approval, recent projects,
  or what's coming up.
  Columns: title, url, summary, relevance_score (1-10, higher = more relevant), suggested_division,
  suggested_owner, ai_notes, source, status (e.g. 'pending', 'approved', 'dismissed'), published_at
    `.trim()
  },

  'KPI Reporting': {
    pool: new Pool({
      connectionString: process.env.KPI_DATABASE_URL,
      ssl: false
    }),
    schema: `
Table: plant_hire_data
  Weekly plant/fleet hire performance.
  Columns: week_commencing, total_fleet, on_hire, in_repair, utilisation_pct,
  external_revenue, internal_revenue, prior_week_revenue, ytd_external, ytd_internal, notes

Table: transactions
  Parts and supplier purchasing transactions across depots.
  Columns: upload_date, supplier, supplier_source_depot, part_no, part_name, cost, surcharge,
  po_no, po_created_date, supply_type, item_count, goods_received, target_depot, assigned_depot

Table: tx_budgets
  Monthly budget targets by category/tab.
  Columns: tab_name, year, month, budget

Table: wagon_ops_data
  Weekly haulage/wagon operations performance vs budget and forecast.
  Columns: week_commencing, weekly_revenue, total_moves, vehicles_utilised, avg_earnings_per_hook,
  monthly_budget, monthly_forecast, mtd_revenue, notes
    `.trim()
  }
};

module.exports = { portalConnections };
