const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

// ----------------------
// CONFIGURATION
// ----------------------

// Temp folder for processing
const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Google Drive folder IDs
const INPUT_FOLDER_ID = process.env.DRIVE_INPUT_FOLDER_ID;       // qr-print-input
const PROCESSED_FOLDER_ID = process.env.DRIVE_PROCESSED_FOLDER_ID; // qr-print-processed

// Vercel API endpoint
const VERCEL_API = process.env.VERCEL_API_ENDPOINT || "https://qr-print-demo.vercel.app/api/generate";

// ----------------------
// AUTHENTICATION
// ----------------------

// Load service account JSON from environment variable
if (!process.env.GOOGLE_SERVICE_JSON) {
  console.error("❌ GOOGLE_SERVICE_JSON not found in environment variables");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_JSON);

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

// ----------------------
// DRIVE FUNCTIONS
// ----------------------

/**
 * List PDF files in input folder
 */
async function listFiles() {
  const res = await drive.files.list({
    q: `'${INPUT_FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`,
    fields: "files(id, name)",
  });
  return res.data.files;
}

/**
 * Download file locally
 */
async function downloadFile(fileId, destPath) {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  fs.writeFileSync(destPath, res.data);
  return destPath;
}

/**
 * Upload processed file to processed folder
 */
async function uploadFile(filePath, fileName) {
  const fileMetadata = {
    name: fileName,
    parents: [PROCESSED_FOLDER_ID],
  };
  const media = {
    mimeType: "application/pdf",
    body: fs.createReadStream(filePath),
  };
  const res = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: "id",
  });
  return res.data.id;
}

/**
 * Delete original input file
 */
async function deleteFile(fileId) {
  await drive.files.delete({ fileId });
}

// ----------------------
// PROCESSING FUNCTION
// ----------------------

/**
 * Send PDF to Vercel API for processing
 */
async function processPDF(localPath) {
  const formData = new FormData();
  formData.append("file", fs.createReadStream(localPath));

  const response = await axios.post(VERCEL_API, formData, {
    headers: { ...formData.getHeaders() },
    responseType: "arraybuffer",
  });

  const outputPath = localPath.replace(".pdf", "_secured.pdf");
  fs.writeFileSync(outputPath, response.data);
  return outputPath;
}

// ----------------------
// MAIN POLLING LOOP
// ----------------------

async function pollDrive() {
  console.log("Checking Drive for new PDFs...");

  try {
    const files = await listFiles();

    for (const file of files) {
      try {
        console.log("Found PDF:", file.name);

        // Download locally
        const localPath = path.join(TEMP_DIR, file.name);
        await downloadFile(file.id, localPath);

        // Send to Vercel API
        const processedPath = await processPDF(localPath);

        // Upload processed file to Drive
        const processedName = path.basename(processedPath);
        await uploadFile(processedPath, processedName);

        console.log("✅ Processed and uploaded:", processedName);

        // Delete original input file
        await deleteFile(file.id);

        // Clean temp files
        fs.unlinkSync(localPath);
        fs.unlinkSync(processedPath);

      } catch (err) {
        console.error("❌ Error processing file:", file.name, err.message);
      }
    }
  } catch (err) {
    console.error("❌ Error polling Drive:", err.message);
  }
}

// ----------------------
// START POLLING
// ----------------------

// Poll every 10 seconds
setInterval(pollDrive, 10000);

// Run immediately on start
pollDrive();