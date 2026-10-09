const statusText = document.querySelector("#server-status");
const checkButton = document.querySelector("#check-button");

async function checkServer() {
  checkButton.disabled = true;
  statusText.textContent = "Checking connection…";

  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }

    const data = await response.json();
    statusText.textContent = data.message;
  } catch (error) {
    statusText.textContent = "Could not reach the server. Try again.";
    console.error("Health check failed:", error);
  } finally {
    checkButton.disabled = false;
  }
}

checkButton.addEventListener("click", checkServer);
checkServer();
