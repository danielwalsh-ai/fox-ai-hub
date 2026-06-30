const { portalConnections } = require('./portals');

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude(messages, system) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system,
      messages
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const textBlock = data.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

// Step 1: ask Claude to write a SQL query for each accessible portal,
// given the user's question and that portal's schema.
async function generateSQL(question, portalName, schema) {
  const system = `You write read-only PostgreSQL SELECT queries.
You are given a database schema for "${portalName}" with notes on what each table actually contains and when to use it.
Read the table descriptions carefully before choosing which table(s) to query - the most obviously-named table is not always the right one.
Respond with ONLY the SQL query, nothing else, no markdown formatting, no explanation.
If the question is clearly unrelated to this schema's data, respond with exactly: SKIP
Never write INSERT, UPDATE, DELETE, DROP, or any modifying statement - SELECT only.
Use reasonable LIMIT clauses (e.g. LIMIT 50) unless the question asks for aggregates.`;

  const userMsg = `Schema:\n${schema}\n\nQuestion: ${question}`;

  const sql = await callClaude([{ role: 'user', content: userMsg }], system);
  return sql.trim();
}

// Step 2: run that SQL against the portal's database.
async function runQuery(portalName, sql) {
  const conn = portalConnections[portalName];
  if (!conn) return { error: `No database connection configured for ${portalName}` };

  // Basic safety check - only allow SELECT statements
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT')) {
    return { error: 'Query rejected - only SELECT statements are allowed' };
  }

  try {
    const result = await conn.pool.query(sql);
    return { rows: result.rows };
  } catch (err) {
    return { error: err.message };
  }
}

// Step 3: given the question and all the data gathered, ask Claude to write the report.
async function generateReport(question, dataByPortal) {
  const system = `You are a business reporting assistant for Fox Group, a UK construction and infrastructure company.
You write clear, professional reports in plain English based on real data provided to you.
Use specific numbers from the data. Be concise. Use short paragraphs, not bullet-heavy formatting.
If data from multiple portals is provided, weave it into a single coherent report rather than listing portals separately.
If no usable data was found, say so plainly rather than inventing numbers.`;

  const dataText = Object.entries(dataByPortal)
    .map(([portal, result]) => {
      if (result.error) return `${portal}: (no data - ${result.error})`;
      if (!result.rows || result.rows.length === 0) return `${portal}: (no matching records)`;
      return `${portal} data:\n${JSON.stringify(result.rows, null, 2)}`;
    })
    .join('\n\n');

  const userMsg = `Question: ${question}\n\nData gathered:\n${dataText}`;

  return await callClaude([{ role: 'user', content: userMsg }], system);
}

// Main entry point: given a question and the list of portal names the user can access,
// generate SQL for each, run it, then synthesise a report.
async function answerQuestion(question, accessiblePortalNames) {
  const queryablePortals = accessiblePortalNames.filter(name => portalConnections[name]);

  if (queryablePortals.length === 0) {
    return {
      report: "You don't have access to any portals with connected data sources yet. Contact an admin to set this up.",
      sources: []
    };
  }

  const dataByPortal = {};
  const sources = [];

  for (const portalName of queryablePortals) {
    const { schema } = portalConnections[portalName];
    const sql = await generateSQL(question, portalName, schema);

    if (sql === 'SKIP' || !sql) continue;

    const result = await runQuery(portalName, sql);
    dataByPortal[portalName] = result;
    sources.push({ portal: portalName, sql, rowCount: result.rows ? result.rows.length : 0 });
  }

  if (Object.keys(dataByPortal).length === 0) {
    return {
      report: "I couldn't find relevant data for that question in the portals you have access to. Try rephrasing, or ask about tenders, opportunities, plant hire, or wagon operations.",
      sources: []
    };
  }

  const report = await generateReport(question, dataByPortal);
  return { report, sources };
}

module.exports = { answerQuestion };
