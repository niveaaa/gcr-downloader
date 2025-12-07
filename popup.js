const scanBtn = document.getElementById("scanBtn");
const statusDiv = document.getElementById("status");
const linksContainer = document.getElementById("linksContainer");
const controlsDiv = document.getElementById("controls");
const selectAllCheckbox = document.getElementById("selectAll");
const downloadBtn = document.getElementById("downloadSelected");

let currentLinks = [];

// Scan button handler
scanBtn.addEventListener("click", async () => {
  statusDiv.textContent = "Scanning the page for Drive links...";
  linksContainer.innerHTML = "";
  controlsDiv.classList.add("hidden");
  selectAllCheckbox.checked = false;
  currentLinks = [];

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      statusDiv.textContent = "No active tab found. Open Google Classroom first.";
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // This code runs inside the page
        if (!location.href.startsWith("https://classroom.google.com")) {
          return { error: "NOT_CLASSROOM", links: [] };
        }

        const anchors = Array.from(document.querySelectorAll("a[href]"));
        const linksSet = new Set();

        anchors.forEach(a => {
          const href = a.href;
          if (
            href.includes("https://drive.google.com") ||
            href.includes("https://docs.google.com")
          ) {
            linksSet.add(href.split("#")[0]); // remove #fragment
          }
        });

        return { error: null, links: Array.from(linksSet) };
      }
    });

    const result = results[0]?.result || { error: "UNKNOWN", links: [] };

    if (result.error === "NOT_CLASSROOM") {
      statusDiv.textContent = "This tab is not a Google Classroom page.";
      return;
    }

    if (result.error) {
      statusDiv.textContent = "Could not scan this page.";
      console.error("Scan error:", result.error);
      return;
    }

    currentLinks = result.links;

    if (!currentLinks.length) {
      statusDiv.textContent = "No Drive links found on this page.";
      return;
    }

    statusDiv.textContent = `Found ${currentLinks.length} Drive link(s).`;
    renderLinks(currentLinks);
    controlsDiv.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    statusDiv.textContent =
      "Extension cannot run on this page. Check if it's a Classroom tab.";
  }
});

// Render links as a list with checkboxes
function renderLinks(links) {
  linksContainer.innerHTML = "";

  links.forEach((url, index) => {
    const item = document.createElement("div");
    item.className = "link-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = index;

    const span = document.createElement("span");
    span.className = "link-url";
    span.textContent = url;

    item.appendChild(checkbox);
    item.appendChild(span);
    linksContainer.appendChild(item);
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
  const selectedUrls = [];

  checkboxes.forEach(cb => {
    const idx = parseInt(cb.dataset.index, 10);
    if (cb.checked && currentLinks[idx]) {
      selectedUrls.push(currentLinks[idx]);
    }
  });

  if (!selectedUrls.length) {
    statusDiv.textContent = "Nothing selected. At least pick one.";
    return;
  }

  statusDiv.textContent = `Downloading ${selectedUrls.length} file(s)...`;

  selectedUrls.forEach(url => {
    chrome.downloads.download({ url }, downloadId => {
      if (chrome.runtime.lastError) {
        console.warn("Download error:", chrome.runtime.lastError.message);
      }
    });
  });
});
