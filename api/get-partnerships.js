

const BASE_ID      = "apptKJnbKllpLEA8u";
const CHECKIN_TABLE = "tblcod2MjY98TCSmO"; // Partner Progress Reporting

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Airtable API key not configured" });

  try {
    const { partnershipRecordId, date, notes, reportedBy, ratings } = req.body;

    if (!partnershipRecordId) {
      return res.status(400).json({ error: "partnershipRecordId is required" });
    }

    // Build a readable summary of any rating changes for the notes field
    const ratingLines = Object.entries(ratings || {})
      .map(([subdomain, level]) => `• ${subdomain}: Level ${level}`)
      .join('\n');

    const progressNotes = [
      notes,
      ratingLines ? `\nRating updates:\n${ratingLines}` : ''
    ].filter(Boolean).join('\n').trim();

    const fields = {
      "fldYhMGzmSxGsd4cL": [partnershipRecordId],  // Partnership → links to Opportunities by Pipeline
      "fldPC4HjJaYD8NLO7": progressNotes,           // Progress Notes
      "fld8amOUNSbaAMBDM": date,                    // Date Reported (YYYY-MM-DD)
    };

    // Reported By — free text label in notes since it's a record link field
    // We prepend the PM name to the notes so it's visible in Airtable
    if (reportedBy) {
      fields["fldPC4HjJaYD8NLO7"] = `Reported by: ${reportedBy}\n\n${progressNotes}`;
    }

    const response = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${CHECKIN_TABLE}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: "Airtable write failed", details: err });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, recordId: data.id });

  } catch (err) {
    console.error("Check-in sync error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
