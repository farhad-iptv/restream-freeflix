// api/RESTREAM/[id].js
export default async function handler(req, res) {
  try {
    // Get stream ID from query or path
    let streamId = req.query?.id ?? null;
    if (Array.isArray(streamId)) streamId = streamId[0];
    if (!streamId) return res.status(400).send("Missing stream id");

    streamId = String(streamId).replace(/\.m3u8$/i, "");

    // Original playlist URL
    const sourceUrl = `https://restream-freeflix.vercel.app/api/opplex/${streamId}.m3u8`;

    // Fetch the original playlist
    const upstreamResp = await fetch(sourceUrl, { redirect: "follow" });
    if (!upstreamResp.ok) {
      const errText = await upstreamResp.text();
      return res.status(upstreamResp.status).send(errText);
    }

    const playlist = await upstreamResp.text();

    // Rewrite .ts segment URLs with ?segment= prefix
    const updatedPlaylist = playlist.split(/\r?\n/).map((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return line; // keep tags as-is
      if (t.endsWith(".ts")) {
        // Add ?segment= prefix
        return `?segment=${encodeURIComponent(t)}`;
      }
      return line;
    }).join("\n");


    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.status(200).send(updatedPlaylist);

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).send("Server error: " + (err.message || err));
  }
}
