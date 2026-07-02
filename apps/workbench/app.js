const state = {
  leads: [],
  queue: [],
  selectedLeadId: null,
  shadowHistory: {},
};

const els = {
  leadList: document.getElementById("leadList"),
  leadCount: document.getElementById("leadCount"),
  leadDetail: document.getElementById("leadDetail"),
  queueList: document.getElementById("queueList"),
  queueCount: document.getElementById("queueCount"),
  refreshButton: document.getElementById("refreshButton"),
  previewButton: document.getElementById("previewButton"),
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return response.json();
}

function text(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function latestHistory(leadId) {
  const history = state.shadowHistory[leadId] || [];
  return history[history.length - 1] || null;
}

function renderLeads() {
  els.leadCount.textContent = `${state.leads.length} leads`;
  els.leadList.innerHTML = "";
  for (const lead of state.leads) {
    const latest = latestHistory(lead.id);
    const action = latest?.decision?.action || "PENDING";
    const row = document.createElement("button");
    row.type = "button";
    row.className = `row ${state.selectedLeadId === lead.id ? "active" : ""}`;
    row.innerHTML = `
      <div class="row-title">
        <span>${text(lead.company_name)}</span>
        <span class="badge ${String(action).toLowerCase()}">${action}</span>
      </div>
      <div class="row-meta">${text(lead.country)} / ${text(lead.industry)}</div>
      <div class="row-sub">v0.1: ${text(lead.v01_score)} | shadow: ${text(latest?.result?.shadow_score)} | delta: ${text(latest?.diff?.score_delta)}</div>
    `;
    row.addEventListener("click", () => selectLead(lead.id));
    els.leadList.appendChild(row);
  }
}

function renderLeadDetail() {
  const lead = state.leads.find((item) => item.id === state.selectedLeadId);
  els.previewButton.disabled = !lead;
  if (!lead) {
    els.leadDetail.innerHTML = '<div class="detail-empty">Select a lead.</div>';
    return;
  }
  const latest = latestHistory(lead.id);
  els.leadDetail.innerHTML = `
    <div class="detail-grid">
      <div class="field"><div class="field-label">Company</div><div class="field-value">${text(lead.company_name)}</div></div>
      <div class="field"><div class="field-label">Website Summary</div><div class="field-value">${text(lead.website_summary)}</div></div>
      <div class="field"><div class="field-label">Country</div><div class="field-value">${text(lead.country)}</div></div>
      <div class="field"><div class="field-label">Industry</div><div class="field-value">${text(lead.industry)}</div></div>
      <div class="field"><div class="field-label">v0.1 Score</div><div class="field-value">${text(lead.v01_score)} / ${text(lead.v01_grade)} / ${text(lead.v01_priority)}</div></div>
      <div class="field"><div class="field-label">Contactability</div><div class="field-value">email: ${text(lead.has_email)} | phone: ${text(lead.has_phone)}</div></div>
    </div>
    <div class="section">
      <h3>Latest Shadow Diff</h3>
      <div class="code">${JSON.stringify(latest?.diff || { status: "no shadow run yet" }, null, 2)}</div>
    </div>
    <div class="section">
      <h3>Decision</h3>
      <div class="code">${JSON.stringify(latest?.decision || { status: "pending" }, null, 2)}</div>
    </div>
  `;
}

function renderQueue() {
  els.queueCount.textContent = `${state.queue.length} items`;
  els.queueList.innerHTML = "";
  for (const item of state.queue) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-title">
        <span>${text(item.lead_id)}</span>
        <span class="badge ${String(item.action_recommendation).toLowerCase()}">${text(item.action_recommendation)}</span>
      </div>
      <div class="row-meta">status: ${text(item.review_status)} | confidence: ${text(item.confidence)}</div>
      <div class="row-sub">${text(item.next_step)}</div>
      <div class="actions">
        <button type="button" data-action="approve">Approve</button>
        <button type="button" data-action="reject">Reject</button>
        <button type="button" data-action="skip">Skip</button>
      </div>
    `;
    for (const button of row.querySelectorAll("button")) {
      button.addEventListener("click", () => updateReview(item.review_item_id, button.dataset.action));
    }
    els.queueList.appendChild(row);
  }
}

async function loadHistory(leadId) {
  const data = await api(`/api/leads/${leadId}/shadow-history`);
  state.shadowHistory[leadId] = data.history || [];
}

async function refresh() {
  const leads = await api("/api/leads");
  const queue = await api("/api/review-queue");
  state.leads = leads.leads || [];
  state.queue = queue.items || [];
  for (const lead of state.leads) {
    await loadHistory(lead.id);
  }
  renderLeads();
  renderLeadDetail();
  renderQueue();
}

async function selectLead(leadId) {
  state.selectedLeadId = leadId;
  await loadHistory(leadId);
  renderLeads();
  renderLeadDetail();
}

async function previewSelectedLead() {
  if (!state.selectedLeadId) return;
  await api("/api/shadow-runs/single-lead/preview", {
    method: "POST",
    body: JSON.stringify({ lead_id: state.selectedLeadId, allow_shadow_write: true }),
  });
  await refresh();
  await selectLead(state.selectedLeadId);
}

async function updateReview(reviewItemId, action) {
  await api(`/api/review-queue/${reviewItemId}/${action}`, {
    method: "POST",
    body: JSON.stringify({ note: "Local MVP review action." }),
  });
  await refresh();
}

els.refreshButton.addEventListener("click", refresh);
els.previewButton.addEventListener("click", previewSelectedLead);
refresh().catch((error) => {
  els.leadDetail.innerHTML = `<div class="code">Workbench API unavailable: ${text(error.message)}</div>`;
});
