/* ============================================================
   STORAGE
============================================================ */

const STORAGE_KEY = "totalLine_inspection_v1";

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : { job: {}, statuses: {}, notes: {} };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

let appState = loadState();

/* ============================================================
   JOB INFO
============================================================ */

const jobFields = [
  "custName", "custStreet", "custCity", "custZip",
  "custPhone", "custEmail",
  "techName", "techPhone", "techEmail"
];

function loadJobInfo() {
  jobFields.forEach(id => {
    const el = document.getElementById(id);
    if (el && appState.job[id] !== undefined) {
      el.value = appState.job[id];
    }
  });
}

function bindJobInfo() {
  jobFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      appState.job[id] = el.value;
      saveState();
    });
  });
}

/* ============================================================
   SIGNATURES
============================================================ */

function initSignaturePads() {
  ["sigTech", "sigCust"].forEach(id => {
    const canvas = document.getElementById(id);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
      const ratio = window.devicePixelRatio || 1;

      const needScale =
        canvas.width !== canvas.offsetWidth * ratio ||
        canvas.height !== canvas.offsetHeight * ratio;

      if (!needScale) return;

      const old = ctx.getImageData(0, 0, canvas.width, canvas.height);

      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);

      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.imageSmoothingEnabled = false;

      ctx.putImageData(old, 0, 0);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let drawing = false;

    canvas.addEventListener("pointerdown", e => {
      drawing = true;
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
    });

    canvas.addEventListener("pointermove", e => {
      if (!drawing) return;
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    });

    canvas.addEventListener("pointerup", () => drawing = false);
    canvas.addEventListener("pointerleave", () => drawing = false);
  });

  document.querySelectorAll("[data-clear]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-clear");
      const canvas = document.getElementById(id);
      if (!canvas) return;
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    });
  });
}

/* ============================================================
   CURRENCY HELPERS
============================================================ */

function formatCurrency(value) {
  if (!value) return "";
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function parseCurrency(value) {
  if (!value) return 0;
  return parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;
}

/* ============================================================
   QUOTE MATH
============================================================ */

function updateExtended(row) {
  const qty = parseFloat(row.querySelector(".item-qty").value) || 0;
  const unit = parseCurrency(row.querySelector(".item-unit").value);
  row.querySelector(".item-ext").value = formatCurrency(qty * unit);
}

function updateGrandTotal() {
  let total = 0;
  document.querySelectorAll(".item-ext").forEach(ext => {
    total += parseCurrency(ext.value);
  });
  document.getElementById("invoiceGrandTotal").textContent =
    total.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/* ============================================================
   PDF + EMAIL HELPERS
============================================================ */

function pdfOptions(filename) {
  return {
    margin: 10,
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
    jsPDF: { unit: "pt", format: "letter", orientation: "portrait" },
    pagebreak: { mode: ["css"] }
  };
}

function buildPdfName() {
  const phone = (document.getElementById("custPhone").value || "")
    .replace(/\D/g, "") || "no-phone";

  const name = (document.getElementById("custName").value || "no-name")
    .trim().replace(/\s+/g, "_");

  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${phone}_${name}_${yyyy}${mm}${dd}_invoice.pdf`;
}

function openPrefilledEmail(pdfName, to) {
  const cc = "a2zproservices@gmail.com";
  const subject = encodeURIComponent("Quote");
  const body = encodeURIComponent("Attached is your invoice.\n\n");

  window.location.href = `mailto:${to}?cc=${cc}&subject=${subject}&body=${body}`;

  const picker = document.getElementById("attachPicker");
  if (picker) setTimeout(() => picker.click(), 800);
}

/* ============================================================
   DOM READY
============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  loadJobInfo();
  bindJobInfo();
  initSignaturePads();

  /* CURRENT DATE ONLY */
const invoiceDateEl = document.getElementById("invoiceDate");
if (invoiceDateEl) {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  invoiceDateEl.textContent = `${mm}/${dd}/${yyyy}`;
}

  /* ITEM INPUT HANDLING */
  document.addEventListener("input", (e) => {
    const row = e.target.closest(".item-row");
    if (!row) return;

    if (e.target.classList.contains("item-qty") ||
        e.target.classList.contains("item-unit")) {
      updateExtended(row);
      updateGrandTotal();
    }
  });

  document.addEventListener("blur", (e) => {
    if (e.target.classList.contains("item-unit")) {
      e.target.value = formatCurrency(e.target.value);
      const row = e.target.closest(".item-row");
      updateExtended(row);
      updateGrandTotal();
    }
  }, true);

  /* ADD ITEM */
  document.getElementById("addItemBtn").addEventListener("click", () => {
    const list = document.getElementById("itemsList");

    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <textarea class="item-desc" placeholder="Item description..."></textarea>
      <input class="item-qty" type="number" min="1" value="1">
      <input class="item-unit" placeholder="Unit cost">
      <input class="item-ext" placeholder="Total" readonly>
      <button class="item-remove">×</button>
    `;

    list.appendChild(row);
  });

  /* REMOVE ITEM */
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("item-remove")) {
      e.target.closest(".item-row").remove();
      updateGrandTotal();
    }
  });

  /* PDF BUTTON */
  const pdfBtn = document.getElementById("pdfBtn");
  const actionsBar = document.querySelector(".actions");

  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      const pdfName = buildPdfName();
      const el = document.getElementById("pdfCaptureArea");

      actionsBar.classList.add("no-print");

      html2pdf()
        .set(pdfOptions(pdfName))
        .from(el)
        .save()
        .then(() => {
          actionsBar.classList.remove("no-print");
        });
    });
  }

  /* EMAIL BUTTON */
  const emailBtn = document.getElementById("emailBtn");
  if (emailBtn) {
    emailBtn.addEventListener("click", () => {
      const pdfName = buildPdfName();
      const to = document.getElementById("custEmail").value || "";
      const el = document.getElementById("pdfCaptureArea");

      actionsBar.classList.add("no-print");

      html2pdf()
        .set(pdfOptions(pdfName))
        .from(el)
        .outputPdf("blob")
        .then((blob) => {
          actionsBar.classList.remove("no-print");

          const url = URL.createObjectURL(blob);
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          iframe.src = url;
          document.body.appendChild(iframe);

          setTimeout(() => {
            const link = document.createElement("a");
            link.href = url;
            link.download = pdfName;
            link.click();

            setTimeout(() => {
              document.body.removeChild(iframe);
              URL.revokeObjectURL(url);
            }, 500);

            setTimeout(() => openPrefilledEmail(pdfName, to), 600);
          }, 200);
        });
    });
  }

  /* RESET BUTTON */
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }

});
