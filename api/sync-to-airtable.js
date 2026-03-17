// ============================================================
// FILE: api/sync-to-airtable.js
//
// WHAT IT DOES:
// - First save (Initial Assessment) → CREATES a new Assessments record
// - Subsequent saves (Goals, Final)  → UPDATES that same record
//   (pass airtableAssessmentId in the request body to trigger an update)
// ============================================================

const BASE_ID           = "apptKJnbKllpLEA8u";
const ASSESSMENTS_TABLE = "tbldyDcTuEmjbzMmr";
const PIPELINE_TABLE    = "tblfdNFG4TAPFxWbf";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "AIRTABLE_API_KEY not set in environment variables" });

  const headers = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };

  try {
    const body = req.body;
    let partnershipRecordId = body.partnershipRecordId ?? null;

    // ── Step 1: Look up Partnership record if not provided ──────────────────
    if (!partnershipRecordId && body.partnerName) {
      const safe   = body.partnerName.replace(/'/g, "\\'");
      const filter = encodeURIComponent(`SEARCH('${safe}', {Partnership})`);
      const url    = `https://api.airtable.com/v0/${BASE_ID}/${PIPELINE_TABLE}?filterByFormula=${filter}&fields[]=fldSHTsSpveA7cHFs&sort[0][field]=fldF9iLu6IczFfZ92&sort[0][direction]=desc&maxRecords=1`;
      const r      = await fetch(url, { headers });
      const data   = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: "Partnership lookup failed", details: data });
      if (!data.records.length) return res.status(404).json({ error: `No partnership found for: "${body.partnerName}"` });
      partnershipRecordId = data.records[0].id;
    }

    // ── Step 2: Build fields ────────────────────────────────────────────────
    const fields = {};
    if (body.assessmentType)  fields["fldp8Sq9PC1Rmp2tK"] = body.assessmentType;
    fields["fld6e09iaYwftMIfu"] = body.status ?? "Complete";
    if (body.notes)            fields["fld6WWw9TyHkr4EXC"] = body.notes;
    if (partnershipRecordId)   fields["fldBiTtSb6uL9TIOS"] = [partnershipRecordId];

    const scoreFields = {
      'vision-student': "fld9qCXakt8uAtfIU", 'vision-system': "fldKjeMVUyfhPtZVl",
      'vision-instruction': "fldJWbeV63O8FbxgV", 'strategy-set': "fld7OWc2VDu90lNTk",
      'strategy-change': "fldNWl5TWTnCutadh", 'stakeholders-context': "fld3tyY5eivMdvIlO",
      'stakeholders-engage': "fldzJ34FDRFCR1iZg", 'stakeholders-communicate': "fldEaCbJIXFop3oOK",
      'policy-guardrails': "fldwvIDtbTV0aKEqo", 'policy-processes': "fldxDgkv9JeorGaTi",
      'teaching-capacity': "fldjZz3t4c0aD3Eeb", 'teaching-materials': "fldWAq5qi59dOzW7D",
      'teaching-dept': "fldSda1Is4V2hxlik", 'teaching-tools': "fldQAzaCQVcQ1DWgf",
      'sv-student': "fldgSprjbEPoULtZF", 'sv-system': "fldfF7Gorr8mYNkfp",
      'sv-instruction': "fldE0gYYP5AtGPRck", 'ss-context': "fldcA8YWywiwviLTc",
      'ss-communicate': "fld1ddqXK7fa393P2", 'sp-guardrails': "fldwkfL7lU5Uf3dFx",
      'sp-processes': "fldQMmABtqbEjOUZz", 'st-leadership': "fldXgUW1v4EdK3Its",
      'st-coaching': "fldhtEVWL3LvPiHEg", 'st-materials': "fldvuHbbTgXyVKxmC",
      'st-tools': "fldZ5dgPA3Sh8zega",
    };
    for (const [key, fieldId] of Object.entries(scoreFields)) {
      if (body[key] !== undefined && body[key] !== null) fields[fieldId] = Number(body[key]);
    }

    // ── Step 3: CREATE or UPDATE ────────────────────────────────────────────
    const existingId = body.airtableAssessmentId ?? null;
    const url        = existingId
      ? `https://api.airtable.com/v0/${BASE_ID}/${ASSESSMENTS_TABLE}/${existingId}`
      : `https://api.airtable.com/v0/${BASE_ID}/${ASSESSMENTS_TABLE}`;

    const response = await fetch(url, {
      method:  existingId ? "PATCH" : "POST",
      headers,
      body:    JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Airtable error:", JSON.stringify(err));
      return res.status(response.status).json({ error: "Airtable write failed", details: err });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, recordId: data.id, partnershipRecordId });

  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
};
