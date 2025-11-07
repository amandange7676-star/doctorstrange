const token = localStorage.getItem('feature_key');
const repoOwner = localStorage.getItem('owner');
const repoName = localStorage.getItem('repo_name');
const branch = "main";

// ======= Enable editable class and direct upload =======
function enableAllImageEditing(root = document) {
  // <img> tags
  const imgs = root.querySelectorAll("img:not(.image-editable-initialized)");
  imgs.forEach((img) => {
    const src = img.getAttribute("src");
    if (src && src.includes("assets/images")) {
      img.classList.add("image-editable", "image-editable-initialized");

      img.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation(); // <--- stop any other click handlers
  directEdit(img, false);
}, true); // true = use capturing phase
    }
  });

  // Elements with background images
  const all = root.querySelectorAll("*:not(.image-editable-initialized)");
  all.forEach((el) => {
    const bgStyle = el.style.background || el.style.backgroundImage;
    const computedBg = window.getComputedStyle(el).backgroundImage;
    const bg = bgStyle || computedBg;

    if (bg && bg.includes("url(")) {
      const match = bg.match(/url\(["']?(.*?)["']?\)/);
      if (match && match[1].includes("assets/images")) {
        el.classList.add("image-editable", "image-editable-initialized");

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          directEdit(el, true);
        });
      }
    }
  });
}

// ======= Direct upload handler =======
async function directEdit(element, isBackground) {
  const originalSrc = isBackground
    ? extractUrlFromBackground(element)
    : element.getAttribute("src");

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);
  fileInput.click();

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const base64 = await toBase64(file);

    const repoImagePath = extractRepoPath(originalSrc);
    if (!repoImagePath) {
      alert("Unable to resolve GitHub file path from image src.");
      fileInput.remove();
      return;
    }

    const sha = await getLatestSha(repoImagePath);
    const commitMessage = `Update ${repoImagePath} via editor`;

    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${repoImagePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: commitMessage,
          content: base64.split(",")[1],
          sha: sha,
          branch: branch,
        }),
      }
    );

    const result = await response.json();
    if (result.content && result.commit) {
      const blobSha = result.content.sha;
      const latest = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/blobs/${blobSha}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
          },
        }
      );
      const latestData = await latest.json();
      const newBase64 = "data:image/png;base64," + latestData.content;

      if (isBackground) element.style.backgroundImage = `url(${newBase64})`;
      else element.src = newBase64;
    } else {
      alert("Upload failed: " + (result.message || "Unknown error"));
    }

    fileInput.remove();
  });
}

// ======= Helpers =======
function extractUrlFromBackground(el) {
  const bg = window.getComputedStyle(el).backgroundImage;
  const match = bg.match(/url\(["']?(.*?)["']?\)/);
  return match ? match[1] : null;
}
// function extractRepoPath(src) {
//   try {
//     const url = new URL(src, window.location.origin);
//     const path = url.pathname;
//     if (path.includes("/assets/images/")){
//       console.log(path);
//       return path;
//     }
//   } catch { console.error("Invalid image src:", src); }
//   return null;
// }
function extractRepoPath(src) {
  try {
    // Make sure src is valid
    if (!src) return null;

    // Look for "assets/images" in the path
    const index = src.indexOf("assets/images");
    if (index !== -1) {
      // Return everything from "assets/images" onward
      return src.substring(index);
    }
  } catch (e) {
    console.error("Invalid image src:", src);
  }
  return null;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.readAsDataURL(file);
    r.onload = () => resolve(r.result);
    r.onerror = reject;
  });
}
async function getLatestSha(filePath) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`,
      {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" }
      }
    );
    if (res.ok) return (await res.json()).sha;
  } catch { console.warn("SHA fetch failed."); }
  return null;
}

// ======= Init =======
document.addEventListener("DOMContentLoaded", () => {
  enableAllImageEditing();
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) enableAllImageEditing(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
});
