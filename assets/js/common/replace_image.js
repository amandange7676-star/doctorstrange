// ⚠️ Never expose PAT in production frontend
      const token = localStorage.getItem('feature_key'); 
      const repoOwner = localStorage.getItem('owner');
      const repoName = localStorage.getItem('repo_name');
      let commitMessage = "Update test via API";

      const branch = "main"; 
alert('image editing');
function enableAllImageEditing() {
  const imageElements = [];

  // 1️⃣ Collect all <img> elements
  document.querySelectorAll('img').forEach(img => {
    imageElements.push({ element: img, type: 'img', src: img.src });
  });

  // 2️⃣ Collect all elements with inline background images
  document.querySelectorAll('*[style]').forEach(el => {
    const bg = el.style.backgroundImage;
    const match = bg.match(/url\(["']?(.*?)["']?\)/);
    if (match && match[1]) {
      const src = match[1];
      imageElements.push({ element: el, type: 'background', src });
    }
  });

  // 3️⃣ Apply edit buttons
  imageElements.forEach(({ element, type, src }) => {
    if (element.parentElement.querySelector('.edit-btn')) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';

    // Wrap the element
    element.parentElement.insertBefore(wrapper, element);
    wrapper.appendChild(element);

    // Create pencil button
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
        } else if (type === 'background') {
          element.style.backgroundImage = `url(${imageBase64})`;
        }
      } else {
        alert("Upload failed: " + result.message);
      }
    });
  });
}


// Extract the GitHub file path from image source (src)
function extractRepoPath(src) {
  try {
    const url = new URL(src, window.location.origin);
    const path = url.pathname;

    if (path.includes("/assets/images/")) {
      console.log('path: ', path)
      return "public" + path;
    }
  } catch (e) {
    console.error("Invalid image src:", src);
  }
  return null;
}

// Convert image file to base64
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// Fetch the latest SHA of the file in the GitHub repository
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

// Run the function when the page is loaded
document.addEventListener('DOMContentLoaded', enableAllImageEditing);
