import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  // 1. Security Check: Validate cron secret header
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized request' });
  }

  const API_KEY = process.env.ROBLOX_API_KEY;
  const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    // 2. Base64 512x512 transparent PNG image buffer for Roblox Badge
    const samplePngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAgAAAAICCAYAAACm/UfGAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAXSURBVHhe7cEBDQAAAMKg90t1hkUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4GQYgAAGJ4s1cAAAAAElFTkSuQmCC',
      'base64'
    );

    // 3. Create Badge via Roblox Open Cloud API
    const form = new FormData();
    form.append('name', `Daily Badge - ${dateStr}`);
    form.append('description', `Logged in on ${dateStr}!`);
    form.append('paymentSourceType', 'User');
    form.append('image', samplePngBuffer, { filename: 'badge.png', contentType: 'image/png' });

    const badgeRes = await axios.post(
      `https://apis.roblox.com/legacy-badges/v1/universes/${UNIVERSE_ID}/badges`,
      form,
      {
        headers: {
          'x-api-key': API_KEY,
          ...form.getHeaders()
        }
      }
    );

    const badgeId = badgeRes.data.id;

    // 4. Update DataStore Entry via Roblox Open Cloud API
    const dsUrl = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=DailyBadgeDS&entryKey=CurrentBadgeId`;

    await axios.post(
      dsUrl,
      JSON.stringify(badgeId),
      {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    return res.status(200).json({ 
      success: true, 
      badgeId: badgeId, 
      date: dateStr 
    });

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    return res.status(500).json({ 
      error: 'Failed to create badge or update DataStore', 
      details: err.response?.data || err.message 
    });
  }
}
