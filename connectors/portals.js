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
  ref, client, scheme, estimator, location, value (numeric), gm (gross margin numeric),
  division, due_date, return_date, status, priority, notes, date_received

Table: opportunities
  division, project_name, client, contact, value, owner, status, comments, opp_date

Table: intel_inbox
  title, url, summary, relevance_score, suggested_division, suggested_owner,
  ai_notes, source, status, published_at
    `.trim()
  },

  'KPI Reporting': {
    pool: new Pool({
      connectionString: process.env.KPI_DATABASE_URL,
      ssl: false
    }),
    schema: `
Table: plant_hire_data
  week_commencing, total_fleet, on_hire, in_repair, utilisation_pct,
  external_revenue, internal_revenue, prior_week_revenue, ytd_external, ytd_internal, notes

Table: transactions
  upload_date, supplier, supplier_source_depot, part_no, part_name, cost, surcharge,
  po_no, po_created_date, supply_type, item_count, goods_received, target_depot, assigned_depot

Table: tx_budgets
  tab_name, year, month, budget

Table: wagon_ops_data
  week_commencing, weekly_revenue, total_moves, vehicles_utilised, avg_earnings_per_hook,
  monthly_budget, monthly_forecast, mtd_revenue, notes
    `.trim()
  }
};

module.exports = { portalConnections };
