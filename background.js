// Clicking the toolbar icon opens (or focuses) the TileTV page.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('tiletv.html');
  const [existing] = await chrome.tabs.query({ url });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});

// The TileTV page adds a session rule (id = its tab id) that lets
// tv.youtube.com load inside its frames. Drop the rule when that tab closes or
// goes to another page, so nothing else loaded in the tab can frame YouTube TV.
const dropRule = (tabId) =>
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }).catch(() => {});

chrome.tabs.onRemoved.addListener(dropRule);
chrome.tabs.onUpdated.addListener((tabId, { url }) => {
  if (url && url.split(/[?#]/)[0] !== chrome.runtime.getURL('tiletv.html')) dropRule(tabId);
});
