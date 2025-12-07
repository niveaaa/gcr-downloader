// Extract all Google Drive / Docs links from the current page
function getDriveLinks() {
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const links = new Set();

  anchors.forEach(a => {
    const href = a.href;
    if (
      href.includes("https://drive.google.com") ||
      href.includes("https://docs.google.com")
    ) {
      links.add(href.split("#")[0]); // remove fragments
    }
  });

  return Array.from(links);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "GET_DRIVE_LINKS") {
    const links = getDriveLinks();
    sendResponse({ links });
  }

  // Return true if we want to send async response (not needed here)
  return false;
});
