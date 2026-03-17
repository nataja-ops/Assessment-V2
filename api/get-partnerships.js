// ============================================================
// FILE: api/get-partnerships.js
//
// HOW TO ADD:
// 1. In your GitHub repo click Add file → Create new file
// 2. Type  api/get-partnerships.js  as the filename
// 3. Paste this entire file → Commit directly to main
// ============================================================

const BASE_ID        = "apptKJnbKllpLEA8u";
const PIPELINE_TABLE = "tblfdNFG4TAPFxWbf";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "AIRTABLE_API_KEY not set in environment variables" });
  }

  try {
    const partnerships = [];
    let offset = null;

    do {
      const params = new URLSearchParams();
      params.append("fields[]", "fldSHTsSpveA7cHFs"); // Partnership label
      params.append("fields[]", "fldEYuhduLRkJeQ5e"); // Pipeline Status
      params.append("fields[]", "fld0ixuKHZrSwnzZV"); // Partner Type
      params.append("filterByFormula", `AND({Pipeline Status} != "Rejected", {Pipeline Status} != "On Ice")`);
      params.append("sort[0][field]", "fldSHTsSpveA7cHFs");
      params.append("sort[0][direction]", "asc");
      if (offset) params.append("offset", offset);

      const response = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${PIPELINE_TABLE}?${params.toString()}`,
        { headers: { "Authorization": `Bearer ${apiKey}` } }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Airtable error:", JSON.stringify(data));
        return res.status(response.status).json({ error: "Failed to fetch partnerships", details: data });
      }

      for (const record of data.records) {
        const f = record.fields;
        partnerships.push({
          id:             record.id,
          label:          f["fldSHTsSpveA7cHFs"] ?? "(unnamed)",
          pipelineStatus: f["fldEYuhduLRkJeQ5e"] ?? "",
          partnerType:    f["fld0ixuKHZrSwnzZV"] ?? [],
        });
      }

      offset = data.offset ?? null;
    } while (offset);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return res.status(200).json({ partnerships });

  } catch (err) {
    console.error("get-partnerships error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
};
