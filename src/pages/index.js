import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Please select a file");

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);

    const res = await fetch("/api/generate", {
      method: "POST",
      body: formData,
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    window.open(url, "_blank");

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      
      {/* Header */}
      <div style={styles.header}>
        <img
          src="/AIG.png"
          alt="Logo"
          style={styles.logo}
        />
        <h1>AIG QR POC</h1>
      </div>

      {/* Card */}
      <div style={styles.card}>
        <h3>Upload PDF to Generate QR Watermark</h3>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button onClick={handleUpload} style={styles.button}>
          {loading ? "Processing..." : "Generate Secure PDF"}
        </button>
        <a href="/audit" style={{ marginTop: "20px", display: "block" }}>
          View Audit Dashboard →
        </a>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "Arial",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: "50px",
  },
  header: {
    textAlign: "center",
    marginBottom: "30px",
  },
  logo: {
    marginBottom: "10px",
  },
  card: {
    padding: "30px",
    border: "1px solid #ddd",
    borderRadius: "10px",
    boxShadow: "0px 4px 10px rgba(0,0,0,0.1)",
    textAlign: "center",
  },
  button: {
    marginTop: "20px",
    padding: "10px 20px",
    backgroundColor: "#0070f3",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
};