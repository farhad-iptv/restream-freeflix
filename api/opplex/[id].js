export const config = {
  runtime: "nodejs", // IMPORTANT for Vercel stability
};

export default async function handler(req, res) {
  try {
    // -----------------------------
    // 1. Get ID
    // -----------------------------
    let id = req.query?.id;
    if (Array.isArray(id)) id = id[0];
    if (!id) return res.status(400).send("Missing stream id");

    id = String(id).replace(/\.m3u8$/i, "");

    // -----------------------------
    // 2. Source URL
    // -----------------------------
    const baseXtream =
      "http://opplex.to:8080/live/jashwanrp/67891234/";

    const sourceUrl = `${baseXtream}/${id}.m3u8`;

    // -----------------------------
    // 3. Safe fetch (Vercel-friendly)
    // -----------------------------
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let upstreamResp;

    try {
      upstreamResp = await fetch(sourceUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,

        // 🔥 KEEP HEADERS MINIMAL (IMPORTANT)
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
          Accept: "*/*",
          Referer: "http://xott.live/",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    // -----------------------------
    // 4. Handle upstream errors
    // -----------------------------
    if (!upstreamResp.ok) {
      const text = await upstreamResp.text().catch(() => "");
      return res
        .status(upstreamResp.status)
        .send(`Upstream error ${upstreamResp.status}\n\n${text}`);
    }

    // -----------------------------
    // 5. Read playlist
    // -----------------------------
    let playlist = await upstreamResp.text();

    const finalUrl = upstreamResp.url;
    const u = new URL(finalUrl);

    const baseUrl = `${u.protocol}//${u.hostname}${
      u.port ? ":" + u.port : ""
    }`;

    const isAbsolute = (s) =>
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("//") ||
      s.startsWith("data:");

    // -----------------------------
    // 6. Fix quoted URIs
    // -----------------------------
    playlist = playlist.replace(
      /(["'])([^"']+\.(ts|m4s|mp4|key|aac|m3u8)(\?[^"']*)?)\1/gi,
      (match, q, url) => {
        if (isAbsolute(url)) {
          if (url.startsWith("//")) {
            return `${q}${u.protocol}${url}${q}`;
          }
          return `${q}${url}${q}`;
        }

        return `${q}${baseUrl}/${url.replace(/^\//, "")}${q}`;
      }
    );

    // -----------------------------
    // 7. Fix raw segment lines
    // -----------------------------
    const lines = playlist.split(/\r?\n/).map((line) => {
      const t = line.trim();

      if (!t || t.startsWith("#")) return line;

      if (isAbsolute(t)) {
        if (t.startsWith("//")) return u.protocol + t;
        return line;
      }

      return `${baseUrl}/${t.replace(/^\//, "")}`;
    });

    const finalPlaylist = lines.join("\n");

    // -----------------------------
    // 8. Response
    // -----------------------------
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(finalPlaylist);
  } catch (err) {
    console.error("SERVER ERROR:", err);

    // 🔥 IMPORTANT: show real error for debugging
    return res.status(500).send("Server error: " + err.message);
  }
}
