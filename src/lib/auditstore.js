let auditLogs = [];

export function addLog(log) {
  auditLogs.unshift(log); // latest on top
}

export function getLogs() {
  return auditLogs;
}