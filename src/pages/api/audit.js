import { getLogs } from "../../lib/auditstore";

export default function handler(req, res) {
  res.status(200).json(getLogs());
}