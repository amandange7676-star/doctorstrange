/* ==========================================================
   Dynamic Image Editor (handles <img> and background-image)
   Works with dynamically loaded header/footer content
   ========================================================== */

(function () {
  // ========== CONFIG ==========
  const token = localStorage.getItem('feature_key'); 
      const repoOwner = localStorage.getItem('owner');
      const repoName = localStorage.getItem('repo_name');
      let commitMessage = "Update test via API";

      const branch = "main"; 
  // Shared file input
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  let currentEl = null;

  // ========== Utilities ==========
  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function extractRepoPath(src) {
    if (!src) return null;
    try {
      if (src.startsWith("data:")) return null;
      const url = new URL(src, window.location.origin);
      const path = url.pathname;

      const idx = path.indexOf("/assets/images/");
      if (idx !== -1) return "public" + path.slice(idx);

      const altIdx = path.indexOf("/images/");
      if (altIdx !== -1) return "public" + path.slice(altIdx);
    } catch (err) {
      console.warn("extractRepoPath failed:", err);
    }
    return null;
  }

  async function getLatestSha(filePath) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json"
          }
        }
      );
      if (res.ok) {
        const data = await res.json();
        return data.sha;
      }
    } catch {
      console.warn("SHA not found, creating new file...");
    }
    return null;
  }

  async function uploadToGitHub(repoPath, base64, sha) {
    const payload = {
      message: `Update ${repoPath}`,
      content: base64.split(",")[1],
      branch
    };
    if (sha) payload.sha = sha;

    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${repoPath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    return res.json();
  }

  // ========== Core: Mark Editable Images ==========
  function markEditableImages(root = document) {
    if (!root.querySelectorAll) return;

    // Handle <img> elements
    root.querySelectorAll("img").forEach(img => {
      if (img.dataset.editableDone) return;
      img.dataset.editableDone = "1";
      img.classList.add("editable-image");
      img.style.cursor = "pointer";
      img.addEventListener("click", onClickEditable);
    });

    // Handle elements with background-image
    root.querySelectorAll("*").forEach(el => {
      if (el.dataset.editableBgDone) return;
      const bg = getComputedStyle(el).backgroundImage;
      const match = bg && bg.match(/url\(["']?(.*?)["']?\)/);
      if (match && match[1]) {
        el.dataset.editableBgDone = "1";
        el.classList.add("editable-image");
        el.style.cursor = "pointer";
        el.addEventListener("click", onClickEditable);
      }
    });
  }

  // ========== Click handler ==========
  function onClickEditable(e) {
    e.preventDefault();
    e.stopPropagation();
    currentEl = e.currentTarget;
    fileInput.value = "";
    fileInput.click();
  }

  // ========== File selection ==========
  fileInput.addEventListener("change", async function () {
    const file = this.files[0];
    if (!file || !currentEl) return;

    const base64 = await toBase64(file);

    // Preview immediately
    if (currentEl.tagName.toLowerCase() === "img") {
      currentEl.src = base64;
    } else {
      currentEl.style.backgroundImage = `url(${base64})`;
    }

    // Get original src or bg URL
    let src = null;
    if (currentEl.tagName.toLowerCase() === "img") {
      src = currentEl.getAttribute("src");
    } else {
      const bg = currentEl.style.backgroundImage || getComputedStyle(currentEl).backgroundImage;
      const match = bg.match(/url\(["']?(.*?)["']?\)/);
      src = match ? match[1] : null;
    }

    const repoPath = extractRepoPath(src);
    if (!repoPath) {
      alert("Cannot resolve GitHub path for this image. Updated locally only.");
      currentEl = null;
      return;
    }

    const sha = await getLatestSha(repoPath);
    const uploadResult = await uploadToGitHub(repoPath, base64, sha);

    if (uploadResult && uploadResult.commit) {
      alert("Image updated successfully on GitHub.");
    } else {
      alert("Upload failed. Check console for details.");
      console.error(uploadResult);
    }

    currentEl = null;
  });

  // ========== Observe for dynamic content ==========
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) markEditableImages(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ========== Initial run ==========
  document.addEventListener("DOMContentLoaded", () => {
    markEditableImages(document);
  });

  // ========== Optional CSS styling ==========
  const style = document.createElement("style");
  style.textContent = `
    .editable-image {
      transition: filter 0.2s ease, outline 0.2s ease;
    }
    .editable-image:hover {
      filter: brightness(0.9);
      outline: 2px dashed #00bcd4;
      outline-offset: 3px;
    }
  `;
  document.head.appendChild(style);
})();
