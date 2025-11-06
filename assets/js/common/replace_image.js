// ⚠️ Never expose PAT in production frontend
      const token = localStorage.getItem('feature_key'); 
      const repoOwner = localStorage.getItem('owner');
      const repoName = localStorage.getItem('repo_name');
      let commitMessage = "Update test via API";

      const branch = "main"; 
alert('image editing');
function enableAllImageEditing() {
      alert('into image editing');
  const images = document.querySelectorAll('img');

  images.forEach((img, index) => {
    if (img.parentElement.querySelector('.edit-btn')) return;

    // Create wrapper to position the button correctly
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    
    // Insert wrapper before the image and move the image inside it
    img.parentElement.insertBefore(wrapper, img);
    wrapper.appendChild(img);

    // Create the pencil edit button
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '🖉'; // Pencil icon
    editBtn.className = 'edit-btn';
    editBtn.style.position = 'absolute';
    editBtn.style.top = '5px';
    editBtn.style.right = '5px';
    editBtn.style.background = '#fff';
    editBtn.style.border = '1px solid #ccc';
    editBtn.style.borderRadius = '50%';
    editBtn.style.padding = '5px';
    editBtn.style.cursor = 'pointer';
    editBtn.style.zIndex = '9999'; // Ensure it's above any other elements
    editBtn.style.transition = 'all 0.3s ease-in-out'; // Smooth transition for animations
    editBtn.title = 'Edit Image';

    // Append the button to the wrapper
    wrapper.appendChild(editBtn);

    // Hidden file input to upload new image
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    wrapper.appendChild(fileInput);

    // Show file input when the pencil button is clicked
    editBtn.addEventListener('click', () => {
      fileInput.click();
    });

    // Handle file input change (when a new image is selected)
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      // Convert the selected image file to Base64
      const base64Content = await toBase64(file);

      // Dynamically generate the GitHub file path from the image's src
      const imageSrc = img.getAttribute('src');
      console.log('imageSrc: ', imageSrc)
      const repoImagePath = extractRepoPath(imageSrc);
      console.log('repoImagePath: ', repoImagePath)
      commitMessage = repoImagePath
      console.log('commitMessage: ', commitMessage)
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
            message: commitMessage,
            content: base64Content.split(",")[1],
            sha: sha,
            branch: branch
          })
        }
      );

      const result = await response.json();
      console.log("Upload result:", result);

      if (result.content && result.commit) {
        // Fetch the updated image blob and set it to the image element
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
        img.src = imageBase64;
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
