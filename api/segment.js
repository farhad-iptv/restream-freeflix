// api/segment.js
export default async function handler(req, res) {
  const url = req.query.url; // e.g., ?url=http://upstream/segment.ts
  if (!url) return res.status(400).send("Missing segment URL");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "curl/7.81.0",
        "Accept": "*/*",
        "Referer": url, // some upstream servers require referer
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).send(errText);
    }

    const buffer = await response.arrayBuffer();

    // Send segment with correct MIME type
    res.setHeader("Content-Type", "video/MP2T");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(Buffer.from(buffer));
  } catch (err) {
    return res.status(500).send("Server error: " + err.message);
  }
}
