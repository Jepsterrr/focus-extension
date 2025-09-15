// Denna funktion körs när background.ts har bestämt att sidan är irrelevant.
(async () => {
  // Förhindra att overlayen visas flera gånger
  if (document.getElementById("fokusflode-overlay")) {
    return;
  }

  // Hämta den aktiva uppgiften för att kunna visa den i meddelandet
  const { activeTask } = await chrome.storage.local.get("activeTask");

  // Skapa overlay-elementet
  const overlay = document.createElement("div");
  overlay.id = "fokusflode-overlay";
  // Använd inline-stilar eftersom vi inte kan ladda en separat CSS-fil här enkelt
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  overlay.style.zIndex = "2147483647";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.fontFamily = "system-ui, sans-serif";

  // Skapa dialogrutan
  const dialog = document.createElement("div");
  dialog.style.backgroundColor = "#2c2c2c";
  dialog.style.color = "white";
  dialog.style.padding = "30px";
  dialog.style.borderRadius = "12px";
  dialog.style.textAlign = "center";
  dialog.style.maxWidth = "400px";
  dialog.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.5)";

  // Skapa och lägg till innehållet
  dialog.innerHTML = `
    <h2 style="margin-top: 0; font-weight: 600; color: white;">Distraktion upptäckt</h2>
    <p style="opacity: 0.9; color: white;">Är den här sidan verkligen relevant för din uppgift:</p>
    <p style="background-color: rgba(255,255,255,0.1); padding: 8px; border-radius: 6px; font-weight: 500; color: white;">${
      activeTask || "Ingen uppgift"
    }</p>
    <div style="margin-top: 25px; display: flex; flex-direction: column; gap: 10px;">
        <button id="ff-snooze" class="ff-button">Ta en paus (10 min)</button>
        <button id="ff-allow" class="ff-button">Ja, tillåt denna webbplats</button>
        <button id="ff-goback" class="ff-button" style="background-color: #3498db;">Nej, tillbaka till arbetet</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Lägg till stilar för knapparna i en <style>-tagg för att hantera hover-effekter
  const style = document.createElement("style");
  style.id = "fokusflode-style";
  style.textContent = `
    .ff-button {
      background-color: #444;
      color: white;
      border: none;
      padding: 12px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    .ff-button:hover {
      background-color: #555;
    }
    #ff-goback:hover {
        background-color: #2980b9 !important;
    }
  `;
  document.head.appendChild(style);

  // Snooza
  document.getElementById("ff-snooze")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "SNOOZE",
      payload: { durationMinutes: 10 },
    });
    // Ta bort overlayen direkt för en smidig upplevelse
    overlay.remove();
    style.remove();
  });

  document.getElementById("ff-allow")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "WHITELIST_DOMAIN",
      payload: { domain: window.location.hostname },
    });
    overlay.remove();
    style.remove();
  });

  document.getElementById("ff-goback")?.addEventListener("click", () => {
    history.back();
  });

  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.type === "CLOSE_OVERLAY") {
      const overlay = document.getElementById("fokusflode-overlay");
      const style = document.getElementById("fokusflode-style");

      if (overlay) {
        overlay.remove();
      }
      if (style) {
        style.remove();
      }
    }
  });
})();
