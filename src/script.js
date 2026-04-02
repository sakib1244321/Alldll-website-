/**
 * All Platform Video Downloader — script.js
 * Pure JavaScript. No frameworks.
 *
 * KEY FIX: Download button uses blob method to force direct file
 * download instead of opening the video in a new browser tab.
 *
 * ─ To change the API endpoint, update API_URL below only. ─
 */

/* ================================================================
   CONFIG — change API URL here only, nothing else breaks
   ================================================================ */
const API_URL = "https://neoaz.is-a.dev/api/download?url=";

/* ================================================================
   Wait for DOM before touching anything
   ================================================================ */
document.addEventListener("DOMContentLoaded", function () {

  /* ── DOM refs ── */
  const input          = document.getElementById("video-url");
  const clearBtn       = document.getElementById("clear-btn");
  const urlError       = document.getElementById("url-error");
  const btnContinue    = document.getElementById("btn-continue");
  const btnLabel       = document.getElementById("btn-label");
  const btnArrow       = document.getElementById("btn-arrow");
  const rippleEl       = document.querySelector(".ripple-el");

  const previewSection = document.getElementById("preview-section");
  const stateLoading   = document.getElementById("state-loading");
  const stateError     = document.getElementById("state-error");
  const stateResult    = document.getElementById("state-result");

  const errorMsg       = document.getElementById("error-msg");
  const btnRetry       = document.getElementById("btn-retry");

  const videoTitle     = document.getElementById("video-title");
  const platformTag    = document.getElementById("platform-tag");
  const videoPlayer    = document.getElementById("video-player");
  const btnDownload    = document.getElementById("btn-download");
  const dlLabel        = document.getElementById("dl-label");

  /* Store the current video URL and safe filename for download */
  let currentVideoUrl  = "";
  let currentFilename  = "video.mp4";

  /* ================================================================
     HELPERS
     ================================================================ */

  /* Check if string is a valid http/https URL */
  function isValidUrl(str) {
    try {
      const u = new URL(str.trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  /* Detect social platform name from URL */
  function detectPlatform(url) {
    const u = url.toLowerCase();
    if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
    if (u.includes("instagram.com"))   return "Instagram";
    if (u.includes("tiktok.com"))      return "TikTok";
    if (u.includes("facebook.com") || u.includes("fb.watch")) return "Facebook";
    if (u.includes("twitter.com") || u.includes("x.com"))     return "Twitter / X";
    if (u.includes("vimeo.com"))       return "Vimeo";
    if (u.includes("dailymotion.com")) return "Dailymotion";
    return "Video";
  }

  /* Show / hide preview states */
  function showState(name) {
    stateLoading.classList.add("hidden");
    stateError.classList.add("hidden");
    stateResult.classList.add("hidden");
    previewSection.classList.add("hidden");

    if (name === "loading") {
      previewSection.classList.remove("hidden");
      stateLoading.classList.remove("hidden");
    } else if (name === "error") {
      previewSection.classList.remove("hidden");
      stateError.classList.remove("hidden");
    } else if (name === "result") {
      previewSection.classList.remove("hidden");
      stateResult.classList.remove("hidden");
    }

    if (name !== "none") {
      setTimeout(function () {
        previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  }

  /* Set Continue button into loading / idle state */
  function setButtonLoading(on) {
    if (on) {
      btnLabel.textContent = "Loading...";
      btnArrow.classList.add("hidden");
      btnContinue.disabled = true;
    } else {
      btnLabel.textContent = "Continue";
      btnArrow.classList.remove("hidden");
      btnContinue.disabled = !isValidUrl(input.value.trim());
    }
  }

  /* Ripple effect on Continue button */
  function fireRipple(e) {
    if (!rippleEl) return;
    const rect = btnContinue.getBoundingClientRect();
    rippleEl.style.left = (e.clientX - rect.left) + "px";
    rippleEl.style.top  = (e.clientY - rect.top)  + "px";
    rippleEl.classList.remove("go");
    void rippleEl.offsetWidth; // restart animation
    rippleEl.classList.add("go");
  }

  /* Show / hide inline URL validation error */
  function showUrlError(msg) {
    urlError.textContent = msg;
    urlError.classList.remove("hidden");
  }
  function hideUrlError() {
    urlError.textContent = "";
    urlError.classList.add("hidden");
  }

  /* Reset download button back to normal state */
  function resetDownloadBtn() {
    dlLabel.textContent = "Download Video";
    btnDownload.disabled = false;
    btnDownload.classList.remove("downloading");
  }

  /* ================================================================
     INPUT EVENTS — enable/disable Continue button on every keystroke
     ================================================================ */
  function onInputChange() {
    const val = input.value.trim();
    hideUrlError();

    if (val.length > 0) {
      clearBtn.classList.remove("hidden");
      btnContinue.disabled = !isValidUrl(val);
    } else {
      clearBtn.classList.add("hidden");
      btnContinue.disabled = true;
    }
  }

  input.addEventListener("input", onInputChange);

  /* Paste fires before "input" updates value — delay by one tick */
  input.addEventListener("paste", function () {
    setTimeout(onInputChange, 0);
  });

  /* Enter key triggers Continue */
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !btnContinue.disabled) {
      btnContinue.click();
    }
  });

  /* ================================================================
     CLEAR BUTTON
     ================================================================ */
  clearBtn.addEventListener("click", function () {
    input.value = "";
    clearBtn.classList.add("hidden");
    btnContinue.disabled = true;
    hideUrlError();
    showState("none");
    videoPlayer.pause();
    videoPlayer.src = "";
    currentVideoUrl = "";
    currentFilename = "video.mp4";
    resetDownloadBtn();
    input.focus();
  });

  /* ================================================================
     CONTINUE BUTTON CLICK → fetch video info
     ================================================================ */
  btnContinue.addEventListener("click", function (e) {
    const url = input.value.trim();

    if (!isValidUrl(url)) {
      showUrlError("Please enter a valid URL (must start with http:// or https://).");
      return;
    }

    fireRipple(e);
    fetchVideo(url);
  });

  /* ================================================================
     RETRY BUTTON
     ================================================================ */
  btnRetry.addEventListener("click", function () {
    const url = input.value.trim();
    if (isValidUrl(url)) {
      fetchVideo(url);
    } else {
      showState("none");
    }
  });

  /* ================================================================
     CORE: FETCH VIDEO INFO FROM API
     ================================================================ */
  async function fetchVideo(url) {
    showState("loading");
    setButtonLoading(true);
    resetDownloadBtn();

    try {
      const endpoint = API_URL + encodeURIComponent(url);

      const response = await fetch(endpoint, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        throw new Error("API returned " + response.status + ": " + response.statusText);
      }

      const data = await response.json();

      /* Parse video URL */
      const videoUrl =
        (data.video && (data.video.directUrl || data.video.downloadUrl)) ||
        data.directUrl ||
        data.url ||
        null;

      /* Parse title */
      const title =
        (data.info && data.info.title) ||
        data.title ||
        "Untitled Video";

      if (!videoUrl) {
        throw new Error("No downloadable video URL found in the API response.");
      }

      renderResult(videoUrl, title, url);

    } catch (err) {
      let msg = "Unable to fetch the video. Please check the link and try again.";

      if (err.name === "TimeoutError" || err.name === "AbortError") {
        msg = "Request timed out. The API may be slow — please try again.";
      } else if (err.message && err.message.length < 140) {
        msg = err.message;
      }

      errorMsg.textContent = msg;
      showState("error");
      console.error("[VidDown] Fetch error:", err);

    } finally {
      setButtonLoading(false);
    }
  }

  /* ================================================================
     RENDER RESULT: video player + title + download button
     ================================================================ */
  function renderResult(videoUrl, title, originalUrl) {
    /* Store globally so download button can access them */
    currentVideoUrl = videoUrl;

    /* Safe filename from title */
    currentFilename = (title
      .replace(/[^a-zA-Z0-9 \-_]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .substring(0, 60) || "video") + ".mp4";

    /* Title + platform badge */
    videoTitle.textContent  = title;
    platformTag.textContent = detectPlatform(originalUrl);

    /* Video preview */
    videoPlayer.src = videoUrl;
    videoPlayer.load();

    showState("result");
  }

  /* ================================================================
     DOWNLOAD BUTTON — blob method for DIRECT file download
     (prevents browser from opening the video in a new tab)
     ================================================================ */
  btnDownload.addEventListener("click", async function () {
    if (!currentVideoUrl) return;

    /* Show downloading state */
    dlLabel.textContent  = "Downloading...";
    btnDownload.disabled = true;
    btnDownload.classList.add("downloading");

    try {
      /*
       * Step 1: Fetch the video file as a binary blob.
       * This is what forces the file to download instead of streaming.
       */
      const response = await fetch(currentVideoUrl, {
        signal: AbortSignal.timeout(60000), // 60s for large files
      });

      if (!response.ok) {
        throw new Error("Could not download the file (HTTP " + response.status + ").");
      }

      const blob = await response.blob();

      /*
       * Step 2: Create a temporary object URL from the blob and
       * programmatically click a hidden <a download> link.
       */
      const objectUrl = URL.createObjectURL(blob);
      const tempLink  = document.createElement("a");

      tempLink.href     = objectUrl;
      tempLink.download = currentFilename; // forces download with correct filename
      tempLink.style.display = "none";

      document.body.appendChild(tempLink);
      tempLink.click();                    // trigger the download
      document.body.removeChild(tempLink);

      /* Step 3: Release memory */
      setTimeout(function () {
        URL.revokeObjectURL(objectUrl);
      }, 5000);

      dlLabel.textContent = "Downloaded ✓";

      /* Reset button after 3 seconds */
      setTimeout(resetDownloadBtn, 3000);

    } catch (err) {
      /*
       * If blob fetch fails (e.g. CORS), fall back to opening the URL
       * in a new tab so the user can at least long-press to save on mobile.
       */
      console.warn("[VidDown] Blob download failed, falling back to new tab:", err);
      window.open(currentVideoUrl, "_blank", "noopener,noreferrer");
      dlLabel.textContent = "Opened in tab ↗";
      setTimeout(resetDownloadBtn, 3000);
    }
  });

}); // end DOMContentLoaded
