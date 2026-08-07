import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  // Safe helper that works on Express, Vercel, and raw Node.js HTTP servers
  const sendJson = (statusCode, data) => {
    if (typeof res.status === 'function') {
      return res.status(statusCode).json(data);
    }
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(data));
  };

  // 1. Ignore browser favicon requests
  if (req.url && (req.url.includes('favicon.ico') || req.url.includes('favicon.png'))) {
    if (typeof res.status === 'function') return res.status(204).end();
    res.statusCode = 204;
    return res.end();
  }

  try {
    // 2. Environment Variables Check
    const API_KEY = process.env.ROBLOX_API_KEY;
    const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
    const CRON_SECRET = process.env.CRON_SECRET;

    if (!API_KEY || !UNIVERSE_ID || !CRON_SECRET) {
      return sendJson(500, {
        error: 'Missing Environment Variables',
        details: 'Ensure ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, and CRON_SECRET are set in Vercel Settings.'
      });
    }

    // 3. Security Header Check
    const secretHeader = req.headers['x-cron-secret'];
    if (secretHeader !== CRON_SECRET) {
      return sendJson(401, { error: 'Unauthorized: Invalid x-cron-secret header.' });
    }

    const dateStr = new Date().toISOString().split('T')[0];

    // 4. Sample 512x512 transparent PNG image buffer for Roblox Badge
    const samplePngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAgAAAAICCAYAAACm/UfGAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAXSURBVHhe7cEBDQAAAMKg90t1hkUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4GQYgAAGJ4s1cAAAAAElFTkSuQmCC',
      'base64'
    );

    // 5. Create Badge via Roblox Open Cloud API
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

    // 6. Save Badge ID into DataStore via Roblox Open Cloud API
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

    return sendJson(200, {
      success: true,
      badgeId: badgeId,
      date: dateStr
    });

  } catch (err) {
    return sendJson(500, {
      error: 'Unhandled Internal Error',
      details: err.response?.data || err.message
    });
  }
}
