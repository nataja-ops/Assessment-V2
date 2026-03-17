// ============================================================
// FILE: api/get-partnerships.js
// ============================================================

const BASE_ID        = "apptKJnbKllpLEA8u";
const PIPELINE_TABLE = "tblfdNFG4TAPFxWbf";

// Statuses to exclude from the dropdown
const EXCLUDED = ["Rejected", "On Ice"];

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "AIRTABLE_API_KEY not set" });
  }

  try {
    const partnerships = [];
    let offset = null;

    do {
      // Keep the URL simple — no filterByFormula, just the fields we need
      let url = `https://api.airtable.com/v0/${BASE_ID}/${PIPELINE_TABLE}?fields%5B%5D=fldSHTsSpveA7cHFs&fields%5B%5D=fldEYuhduLRkJeQ5e&fields%5B%5D=fld0ixuKHZrSwnzZV&pageSize=100`;
      if (offset) url += `&offset=${encodeURIComponent(offset)}`;

      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch { return res.status(500).json({ error: "Invalid JSON from Airtable", raw: text.slice(0, 300) }); }

      if (!response.ok) {
        return res.status(response.status).json({ error: "Airtable error", details: data });
      }

      for (const record of data.records || []) {
        const f      = record.fields || {};
        const status = f["fldEYuhduLRkJeQ5e"]?.name ?? "";
        if (EXCLUDED.includes(status)) continue; // filter out excluded statuses
        const label  = f["fldSHTsSpveA7cHFs"] ?? "";
        if (!label) continue; // skip blank labels
        partnerships.push({
          id:             record.id,
          label,
          pipelineStatus: status,
          partnerType:    (f["fld0ixuKHZrSwnzZV"] || []).map(t => t.name),
        });
      }

      offset = data.offset ?? null;
    } while (offset);

    // Sort alphabetically by label
    partnerships.sort((a, b) => a.label.localeCompare(b.label));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return res.status(200).json({ partnerships });

  } catch (err) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
};
