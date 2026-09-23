const COSTCO_BASE = "https://ecom-api.costco.com/ebusiness/inventory/v1/inventorylevels/availability/pickup";

const els = {
  proxyUrl: document.getElementById("proxyUrl"),
  configUrl: document.getElementById("configUrl"),
  saveSettings: document.getElementById("saveSettings"),
  loadStatus: document.getElementById("loadStatus"),
  pickerCard: document.getElementById("pickerCard"),
  warehouseList: document.getElementById("warehouseList"),
  itemList: document.getElementById("itemList"),
  itemFilter: document.getElementById("itemFilter"),
  checkBtn: document.getElementById("checkBtn"),
  progress: document.getElementById("progress"),
  resultsTable: document.getElementById("resultsTable"),
  resultsBody: document.getElementById("resultsBody"),
  settings: document.getElementById("settings"),
};

let config = null;

function loadSettings() {
  els.proxyUrl.value = localStorage.getItem("costco_proxy_url") || "";
  els.configUrl.value = localStorage.getItem("costco_config_url") || "";
}

function saveSettings() {
  localStorage.setItem("costco_proxy_url", els.proxyUrl.value.trim());
  localStorage.setItem("costco_config_url", els.configUrl.value.trim());
}

function setStatus(msg, isError = false) {
  els.loadStatus.textContent = msg;
  els.loadStatus.style.color = isError ? "var(--error)" : "inherit";
}

async function loadConfig() {
  const configUrl = els.configUrl.value.trim();
  if (!configUrl) {
    setStatus("Enter a config.json URL above and click Save & Load.", true);
    return;
  }
  setStatus("Loading config...");
  try {
    const resp = await fetch(configUrl, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    config = await resp.json();
  } catch (err) {
    setStatus(`Couldn't load config.json: ${err}`, true);
    return;
  }

  renderWarehouses();
  renderItems();
  els.pickerCard.hidden = false;
  els.settings.open = false;
  setStatus(`Loaded ${config.items.length} item(s) and ${config.warehouses.length} warehouse(s).`);
}

function normalizeWarehouses() {
  return (config.warehouses || []).map((wh) =>
    typeof wh === "string" ? { id: wh, label: wh } : { id: wh.id, label: wh.label || wh.id }
  );
}

function renderWarehouses() {
  els.warehouseList.innerHTML = "";
  for (const wh of normalizeWarehouses()) {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${wh.id}" data-label="${wh.label}"> ${wh.label} (${wh.id})`;
    els.warehouseList.appendChild(label);
  }
}

function renderItems(filterText = "") {
  const filtered = (config.items || []).filter((item) => {
    const hay = `${item.name} ${item.sku}`.toLowerCase();
    return hay.includes(filterText.toLowerCase());
  });
  els.itemList.innerHTML = "";
  for (const item of filtered) {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${item.sku}" data-name="${item.name}"> ${item.name} (${item.sku})`;
    els.itemList.appendChild(label);
  }
}

function getChecked(container) {
  return Array.from(container.querySelectorAll("input:checked"));
}

async function checkOne(sku, warehouseId) {
  const proxyBase = els.proxyUrl.value.trim();
  const params = `quantity=1&selectedWarehouse=${encodeURIComponent(warehouseId)}&shippingCodes=UP2&action=EDD`;

  let url;
  let fetchOpts = {};
  if (proxyBase) {
    url = `${proxyBase.replace(/\/$/, "")}?itemId=${encodeURIComponent(sku)}&warehouse=${encodeURIComponent(warehouseId)}&quantity=1&shippingCodes=UP2&action=EDD`;
  } else {
    // Direct call. The browser sets Origin/Referer/User-Agent itself, and we
    // can't spoof those -- if Costco's server rejects/blocks the cross-origin
    // request, this will fail with a CORS error in the browser console. If
    // that happens, set a proxy URL in Settings and nothing else changes.
    url = `${COSTCO_BASE}/${encodeURIComponent(sku)}?${params}`;
    fetchOpts = {
      headers: {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.8",
      },
    };
  }

  try {
    const resp = await fetch(url, fetchOpts);
    const status = resp.status;
    let inStock = null;
    try {
      const data = await resp.json();
      const avail = data.warehouseAvailability || {};
      inStock = status === 200 && Object.values(avail).some((v) => v && v.availability === "INSTOCK");
    } catch (_) {
      // non-JSON / unparsable body
    }
    return { status, inStock };
  } catch (err) {
    return { status: null, inStock: null, networkError: String(err) };
  }
}

function addResultRow(itemName, warehouseLabel) {
  const row = document.createElement("tr");
  row.innerHTML = `<td>${itemName}</td><td>${warehouseLabel}</td><td class="status-cell">Checking...</td>`;
  els.resultsBody.appendChild(row);
  return row;
}

function updateResultRow(row, result) {
  const cell = row.querySelector(".status-cell");
  if (result.networkError) {
    cell.innerHTML = `<span class="tag error" title="${result.networkError}">Network/CORS error</span>`;
  } else if (result.status === 403) {
    cell.innerHTML = `<span class="tag error">Blocked (403)</span>`;
  } else if (result.status !== 200) {
    cell.innerHTML = `<span class="tag error">HTTP ${result.status}</span>`;
  } else if (result.inStock) {
    cell.innerHTML = `<span class="tag instock">IN STOCK</span>`;
  } else {
    cell.innerHTML = `<span class="tag outstock">Out of stock</span>`;
  }
}

async function runCheck() {
  const warehouses = getChecked(els.warehouseList);
  const items = getChecked(els.itemList);
  if (warehouses.length === 0 || items.length === 0) {
    setStatus("Select at least one warehouse and one item.", true);
    return;
  }

  els.checkBtn.disabled = true;
  els.resultsBody.innerHTML = "";
  els.resultsTable.hidden = false;

  const pairs = [];
  for (const item of items) {
    for (const wh of warehouses) {
      pairs.push({
        sku: item.value,
        itemName: item.dataset.name,
        warehouseId: wh.value,
        warehouseLabel: wh.dataset.label,
      });
    }
  }

  let done = 0;
  for (const pair of pairs) {
    els.progress.textContent = `Checking ${done + 1}/${pairs.length}...`;
    const row = addResultRow(pair.itemName, pair.warehouseLabel);
    const result = await checkOne(pair.sku, pair.warehouseId);
    updateResultRow(row, result);
    done++;
    // small delay between requests, same courtesy as the scheduled script
    await new Promise((r) => setTimeout(r, 400));
  }

  els.progress.textContent = `Done — checked ${pairs.length} combination(s).`;
  els.checkBtn.disabled = false;
}

els.saveSettings.addEventListener("click", () => {
  saveSettings();
  loadConfig();
});
els.itemFilter.addEventListener("input", (e) => renderItems(e.target.value));
els.checkBtn.addEventListener("click", runCheck);

loadSettings();
if (els.configUrl.value) {
  loadConfig();
} else {
  els.settings.open = true;
}
