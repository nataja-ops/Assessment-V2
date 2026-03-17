

const BASE_ID          = "apptKJnbKllpLEA8u";
const ASSESSMENTS_TABLE = "tbldyDcTuEmjbzMmr";
const PIPELINE_TABLE    = "tblfdNFG4TAPFxWbf";
const AT = (table) => `https://api.airtable.com/v0/${BASE_ID}/${table}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Airtable API key not configured" });

  const headers = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };

  try {
    const body = req.body;
    let partnershipRecordId = body.partnershipRecordId ?? null;

    // ── Step 1: Look up Partnership record if not provided ──────────────────
    if (!partnershipRecordId && body.partnerName) {
      const safe   = body.partnerName.replace(/'/g, "\\'");
      const filter = encodeURIComponent(`SEARCH('${safe}', {Partnership})`);
      const url    = `${AT(PIPELINE_TABLE)}?filterByFormula=${filter}&fields[]=fldSHTsSpveA7cHFs&sort[0][field]=fldF9iLu6IczFfZ92&sort[0][direction]=desc&maxRecords=1`;
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
    let response;

    if (existingId) {
      // UPDATE existing record
      response = await fetch(`${AT(ASSESSMENTS_TABLE)}/${existingId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ fields }),
      });
    } else {
      // CREATE new record
      response = await fetch(AT(ASSESSMENTS_TABLE), {
        method: "POST",
        headers,
        body: JSON.stringify({ fields }),
      });
    }

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: "Airtable write failed", details: err });
    }

    const data = await response.json();
    return res.status(200).json({
      success: true,
      recordId: data.id,           // assessment record ID — store this locally!
      partnershipRecordId,
    });

  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}

const BASE_ID           = "apptKJnbKllpLEA8u";
const ASSESSMENTS_TABLE = "tbldyDcTuEmjbzMmr"; // Assessments
const PIPELINE_TABLE    = "tblfdNFG4TAPFxWbf";  // Opportunities by Pipeline

const AT = (table) =>
  `https://api.airtable.com/v0/${BASE_ID}/${table}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Airtable API key not configured" });
  }

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    const body = req.body;

    // ── Step 1: Look up the Partnership record ID by partner name ─────────────
    // The "Partnership" formula field in Opportunities by Pipeline is formatted as
    // "YYYY | Account Name | Pipeline Status", so we search for the account name
    // as a substring. We also filter to the most recent active record if multiple match.
    let partnershipRecordId = body.partnershipRecordId ?? null;

    if (!partnershipRecordId && body.partnerName) {
      const safePartnerName = body.partnerName.replace(/'/g, "\\'");
      const filter = encodeURIComponent(`SEARCH('${safePartnerName}', {Partnership})`);
      const lookupUrl = `${AT(PIPELINE_TABLE)}?filterByFormula=${filter}&fields[]=fldSHTsSpveA7cHFs&sort[0][field]=fldF9iLu6IczFfZ92&sort[0][direction]=desc&maxRecords=1`;

      const lookupRes = await fetch(lookupUrl, { headers });
      if (!lookupRes.ok) {
        const err = await lookupRes.json();
        console.error("Partnership lookup error:", err);
        return res.status(lookupRes.status).json({ error: "Partnership lookup failed", details: err });
      }

      const lookupData = await lookupRes.json();
      if (lookupData.records.length === 0) {
        return res.status(404).json({
          error: `No partnership found for partner name: "${body.partnerName}". ` +
                 `Check that the name matches exactly what's in Airtable, or pass partnershipRecordId directly.`
        });
      }
      partnershipRecordId = lookupData.records[0].id;
    }

    // ── Step 2: Build the Assessment record fields ────────────────────────────
    const fields = {};

    // Assessment Type — "Pre-Assessment" | "Goals Assessment" | "Final Assessment"
    if (body.assessmentType) fields["fldp8Sq9PC1Rmp2tK"] = body.assessmentType;

    // Status — "Draft" | "Complete"
    fields["fld6e09iaYwftMIfu"] = body.status ?? "Complete";

    // Notes
    if (body.notes) fields["fld6WWw9TyHkr4EXC"] = body.notes;

    // Link to Partnership record
    if (partnershipRecordId) fields["fldBiTtSb6uL9TIOS"] = [partnershipRecordId];

    // ── Numeric rubric scores (0–3 each) ─────────────────────────────────────
    const scoreFields = {
      // District
      visionStudentReadiness:              "fld9qCXakt8uAtfIU",
      visionSystemAIUse:                   "fldKjeMVUyfhPtZVl",
      visionAIUseInInstruction:            "fldJWbeV63O8FbxgV",
      strategySetStrategy:                 "fld7OWc2VDu90lNTk",
      strategyPlanForChange:               "fldNWl5TWTnCutadh",
      stakeholdersContextGathering:        "fld3tyY5eivMdvIlO",
      stakeholdersEngageAndLearn:          "fldzJ34FDRFCR1iZg",
      stakeholdersCommunicateAndEducate:   "fldEaCbJIXFop3oOK",
      policyGuardrails:                    "fldwvIDtbTV0aKEqo",
      policyProcesses:                     "fldxDgkv9JeorGaTi",
      teachingCapacityBuilding:            "fldjZz3t4c0aD3Eeb",
      teachingInstructionalMaterials:      "fldWAq5qi59dOzW7D",
      teachingDepartmentalAlignment:       "fldSda1Is4V2hxlik",
      teachingToolSelection:               "fldQAzaCQVcQ1DWgf",
      // School-only
      schoolVisionStudentAIReadiness:      "fldgSprjbEPoULtZF",
      schoolVisionSchoolAIUse:             "fldfF7Gorr8mYNkfp",
      schoolVisionAIUseInInstruction:      "fldE0gYYP5AtGPRck",
      schoolStakeholdersContextGathering:  "fldcA8YWywiwviLTc",
      schoolStakeholdersCommunicateEducate:"fld1ddqXK7fa393P2",
      schoolPolicyGuardrails:              "fldwkfL7lU5Uf3dFx",
      schoolPolicyProcesses:               "fldQMmABtqbEjOUZz",
      schoolTeachingInstructionalLeadership:"fldXgUW1v4EdK3Its",
      schoolTeachingObservationCoaching:   "fldhtEVWL3LvPiHEg",
      schoolTeachingInstructionalMaterials:"fldvuHbbTgXyVKxmC",
      schoolTeachingToolSelection:         "fldZ5dgPA3Sh8zega",
    };

    for (const [key, fieldId] of Object.entries(scoreFields)) {
      if (body[key] !== undefined && body[key] !== null) {
        fields[fieldId] = Number(body[key]);
      }
    }

    // ── Step 3: Create the Assessment record ──────────────────────────────────
    const createRes = await fetch(AT(ASSESSMENTS_TABLE), {
      method: "POST",
      headers,
      body: JSON.stringify({ fields }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      console.error("Airtable create error:", err);
      return res.status(createRes.status).json({ error: "Airtable write failed", details: err });
    }

    const created = await createRes.json();
    return res.status(200).json({
      success: true,
      recordId: created.id,
      partnershipRecordId,
    });

  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
