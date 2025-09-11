// File: api/getStream.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { id } = req.query; // e.g., id="Sony Ten Sports 2 HD"

    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    // 1. Fetch the playlist JSON
    const playlistUrl =
      'https://raw.githubusercontent.com/abusaeeidx/Toffee-playlist/refs/heads/main/NS_player.m3u';
    const response = await fetch(playlistUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status}`);
    }

    const text = await response.text();

    // The file is actually JSON-like, so parse it
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error('Playlist is not valid JSON');
    }

    // 2. Find the matching channel by name or id
    const channel = data.find(
      (item) => item.name.trim().toLowerCase() === id.trim().toLowerCase()
    );

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // 3. Return the m3u8 link and cookie in headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({
      name: channel.name,
      category: channel.category_name,
      logo: channel.logo,
      m3u8: channel.link,
      headers: {
        Cookie: channel.cookie,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
