// ⚠️ Never expose PAT in production frontend
      const token = localStorage.getItem('feature_key'); 
      const repoOwner = localStorage.getItem('owner');
      const repoName = localStorage.getItem('repo_name');
      let commitMessage = "Update test via API";

      const branch = "main"; 
alert('image editing');
async function enableAllImageEditing() {
  const elements = [];

  // 1️⃣ Collect all <img> tags
  document.querySelectorAll('img').forEach(img => {
    elements.push({ element: img, type: 'img', src: img.src });
  });

  // 2️⃣ Collect all elements with inline background-image
  document.querySelectorAll('*[style]').forEach(el => {
    const bg = el.style.backgroundImage;
    const match = bg.match(/url\(["']?(.*?)["']?\)/);
    if (match && match[1]) {
      elements.push({ element: el, type: 'background-inline', src: match[1] });
    }
  });

  // 3️⃣ Collect all elements with computed background-image (from external CSS)
  document.querySelectorAll('*').forEach(el => {
    const bg = getComputedStyle(el).backgroundImage;
    const match = bg && bg.match(/url\(["']?(.*?)["']?\)/);
    if (match && match[1] && !elements.find(e => e.element === el)) {
      elements.push({ element: el, type: 'background-computed', src: match[1] });
    }
  });

  console.log("Editable elements found:", elements);

  // 4️⃣ Attach edit UI
  elements.forEach(({ element, type, src }) => {
    if (element.parentElement.querySelector('.edit-btn')) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = getComputedStyle(element).display === 'block' ? 'block' : 'inline-block';
    wrapper.style.width = element.offsetWidth + 'px';
    wrapper.style.height = element.offsetHeight + 'px';
    wrapper.style.overflow = 'hidden';

    // Insert wrapper before element
    element.parentElement.insertBefore(wrapper, element);
    wrapper.appendChild(element);

    // Pencil edit button
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '🖉';
    editBtn.className = 'edit-btn';
    Object.assign(editBtn.style, {
      position: 'absolute',
      top: '5px',
      right: '5px',
      background: '#fff',
      border: '1px solid #ccc',
      borderRadius: '50%',
      padding: '5px',
      cursor: 'pointer',
      zIndex: '9999',
      transition: 'all 0.3s ease-in-out'
    });
    wrapper.appendChild(editBtn);

    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    wrapper.appendChild(fileInput);

    editBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      const base64Content = await toBase64(file);
      const repoImagePath = extractRepoPath(src);
      if (!repoImagePath) {
        alert('Unable to resolve GitHub file path from image src.');
        return;
      }

      const sha = await getLatestSha(repoImagePath);
      const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${repoImagePath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: repoImagePath,
            content: base64Content.split(",")[1],
            sha: sha,
            branch: branch
          })
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
              Accept: "application/vnd.github+json"
            }
          }
        );
        const latestData = await latest.json();
        const imageBase64 = "data:image/png;base64," + latestData.content;

        if (type === 'img') {
          element.src = imageBase64;
        } else {
          element.style.backgroundImage = `url(${imageBase64})`;
        }
      } else {
        alert("Upload failed: " + result.message);
      }
    });
  });
}

// Utilities remain the same:
function extractRepoPath(src) {
  try {
    const url = new URL(src, window.location.origin);
    const path = url.pathname;
    if (path.includes("/assets/images/")) {
      return "public" + path;
    }
  } catch (e) {
    console.error("Invalid image src:", src);
  }
  return null;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
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
  } catch (err) {
    console.warn("SHA fetch failed or file not found, will create new.");
  }
  return null;
}

document.addEventListener('DOMContentLoaded', enableAllImageEditing);

