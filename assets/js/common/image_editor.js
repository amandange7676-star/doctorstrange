const token = localStorage.getItem('feature_key');
const repoOwner = localStorage.getItem('owner');
const repoName = localStorage.getItem('repo_name');
const branch = "main";

// ======= Enable editable class and direct upload =======
function enableAllImageEditing(root = document) {
  // <img> tags
  const imgs = root.querySelectorAll("img:not(.image-editable-initialized)");
  imgs.forEach(img => {
    const src = img.getAttribute("src");
    if (!src || !src.includes("assets/images")) return;

    img.classList.add("image-editable", "image-editable-initialized");

    // Direct click handler
    img.addEventListener("click", async function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);
      fileInput.click();

      fileInput.onchange = async function() {
        const file = fileInput.files[0];
        if (!file) return;
        const base64 = await toBase64(file);

        const repoImagePath = extractRepoPath(src);
        if (!repoImagePath) {
          alert("Cannot determine GitHub path");
          fileInput.remove();
          return;
        }

        const sha = await getLatestSha(repoImagePath);
        const commitMessage = `Update ${repoImagePath}`;

        const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${repoImagePath}`, {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: commitMessage,
            content: base64.split(",")[1],
            sha: sha,
            branch: branch
          })
        });

        const result = await response.json();
        if (result.content) {
          img.src = base64; // instant preview
          alert("✅ Image uploaded successfully!");
        } else {
          alert("❌ Upload failed: " + (result.message || "Unknown error"));
        }

        fileInput.remove();
      };
    });
  });

  // Elements with background images
  const all = root.querySelectorAll("*:not(.image-editable-initialized)");
  all.forEach(el => {
    const bgStyle = el.style.background || el.style.backgroundImage;
    const computedBg = window.getComputedStyle(el).backgroundImage;
    const bg = bgStyle || computedBg;

    if (bg && bg.includes("url(")) {
      const match = bg.match(/url\(["']?(.*?)["']?\)/);
      if (match && match[1].includes("assets/images")) {
        el.classList.add("image-editable", "image-editable-initialized");

        el.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          directBackgroundEdit(el, match[1]);
        });
      }
    }
  });
}

// ======= Direct edit for background images =======
async function directBackgroundEdit(el, bgSrc) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);
  fileInput.click();

  fileInput.onchange = async function() {
    const file = fileInput.files[0];
    if (!file) return;
    const base64 = await toBase64(file);

    const repoImagePath = extractRepoPath(bgSrc);
    if (!repoImagePath) {
      alert("Cannot determine GitHub path");
      fileInput.remove();
      return;
    }

    const sha = await getLatestSha(repoImagePath);
    const commitMessage = `Update ${repoImagePath}`;

    const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${repoImagePath}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: commitMessage,
        content: base64.split(",")[1],
        sha: sha,
        branch: branch
      })
    });

    const result = await response.json();
    if (result.content) {
      el.style.backgroundImage = `url(${base64})`; // instant preview
      alert("✅ Background image uploaded!");
    } else {
      alert("❌ Upload failed: " + (result.message || "Unknown error"));
    }

    fileInput.remove();
  };
}

// ======= Helpers =======
function extractRepoPath(src) {
  if (!src) return null;
  const index = src.indexOf("assets/images");
  if (index !== -1) return src.substring(index);
  return null;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

async function getLatestSha(filePath) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" }
    });
    if (res.ok) return (await res.json()).sha;
  } catch {
    console.warn("SHA fetch failed.");
  }
  return null;
}

// ======= Init =======
document.addEventListener("DOMContentLoaded", () => {
  enableAllImageEditing(document.body);

  // Watch for dynamically added content (like header/footer)
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) enableAllImageEditing(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
});
