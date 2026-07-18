const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { GoogleAuth } = require("google-auth-library");

const COLLECTIONS = ["users", "prescriptions", "dose_logs", "refill_requests", "reports"];

async function clearAll() {
  const app = initializeApp({ projectId: "medconnect-515f7" });
  const db = getFirestore(app);

  // Use the Firebase CLI's refresh token to get credentials
  const configStore = require(require("path").join(
    process.env.USERPROFILE || process.env.HOME,
    ".config", "configstore", "firebase-tools.json"
  ));
  const { refresh_token } = configStore.tokens;

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  // Get a fresh access token using the refresh token
  const clientId = configStore.user.azp;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      refresh_token: refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    console.error("Failed to refresh token:", tokenData);
    process.exit(1);
  }

  // Use REST API to delete collections
  const project = "medconnect-515f7";
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;

  for (const collName of COLLECTIONS) {
    let total = 0;
    let pageToken = undefined;
    do {
      const url = new URL(`${baseUrl}/${collName}`);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      url.searchParams.set("pageSize", "500");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const data = await res.json();

      if (!data.documents || data.documents.length === 0) break;

      // Delete each document
      for (const doc of data.documents) {
        await fetch(doc.name, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        total++;
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    console.log(`${collName}: deleted ${total} documents`);
  }

  console.log("Done.");
  process.exit(0);
}

clearAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
