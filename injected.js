(function () {
  function serializeParams(obj, prefix) {
    const queryParts = [];
    for (let prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        const key = prefix ? prefix + "[" + prop + "]" : prop;
        const value = obj[prop];
        queryParts.push(
          value !== null && typeof value === "object"
            ? serializeParams(value, key)
            : encodeURIComponent(key) + "=" + encodeURIComponent(value)
        );
      }
    }
    return queryParts.join("&");
  }

  function getDtsgToken() {
    try {
      if (typeof window.require === "function") {
        const dtsg = window.require("DTSGInitialData");
        if (dtsg && dtsg.token) return dtsg.token;
      }
    } catch (e) {}

    const match = document.documentElement.innerHTML.match(/["']DTSGInitialData["'],\[\],\{["']token["']:["']([^"']+)["']/);
    if (match && match[1]) return match[1];

    const inputMatch = document.querySelector('input[name="fb_dtsg"]');
    if (inputMatch) return inputMatch.value;

    return null;
  }

  window.addEventListener("FB_EXT_FETCH_VIDEO", function (event) {
    const videoId = event.detail.videoId;
    const reqId = event.detail.reqId;
    const token = getDtsgToken();

    if (!token) {
      window.dispatchEvent(
        new CustomEvent("FB_EXT_FETCH_RESULT", {
          detail: { reqId: reqId, success: false, error: "Missing fb_dtsg token" }
        })
      );
      return;
    }

    const payload = {
      doc_id: "5279476072161634",
      variables: JSON.stringify({
        UFI2CommentsProvider_commentsKey: "CometTahoeSidePaneQuery",
        caller: "CHANNEL_VIEW_FROM_PAGE_TIMELINE",
        displayCommentsContextEnableComment: null,
        displayCommentsContextIsAdPreview: null,
        displayCommentsContextIsAggregatedShare: null,
        displayCommentsContextIsStorySet: null,
        displayCommentsFeedbackContext: null,
        feedbackSource: 41,
        feedLocation: "TAHOE",
        focusCommentID: null,
        privacySelectorRenderLocation: "COMET_STREAM",
        renderLocation: "video_channel",
        scale: 1,
        streamChainingSection: false,
        useDefaultActor: false,
        videoChainingContext: null,
        videoID: videoId
      }),
      fb_dtsg: token,
      server_timestamps: true
    };

    fetch("https://www.facebook.com/api/graphql/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: serializeParams(payload)
    })
      .then((res) => res.text())
      .then((text) => {
        try {
          const json = JSON.parse(text.split("\n")[0]);
          const url =
            json.data?.video?.playable_url_quality_hd ||
            json.data?.video?.playable_url;

          if (url) {
            window.dispatchEvent(
              new CustomEvent("FB_EXT_FETCH_RESULT", {
                detail: { reqId: reqId, success: true, downloadUrl: url }
              })
            );
          } else {
            window.dispatchEvent(
              new CustomEvent("FB_EXT_FETCH_RESULT", {
                detail: { reqId: reqId, success: false, error: "No playable URL found in response" }
              })
            );
          }
        } catch (err) {
          window.dispatchEvent(
            new CustomEvent("FB_EXT_FETCH_RESULT", {
              detail: { reqId: reqId, success: false, error: "Parse error" }
            })
          );
        }
      })
      .catch((err) => {
        window.dispatchEvent(
          new CustomEvent("FB_EXT_FETCH_RESULT", {
            detail: { reqId: reqId, success: false, error: err.toString() }
          })
        );
      });
  });
})();