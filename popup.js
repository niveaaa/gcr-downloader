function convertToDirectDownload(url) {
  // 1. Direct Drive file link: https://drive.google.com/file/d/ID/view
  let fileIdMatch = url.match(/\/file\/d\/([^/]+)\//);
  if (fileIdMatch) {
    const fileId = fileIdMatch[1];
    return `https://drive.usercontent.google.com/u/1/uc?id=${fileId}&export=download`;
  }

  // 2. Legacy ?id= format
  let idParam = url.match(/[?&]id=([^&]+)/);
  if (idParam) {
    const fileId = idParam[1];
    return `https://drive.usercontent.google.com/u/1/uc?id=${fileId}&export=download`;
  }

  // 3. Docs, Sheets, Slides links (export as PDF)
  let docMatch = url.match(/\/document\/d\/([^/]+)/);
  if (docMatch) {
    const fileId = docMatch[1];
    return `https://docs.google.com/document/d/${fileId}/export?format=pdf`;
  }

  let sheetMatch = url.match(/\/spreadsheets\/d\/([^/]+)/);
  if (sheetMatch) {
    const fileId = sheetMatch[1];
    return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
  }

  let slidesMatch = url.match(/\/presentation\/d\/([^/]+)/);
  if (slidesMatch) {
    const fileId = slidesMatch[1];
    return `https://docs.google.com/presentation/d/${fileId}/export/pdf`;
  }

  // If unknown type, fallback to original URL
  return url;
}

function getFileTypeLabel(title) {
  const lower = (title || "").toLowerCase();

  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "PPT";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "DOC";
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "XLS";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "JPG";
  if (lower.endsWith(".png")) return "PNG";

  return "FILE";
}

const fileCountSpan = document.getElementById("fileCount");

const scanBtn = document.getElementById("scanBtn");
const statusDiv = document.getElementById("status");
const linksContainer = document.getElementById("linksContainer");
const controlsDiv = document.getElementById("controls");
const selectAllCheckbox = document.getElementById("selectAll");
const downloadBtn = document.getElementById("downloadSelected");

let currentItems = [];

// Scan button handler
scanBtn.addEventListener("click", async () => {
  statusDiv.textContent = "Scanning the page for Drive links...";
  linksContainer.innerHTML = "";
  controlsDiv.classList.add("hidden");
  selectAllCheckbox.checked = false;
  currentItems = [];

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      statusDiv.textContent = "No active tab found. Open Google Classroom first.";
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // This code runs inside the Classroom page
        if (!location.href.startsWith("https://classroom.google.com")) {
          return { error: "NOT_CLASSROOM", items: [] };
        }
    
        const anchors = Array.from(document.querySelectorAll("a[href]"));
        const items = [];
        const seen = new Set();
    
        anchors.forEach(a => {
        // Skip useless menu items
        if (a.getAttribute("role") === "menuitem") return;

        const href = a.href;

        if (
            href.includes("https://drive.google.com") ||
            href.includes("https://docs.google.com")
        ) {
            const url = href.split("#")[0];

            if (seen.has(url)) return;
            seen.add(url);

            const text = (a.innerText || "").trim();
            const aria = (a.getAttribute("aria-label") || "").trim();
            const title = text || aria || url;

            items.push({ url, title });
        }
        });
    
        return { error: null, items };
      }
    });

    const result = results[0]?.result || { error: "UNKNOWN", items: [] };

    if (result.error === "NOT_CLASSROOM") {
      statusDiv.textContent = "This tab is not a Google Classroom page.";
      return;
    }
    
    if (result.error) {
      statusDiv.textContent = "Could not scan this page.";
      console.error("Scan error:", result.error);
      return;
    }

    currentItems = result.items;

    if (!currentItems.length) {
        statusDiv.textContent = "No Drive files found on this Classroom page.";
        renderLinks(currentItems);
        controlsDiv.classList.add("hidden");
        return;
    }
    
    statusDiv.textContent = `Found ${currentItems.length} file(s). You can uncheck any you don't want.`;
    renderLinks(currentItems);
    controlsDiv.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    statusDiv.textContent =
      "Extension cannot run on this page. Check if it's a Classroom tab.";
  }
});

// Render links as a list with checkboxes
function renderLinks(items) {
  linksContainer.innerHTML = "";

  if (!items.length) {
    linksContainer.classList.add("empty-state");
    linksContainer.innerHTML = `
      <div class="empty-message">
        No files found on this page.
      </div>
    `;
    fileCountSpan.textContent = "0";
    return;
  }

  linksContainer.classList.remove("empty-state");
  fileCountSpan.textContent = String(items.length);

  items.forEach((item, index) => {
    const { url, title } = item;
    const typeLabel = getFileTypeLabel(title || url);

    const wrapper = document.createElement("div");
    wrapper.className = "link-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "link-checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = index;

    const main = document.createElement("div");
    main.className = "link-main";

    const titleRow = document.createElement("div");
    titleRow.className = "link-title-row";

    const titleSpan = document.createElement("span");
    titleSpan.className = "file-title";
    titleSpan.textContent = title || url;
    titleSpan.title = url; // show URL on hover

    const typePill = document.createElement("span");
    typePill.className = "file-type-pill";
    typePill.textContent = typeLabel;

    titleRow.appendChild(titleSpan);
    titleRow.appendChild(typePill);

    const meta = document.createElement("div");
    meta.className = "file-meta";
    meta.textContent = new URL(url).hostname.replace("www.", "");

    main.appendChild(titleRow);
    main.appendChild(meta);

    wrapper.appendChild(checkbox);
    wrapper.appendChild(main);
    linksContainer.appendChild(wrapper);
  });
}

// Select all toggle
selectAllCheckbox.addEventListener("change", () => {
  const checkboxes = linksContainer.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = selectAllCheckbox.checked;
  });
});

// Download selected
downloadBtn.addEventListener("click", () => {
  const checkboxes = linksContainer.querySelectorAll('input[type="checkbox"]');
  const selectedItems = [];

  checkboxes.forEach(cb => {
    const idx = parseInt(cb.dataset.index, 10);
    if (cb.checked && currentItems[idx]) {
      selectedItems.push(currentItems[idx]);
    }
  });

  if (!selectedItems.length) {
    statusDiv.textContent = "Nothing selected.";
    return;
  }

  statusDiv.textContent = `Downloading ${selectedItems.length} file(s)...`;

  selectedItems.forEach(item => {
    const directUrl = convertToDirectDownload(item.url);

    chrome.downloads.download({ url: directUrl }, downloadId => {
      if (chrome.runtime.lastError) {
        console.warn("Download error:", chrome.runtime.lastError.message);
      }
    });
  });
});

