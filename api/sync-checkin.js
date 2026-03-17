// ============================================================
// FILE: api/sync-checkin.js
//
// WHAT IT DOES:
// Creates a new record in Partner Progress Reporting for each check-in.
// Each check-in is linked to the Partnership (Opportunities by Pipeline).
// ============================================================

const BASE_ID       = "apptKJnbKllpLEA8u";
const CHECKIN_TABLE = "tblcod2MjY98TCSmO"; // Partner Progress Reporting

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "AIRTABLE_API_KEY not set in environment variables" });

  try {
    const { partnershipRecordId, date, notes, reportedBy, ratings } = req.body;

    if (!partnershipRecordId) {
      return res.status(400).json({ error: "partnershipRecordId is required" });
    }

    // Build a readable summary of rating changes
    const ratingLines = Object.entries(ratings || {})
      .map(([subdomain, level]) => `• ${subdomain}: Level ${level}`)
      .join('\n');

    let progressNotes = notes || '';
    if (ratingLines) progressNotes += `\n\nRating updates:\n${ratingLines}`;
    if (reportedBy)  progressNotes = `Reported by: ${reportedBy}\n\n${progressNotes}`;

    const fields = {
      "fldYhMGzmSxGsd4cL": [partnershipRecordId], // Partnership link
      "fldPC4HjJaYD8NLO7": progressNotes.trim(),  // Progress Notes
      "fld8amOUNSbaAMBDM": date,                  // Date Reported
    };

    const response = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${CHECKIN_TABLE}`,
      {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ fields }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      console.error("Airtable error:", JSON.stringify(err));
      return res.status(response.status).json({ error: "Airtable write failed", details: err });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, recordId: data.id });

  } catch (err) {
    console.error("Check-in sync error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
};
