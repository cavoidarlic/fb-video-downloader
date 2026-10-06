(function () {
  // Inject the script into the main DOM world
  const scriptEl = document.createElement("script");
  scriptEl.src = chrome.runtime.getURL("injected.js");
  (document.head || document.documentElement).appendChild(scriptEl);
  scriptEl.onload = () => scriptEl.remove();

  const pendingRequests = new Map();

  window.addEventListener("FB_EXT_FETCH_RESULT", (event) => {
    const { reqId, success, downloadUrl, error } = event.detail;
    if (pendingRequests.has(reqId)) {
      const callback = pendingRequests.get(reqId);
      pendingRequests.delete(reqId);
      callback(success, downloadUrl, error);
    }
  });

  function extractVideoId(element) {
    const parentContainer = element.closest('div[role="feed"] > div, div[data-pagelet], [data-virtualized="false"]') || element.parentElement;
    if (!parentContainer) return null;

    const links = Array.from(parentContainer.querySelectorAll('a[href*="/videos/"], a[href*="/reel/"], a[href*="watch?v="]'));
    
    // Add current page URL as potential fallback
    const urls = links.map((l) => l.href).concat([window.location.href]);

    for (const url of urls) {
      const match = url.match(/\/(?:videos|reel|watch)(?:\/?)(?:\?v=)?(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  function handleDownloadClick(btn, videoEl) {
    const videoId = extractVideoId(videoEl);

    // Fallback: If video is directly embedded without an ID or standard format
    if (!videoId) {
      if (videoEl.src && !videoEl.src.startsWith("blob:")) {
        chrome.runtime.sendMessage({
          action: "download_video",
          url: videoEl.src,
          filename: `facebook_video_${Date.now()}.mp4`
        });
        return;
      }
      btn.innerText = "ID Not Found";
      btn.classList.add("fb-dl-error");
      setTimeout(() => {
        btn.innerText = "Download";
        btn.classList.remove("fb-dl-error");
      }, 2000);
      return;
    }

    btn.innerText = "Fetching...";
    btn.classList.add("fb-dl-loading");

    const reqId = "req_" + Math.random().toString(36).substr(2, 9);
    pendingRequests.set(reqId, (success, downloadUrl) => {
      btn.classList.remove("fb-dl-loading");
      if (success && downloadUrl) {
        btn.innerText = "Downloading...";
        chrome.runtime.sendMessage(
          {
            action: "download_video",
            url: downloadUrl,
            filename: `facebook_${videoId}.mp4`
          },
          (res) => {
            if (res && res.success) {
              btn.innerText = "Done!";
              setTimeout(() => {
                btn.innerText = "Download";
              }, 2500);
            } else {
              window.open(downloadUrl, "_blank");
              btn.innerText = "Opened";
              setTimeout(() => {
                btn.innerText = "Download";
              }, 2000);
            }
          }
        );
      } else {
        // Direct media fallback if GraphQL doc_id fails
        if (videoEl.src && !videoEl.src.startsWith("blob:")) {
          chrome.runtime.sendMessage({
            action: "download_video",
            url: videoEl.src,
            filename: `facebook_${videoId}.mp4`
          });
          btn.innerText = "Done!";
        } else {
          btn.innerText = "Failed";
          btn.classList.add("fb-dl-error");
        }
        setTimeout(() => {
          btn.innerText = "Download";
          btn.classList.remove("fb-dl-error");
        }, 2500);
      }
    });

    window.dispatchEvent(
      new CustomEvent("FB_EXT_FETCH_VIDEO", {
        detail: { videoId: videoId, reqId: reqId }
      })
    );
  }

  function injectButtonToVideo(videoEl) {
    if (videoEl.dataset.fbDlAttached) return;
    videoEl.dataset.fbDlAttached = "true";

    // Locate the visible relative container
    let container = videoEl.parentElement;
    while (
      container &&
      container !== document.body &&
      window.getComputedStyle(container).position === "static"
    ) {
      container = container.parentElement;
    }
    if (!container || container === document.body) {
      container = videoEl.parentElement;
      if (container) {
        container.style.position = "relative";
      }
    }

    if (!container || container.querySelector(".fb-dl-btn-container")) return;

    const btnWrapper = document.createElement("div");
    btnWrapper.className = "fb-dl-btn-container";

    const dlBtn = document.createElement("button");
    dlBtn.className = "fb-dl-btn";
    dlBtn.innerText = "Download";

    dlBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleDownloadClick(dlBtn, videoEl);
    });

    btnWrapper.appendChild(dlBtn);
    container.appendChild(btnWrapper);
  }

  function scanForVideos() {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      if (video.offsetWidth > 100 && video.offsetHeight > 100) {
        injectButtonToVideo(video);
      }
    });
  }

  const observer = new MutationObserver(() => {
    scanForVideos();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  scanForVideos();
})();