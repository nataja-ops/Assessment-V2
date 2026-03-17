
const BASE_ID        = "apptKJnbKllpLEA8u";
const PIPELINE_TABLE = "tblfdNFG4TAPFxWbf"; // Opportunities by Pipeline

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Airtable API key not configured" });
  }

  try {
    const partnerships = [];
    let offset = null;

    // Airtable paginates at 100 records — loop until all pages are fetched
    do {
      const params = new URLSearchParams({
        // Only pull the fields we need for the dropdown
        "fields[]":              "fldSHTsSpveA7cHFs", // Partnership (formula: "YYYY | Name | Status")
        "fields[]":              "fldv2qrLtSOEeWY6I", // Accounts (Synced) — for the partner name
        "fields[]":              "fldEYuhduLRkJeQ5e", // Pipeline Status
        "fields[]":              "fld0ixuKHZrSwnzZV", // Partner Type (District/School)
        // Only include active/relevant partnerships — adjust these as needed
        "filterByFormula":       `AND({Pipeline Status} != "Inactive", {Pipeline Status} != "Rejected", {Pipeline Status} != "On Ice")`,
        "sort[0][field]":        "fldSHTsSpveA7cHFs",
        "sort[0][direction]":    "asc",
      });

      if (offset) params.set("offset", offset);

      const response = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${PIPELINE_TABLE}?${params}`,
        { headers: { "Authorization": `Bearer ${apiKey}` } }
      );

      if (!response.ok) {
        const err = await response.json();
        console.error("Airtable fetch error:", err);
        return res.status(response.status).json({ error: "Failed to fetch partnerships", details: err });
      }

      const data = await response.json();

      for (const record of data.records) {
        const f = record.fields;
        partnerships.push({
          id:             record.id,                          // Airtable record ID — pass this as partnershipRecordId
          label:          f["fldSHTsSpveA7cHFs"] ?? "",       // Full label e.g. "2025 | Springfield USD | Active"
          pipelineStatus: f["fldEYuhduLRkJeQ5e"] ?? "",
          partnerType:    f["fld0ixuKHZrSwnzZV"] ?? [],
        });
      }

      offset = data.offset ?? null;
    } while (offset);

    // Cache hint — partnerships don't change often, so browsers/Vercel can cache for 5 min
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return res.status(200).json({ partnerships });

  } catch (err) {
    console.error("get-partnerships error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
