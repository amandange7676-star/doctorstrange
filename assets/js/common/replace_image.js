// ⚠️ Never expose PAT in production frontend
      const token = localStorage.getItem('feature_key'); 
      const repoOwner = localStorage.getItem('owner');
      const repoName = localStorage.getItem('repo_name');
      let commitMessage = "Update test via API";

      const branch = "main"; 
alert('image editing');
document.addEventListener('DOMContentLoaded', enableAllImageEditing);

async function enableAllImageEditing() {
  const elements = [];

  // 1️⃣ Collect <img> elements
  document.querySelectorAll('img').forEach(img => {
    elements.push({ element: img, type: 'img', src: img.src });
  });

  // 2️⃣ Collect inline background-image
  document.querySelectorAll('*[style]').forEach(el => {
    const bg = el.style.backgroundImage;
    const match = bg.match(/url\(["']?(.*?)["']?\)/);
    if (match && match[1]) elements.push({ element: el, type: 'bg-inline', src: match[1] });
  });

  // 3️⃣ Collect computed background-image (from external CSS)
  document.querySelectorAll('*').forEach(el => {
    const bg = getComputedStyle(el).backgroundImage;
    const match = bg && bg.match(/url\(["']?(.*?)["']?\)/);
    if (match && match[1]) {
      // Avoid duplicates
      if (!elements.find(e => e.element === el)) {
        elements.push({ element: el, type: 'bg-computed', src: match[1] });
      }
    }
  });

  console.log("Editable elements found:", elements);

  // 4️⃣ Add edit buttons
  elements.forEach(({ element, type, src }) => {
    // Skip if already has a button
    if (element.parentElement?.querySelector?.('.edit-btn')) return;

    // Make sure the element is positioned so the button can overlay
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = getComputedStyle(element).display === 'block' ? 'block' : 'inline-block';
    wrapper.style.width = element.offsetWidth + 'px';
    wrapper.style.height = element.offsetHeight + 'px';
    wrapper.style.overflow = 'hidden';

    if (element.parentElement) {
      element.parentElement.insertBefore(wrapper, element);
      wrapper.appendChild(element);
    }

    // ✏️ Edit button
    const editBtn = document.createElement('button');
    editBtn.textContent = '🖉';
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
      zIndex: '9999'
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
        alert(`❌ Can't resolve repo path for image: ${src}`);
        return;
      }

      const sha = await getLatestSha(repoImagePath);
      const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${repoImagePath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Update ${repoImagePath}`,
            content: base64Content.split(',')[1],
            sha,
            branch
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
              Accept: 'application/vnd.github+json'
            }
          }
        );
        const latestData = await latest.json();
        const imageBase64 = 'data:image/png;base64,' + latestData.content;

        if (type === 'img') {
          element.src = imageBase64;
        } else {
          element.style.backgroundImage = `url(${imageBase64})`;
        }
      } else {
        alert('Upload failed: ' + result.message);
      }
    });
  });
}

// 🧩 Convert file to base64
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

// 🧩 Get file SHA from GitHub
async function getLatestSha(filePath) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`,
      {
        headers: { Authorization: `token ${token}` }
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data.sha;
    }
  } catch (err) {
    console.warn('SHA fetch failed; new file will be created.');
  }
  return null;
}

// 🧩 Smarter path resolver — handles relative, absolute, localhost, or remote URLs
function extractRepoPath(src) {
  try {
    // Normalize URL (handles relative vs. absolute)
    const url = new URL(src, window.location.origin);
    const path = url.pathname;

    // Match anything under assets/images, even nested
    const idx = path.lastIndexOf('/assets/images/');
    if (idx !== -1) {
      const repoPath = 'public' + path.substring(idx);
      return repoPath.replace(/^\/+/, '');
    }
  } catch (e) {
    console.error('Invalid image src:', src, e);
  }
  return null;
}
