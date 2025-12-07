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

    chrome.tabs.sendMessage(
      tab.id,
      { type: "GET_DRIVE_LINKS" },
      (response) => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent =
            "Could not access the page. Is this a Google Classroom tab?";
          return;
        }

        if (!response || !response.links) {
          statusDiv.textContent = "No links found or content script not loaded.";
          return;
        }

        currentLinks = response.links;
        if (currentLinks.length === 0) {
          statusDiv.textContent = "No Drive links found on this page.";
          return;
        }

        statusDiv.textContent = `Found ${currentLinks.length} Drive link(s).`;
        renderLinks(currentLinks);
        controlsDiv.classList.remove("hidden");
      }
    );
  } catch (err) {
    console.error(err);
    statusDiv.textContent = "Error while scanning. Check console for details.";
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

  if (selectedUrls.length === 0) {
    statusDiv.textContent = "Nothing selected. At least pretend to choose one.";
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
