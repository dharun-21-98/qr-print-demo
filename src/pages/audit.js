import { useEffect, useState } from "react";

export default function Audit() {
  const [logs, setLogs] = useState([]);

  const fetchLogs = async () => {
    const res = await fetch("/api/audit");
    const data = await res.json();
    setLogs(data);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div style={styles.container}>
      <h1>AIG QR Audit Dashboard</h1>

      <table style={styles.table}>
        <thead>
          <tr>
            <th>Document ID</th>
            <th>User ID</th>
            <th>Print ID</th>
            <th>Timestamp (IST)</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log, index) => (
            <tr key={index}>
              <td>{log.document_id}</td>
              <td>{log.user_id}</td>
              <td>{log.print_id}</td>
              <td>{log.timestamp_ist}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  container: {
    padding: "40px",
    fontFamily: "Arial",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "20px",
  },
};