// sync-ical.js — Lee iCals de Airbnb y Booking y guarda en Firebase
import fetch from 'node-fetch';
import admin from 'firebase-admin';

// ── Firebase init ──
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
});

const db = admin.database();

// ── iCal parser ──
function parseIcal(text) {
  const dates = [];
  const events = text.split('BEGIN:VEVENT');
  events.shift();
  for (const ev of events) {
    const dtstart = ev.match(/DTSTART[^:]*:(\d{8})/);
    const dtend   = ev.match(/DTEND[^:]*:(\d{8})/);
    if (!dtstart || !dtend) continue;
    const start = parseDate(dtstart[1]);
    const end   = parseDate(dtend[1]);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const str = fmt(new Date(d));
      if (!dates.includes(str)) dates.push(str);
    }
  }
  return dates;
}

function parseDate(s) {
  return new Date(
    parseInt(s.slice(0,4)),
    parseInt(s.slice(4,6)) - 1,
    parseInt(s.slice(6,8))
  );
}

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Fetch iCal ──
async function fetchIcal(url, name) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; calendar-reader/1.0)',
        'Accept': 'text/calendar, */*'
      },
      timeout: 15000
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes('VCALENDAR')) throw new Error('Respuesta no es un iCal válido');
    const dates = parseIcal(text);
    console.log(`✅ ${name}: ${dates.length} días ocupados`);
    return dates;
  } catch(e) {
    console.error(`❌ ${name}: ${e.message}`);
    return [];
  }
}

// ── Main ──
async function main() {
  console.log('🔄 Iniciando sincronización iCal...');

  const airbnbUrl  = process.env.ICAL_AIRBNB;
  const bookingUrl = process.env.ICAL_BOOKING;

  let allDates = [];

  if (airbnbUrl)  allDates = allDates.concat(await fetchIcal(airbnbUrl,  'Airbnb'));
  if (bookingUrl) allDates = allDates.concat(await fetchIcal(bookingUrl, 'Booking'));

  // Deduplicar
  const unique = [...new Set(allDates)].sort();

  console.log(`📅 Total fechas ocupadas: ${unique.length}`);

  // Guardar en Firebase
  const ref = db.ref('vegagranada/admin/icalBlocked');
  await ref.set(unique);

  // Guardar timestamp de última sync
  await db.ref('vegagranada/admin/icalSyncDate').set(new Date().toISOString());

  console.log('✅ Guardado en Firebase correctamente');
  process.exit(0);
}

main().catch(e => {
  console.error('💥 Error fatal:', e);
  process.exit(1);
});
