// api/Toffee/[id].js
export default async function handler(req, res) {
  const BASE_HOST = "https://bldcmprod-cdn.toffeelive.com";
  const COOKIE = "Edge-Cache-Cookie=URLPrefix=aHR0cHM6Ly9ibGRjbXByb2QtY2RuLnRvZmZlZWxpdmUuY29t:Expires=1757768360:KeyName=prod_linear:Signature=sE9pG3zPzEwXb8BtRw9fUg1MYgykQg_-nkd8IpxLwduE6aKy2XM0K4EPlyZOQ4u3En3HbUsDF86fP9LeUGuPAg";

  try {
    // 🔹 Handle segment proxy request
    if (req.query.segment) {
      const path = req.query.segment;
      const url = BASE_HOST + path;

      const upstream = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://toffeelive.com/",
          "Cookie": COOKIE
        }
      });

      if (!upstream.ok) return res.status(502).send("Failed to fetch segment");

      const contentType = upstream.headers.get("content-type") || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      const buffer = await upstream.arrayBuffer();
      return res.status(200).send(Buffer.from(buffer));
    }

    // 🔹 Get stream ID
    let id = req.query?.id ?? "sony_sports_1_hd"; // default
    if (Array.isArray(id)) id = id[0];
    id = String(id).replace(/\.m3u8$/i, "");

    // 🔹 Build master playlist URL
    const masterUrl = `${BASE_HOST}/cdn/live/${id}/playlist.m3u8`;
    const masterResp = await fetch(masterUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://toffeelive.com/",
        "Cookie": COOKIE
      }
    });

    if (!masterResp.ok) return res.status(502).send("Failed to fetch master playlist");

    let playlist = await masterResp.text();

    // 🔹 Fix relative paths in playlist
    const isAbsolute = (url) => /^(https?:)?\/\//.test(url);
    playlist = playlist.replace(
      /(["'])([^"']+\.(?:ts|m3u8|key))\1/gi,
      (_, quote, url) => {
        if (isAbsolute(url)) return `${quote}${url}${quote}`;
        return `${quote}?segment=${url.startsWith("/") ? "" : "/"}${url}${quote}`;
      }
    );

    // 🔹 Also fix plain lines (TS, KEY, etc.)
    playlist = playlist.split(/\r?\n/).map(line => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return line;
      if (isAbsolute(t)) return line;
      return `?segment=${t.startsWith("/") ? "" : "/"}${t}`;
    }).join("\n");

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.status(200).send(playlist);

  } catch (err) {
    console.error("⚠️ Server error", err);
    return res.status(500).send("Server error: " + (err.message || err));
  }
}
