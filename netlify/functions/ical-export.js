// netlify/functions/ical-export.js
// Usa Firebase REST API - no necesita clave privada

exports.handler = async (event) => {
  try {
    // Leer datos de Firebase via REST API (público con reglas de lectura)
    const url = 'https://pisovegagranada-78a89-default-rtdb.firebaseio.com/vegagranada/admin.json';
    const res = await fetch(url);
    
    if (!res.ok) throw new Error('Firebase error: ' + res.status);
    
    const data = await res.json() || {};
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
        `UID:vegagranada-${i}-${dateToIcal(g.start)}@pisovegagranada.es`,
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
        'Cache-Control': 'no-cache, max-age=0',
        'Access-Control-Allow-Origin': '*',
      },
      body: ical.join('\r\n'),
    };

  } catch (err) {
    return { statusCode: 500, body: 'Error: ' + err.message };
  }
};

function dateToIcal(s) { return s.replace(/-/g, ''); }

function addDays(s, n) {
  const d = new Date(s);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function groupConsecutiveDates(dates) {
  if (!dates.length) return [];
  const sorted = [...dates].sort();
  const groups = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const diff = (new Date(curr) - new Date(prev)) / 86400000;
    if (diff === 1) { prev = curr; }
    else { groups.push({ start, end: addDays(prev, 1) }); start = curr; prev = curr; }
  }
  groups.push({ start, end: addDays(prev, 1) });
  return groups;
}
