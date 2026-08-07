// index.js
export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end("Roblox Badge API is active. Access endpoints via /api/create-badge");
}
