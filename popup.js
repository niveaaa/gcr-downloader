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
          const href = a.href;
          if (
            href.includes("https://drive.google.com") ||
            href.includes("https://docs.google.com")
          ) {
            const url = href.split("#")[0]; // strip fragment
            if (seen.has(url)) return;
            seen.add(url);
        
            // Try to get a nice title
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
      statusDiv.textContent = "No Drive links found on this page.";
      return;
    }
    
    statusDiv.textContent = `Found ${currentItems.length} Drive file(s).`;
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

  items.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "link-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = index;

    const span = document.createElement("span");
    span.className = "link-url";
    span.textContent = item.title;        // show title
    span.title = item.url;                // show URL on hover

    div.appendChild(checkbox);
    div.appendChild(span);
    linksContainer.appendChild(div);
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

