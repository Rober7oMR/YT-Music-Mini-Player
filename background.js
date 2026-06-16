chrome.action.onClicked.addListener((tab) => {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "panel", // Intentará abrirlo como panel si el sistema lo permite
    width: 260,
    height: 385,
    focused: true
  });
});