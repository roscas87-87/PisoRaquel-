// netlify/functions/ical-export.js
// Genera un feed iCal con las fechas bloqueadas en Firebase
// URL: https://pisovegagranada.es/.netlify/functions/ical-export

const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized || admin.apps.length) { initialized = true; return; }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
  });
  initialized = true;
}

function dateToIcal(dateStr) {
  // dateStr = 'YYYY-MM-DD' → '20260501'
  return dateStr.replace(/-/g, '');
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function groupConsecutiveDates(dates) {
  if (!dates.length) return [];
  const sorted = [...dates].sort();
  const groups = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const prevDate = new Date(prev);
    const currDate = new Date(curr);
    const diff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      prev = curr;
    } else {
      groups.push({ start, end: addDays(prev, 1) });
      start = curr;
      prev = curr;
    }
  }
  groups.push({ start, end: addDays(prev, 1) });
  return groups;
}

exports.handler = async (event) => {
  try {
    initFirebase();
    const db = admin.database();
    const snap = await db.ref('vegagranada/admin').once('value');
    const data = snap.val() || {};

    const blocked = data.blocked || [];
    const icalBlocked = data.icalBlocked || [];
    const allBlocked = [...new Set([...blocked, ...icalBlocked])];

    const groups = groupConsecutiveDates(allBlocked);
    const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

    let ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Vega Granada//pisovegagranada.es//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Vega Granada - Disponibilidad',
      'X-WR-TIMEZONE:Europe/Madrid',
    ];

    groups.forEach((g, i) => {
      ical = ical.concat([
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${dateToIcal(g.start)}`,
        `DTEND;VALUE=DATE:${dateToIcal(g.end)}`,
        `DTSTAMP:${now}`,
        `UID:vegagranada-blocked-${i}-${dateToIcal(g.start)}@pisovegagranada.es`,
        'SUMMARY:No disponible / Not available',
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT',
      ]);
    });

    ical.push('END:VCALENDAR');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="vegagranada.ics"',
        'Cache-Control': 'no-cache, max-age=0',
        'Access-Control-Allow-Origin': '*',
      },
      body: ical.join('\r\n'),
    };

  } catch (err) {
    console.error('iCal export error:', err);
    return {
      statusCode: 500,
      body: 'Error generating iCal: ' + err.message,
    };
  }
};
