import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  // Helper to ensure compatibility with Vercel and standard Node.js HTTP responses
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
    // 2. Validate Environment Variables
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

    let badgeRes;
    try {
      badgeRes = await axios.post(
        `https://apis.roblox.com/legacy-badges/v1/universes/${UNIVERSE_ID}/badges`,
        form,
        {
          headers: {
            'x-api-key': API_KEY,
            ...form.getHeaders()
          }
        }
      );
    } catch (badgeErr) {
      return sendJson(400, {
        error: 'Roblox Badge API Request Failed',
        status: badgeErr.response?.status,
        details: badgeErr.response?.data || badgeErr.message
      });
    }

    const badgeId = badgeRes.data.id;

    // 6. Save Badge ID into Roblox DataStore via Open Cloud API
    const dsUrl = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=DailyBadgeDS&entryKey=CurrentBadgeId`;

    try {
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
    } catch (dsErr) {
      return sendJson(400, {
        error: 'Roblox DataStore API Request Failed',
        status: dsErr.response?.status,
        badgeIdCreated: badgeId,
        details: dsErr.response?.data || dsErr.message
      });
    }

    // 7. Success Response
    return sendJson(200, {
      success: true,
      badgeId: badgeId,
      date: dateStr
    });

  } catch (err) {
    return sendJson(500, {
      error: 'Unhandled Server Error',
      details: err.response?.data || err.message
    });
  }
}
