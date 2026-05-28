import { request } from "undici";

export default async function handler(req, res) {
  try {
    let id = req.query?.id;
    if (Array.isArray(id)) id = id[0];
    if (!id) return res.status(400).send("Missing stream id");

    id = String(id).replace(/\.m3u8$/i, "");

    const baseXtream = "http://opplex.to:8080/live/jashwanrp/67891234/";
    const sourceUrl = `${baseXtream}/${id}.m3u8`;

    // ✅ UNDICI REQUEST (more stable than fetch in Node/serverless)
    const upstreamResp = await request(sourceUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Accept": "*/*",
        "Referer": "http://xott.live/",
      },
      maxRedirections: 5,
    });

    const status = upstreamResp.statusCode;
    const headers = upstreamResp.headers;

    if (status >= 400) {
      const errText = await upstreamResp.body.text();
      return res.status(status).send(`Upstream error ${status}\n\n${errText}`);
    }

    const finalUrl = upstreamResp.context?.redirects?.at(-1) || sourceUrl;
    let playlist = await upstreamResp.body.text();

    const u = new URL(finalUrl);
    const baseUrl = `${u.protocol}//${u.hostname}${u.port ? ":" + u.port : ""}`;

    const isAbsolute = (s) =>
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("//") ||
      s.startsWith("data:");

    playlist = playlist.replace(
      /(["'])([^"']+\.(ts|m4s|mp4|key|aac|m3u8)(\?[^"']*)?)\1/gi,
      (match, q, url) => {
        if (isAbsolute(url)) return `${q}${url}${q}`;
        return `${q}${baseUrl}/${url.replace(/^\//, "")}${q}`;
      }
    );

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(playlist);
  } catch (err) {
    console.error("FETCH ERROR:", err);
    return res.status(500).send("Server error: " + err.message);
  }
}
