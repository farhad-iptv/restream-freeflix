export default async function handler(req, res) {
  const data = {
    category_name: "Sports",
    name: "Sony Ten Sports 1 HD",
    logo: "https://assets-prod.services.toffeelive.com/f_webp,w_240,q_100/py5j-JQBv9knK3AHxDTY/posters/ea3358b9-2bec-4615-a889-daa2e396c74c.webp",
    link: "https://bldcmprod-cdn.toffeelive.com/cdn/live/sony_sports_1_hd/playlist.m3u8",
    cookie:
      "Edge-Cache-Cookie=URLPrefix=aHR0cHM6Ly9ibGRjbXByb2QtY2RuLnRvZmZlZWxpdmUuY29t:Expires=1757768360:KeyName=prod_linear:Signature=sE9pG3zPzEwXb8BtRw9fUg1MYgykQg_-nkd8IpxLwduE6aKy2XM0K4EPlyZOQ4u3En3HbUsDF86fP9LeUGuPAg",
  };

  const baseHost = "https://bldcmprod-cdn.toffeelive.com";

  // 🔹 Segment proxy handler
  if (req.query.segment) {
    const segmentPath = req.query.segment;
    const segmentUrl = `${baseHost}${segmentPath}`;

    try {
      const response = await fetch(segmentUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://toffeelive.com/",
          Cookie: data.cookie,
        },
      });

      if (!response.ok) {
        res.status(502).send("Failed to fetch segment.");
        return;
      }

      const contentType = response.headers.get("content-type");
      const buffer = await response.arrayBuffer();

      res.setHeader("Content-Type", contentType);
      res.send(Buffer.from(buffer));
    } catch (error) {
      res.status(502).send("Error fetching segment.");
    }

    return;
  }

  // 🔹 Helper: fetch .m3u8 playlist
  async function fetchM3U8(url) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://toffeelive.com/",
          Cookie: data.cookie,
        },
      });

      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }

  // 🔹 Step 1: Fetch master playlist
  const master = await fetchM3U8(data.link);

  if (!master) {
    res.setHeader("Content-Type", "text/plain");
    res.send("Failed to fetch master playlist.");
    return;
  }

  // Fix relative paths
  const base = "https://bldcmprod-cdn.toffeelive.com/cdn/live/";
  const fixed = master.replace(/\.\.\//g, base);

  // Extract .m3u8 variant links
  const variantMatches = [...fixed.matchAll(/(https?:\/\/[^\s]+\.m3u8[^\s]*)/g)];
  if (variantMatches.length < 2) {
    res.setHeader("Content-Type", "text/plain");
    res.send("2nd playlist not found in master playlist.");
    return;
  }

  const secondVariant = variantMatches[1][1];
  const subPlaylist = await fetchM3U8(secondVariant);

  if (!subPlaylist) {
    res.setHeader("Content-Type", "text/plain");
    res.send(`Failed to fetch 2nd playlist: ${secondVariant}`);
    return;
  }

  // Replace .ts and .key URIs with proxy links
  const proxied = subPlaylist
    .replace(/(\/live\/[^\s]+\.ts)/g, "?segment=$1")
    .replace(/URI="(\/[^"]+)"/g, 'URI="?segment=$1"');


  res.send(proxied);
}
