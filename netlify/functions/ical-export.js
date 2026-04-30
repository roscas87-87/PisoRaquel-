// netlify/functions/ical-export.js
const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized || admin.apps.length) { initialized = true; return; }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: 'pisovegagranada-78a89',
      clientEmail: 'firebase-adminsdk-fbsvc@pisovegagranada-78a89.iam.gserviceaccount.com',
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDJqCzJJAknUdNv\nSWWgDF/cccwYzZFf5erV/jTDe6+MVo15aJdDqNaxgWO6R2vaYhZ7rCdf/WUluzan\nwZGh5Dm4Lndkkw36wji7b1asg8LlgdX93pskR3397mPGuFkNOUO8rRyUIhw2b9/W\n0+kng7cGNMZEjsL6MEba5i2C/+Xmnkose2Q9VtPaWeVHtKC95H0CzqiBig8MIucG\ngdWZuAQU+rlBrvqenoSBRt+RBr+wlOzWTTswZhyuppSgsfG89pc76GHOjdiMgfIU\nXkt6tyyQPgpT/BEeO0HqMdKBFXsGaMGXDowjbfOYfbCecMUy5wvp56qn8QXRZdNR\nP1D5bBFDAgMBAAECggEAEuR2g0bYGrIJhBwVJGT0ZPoLIoNXBgWyAufLEeNlFqZ6\nbTzvKvx6IyAmc53CwEkMDS/oP0LfECViR5FhfCoEsR/Qhk1Z2m8J+WypawX4vOxb\nwlCLXV9BsdTjNFgyDTfOHX+Xm7zRKTwOKJmRQ7PzcjMaJIy+PjB54U+X3o8ffuou\n9wJcNJutYgEt1Cwf+vvj3x769uRBoWgnyAy9VUIH2WOqwYqW5LKTeW1quK8sETwG\nBAIl/fmIT0Ay5RZpACkj9CGb40dYv7OfYXdOq5zgDUn2PHKxIcwn7Gq+/CitsP6N\n/uUuhEMdUD6pt2hoiUnUCDZKKnkQWjIPVLQ7YCGI7QKBgQD4KDnl2m5fZMqGVWk5\nfvgLVb8Tvv5X8fCsb4TqwwH68TUMAr8BG9TMWJM7w87iRpFIF8oYDQkVLkpExpFd\ngR4pylmDdIfCDpbUb5+vrmiahObPIG/uEY7Uz04bpjTtCnsf36wz72bNjsp4BYOE\njnvT+PAVdlO7jiGbbNIimaU0PQKBgQDQB7paV8FmatI1vehH4gEmwTWrbAy3kiKa\nLamiILdVBMnPmgzr8898pOXAG6RDphNV0tK5QymqoKxoyCG3wShdFGXAuVxoJPOw\nXN0fjlWhflzeB8rDS1yY1/vPN4UJi/5I7ybHgCxblnuF5WByyMC8u30l2JddP3nX\nK8E60TszfwKBgEfr0KvvXKHFInVAd9i0FcujNFfSuQBgHHK9d3Zawk4qbkdm3FjD\n6i63VSSzIVivPxf33RiPXpyG5/t62VKSQ121SbAxq87wT4KOP2e5UpPGBObu7cG/\n0PeYhXi5+QjiSsD4IH6E2fSld8TFRFK8wOK0eVCfFLF9Bfx304c3pIu5AoGAaZaC\nj7hbAZDWgVCSxWmBDBqlEw0Up1gVGAx1PUU9yHlVtXmLdXeaqLlJo+hjx7JTvgvz\nyPS+AUzsNYLfGlWAFz5zJw7uSC35QlrgIVQtQnrQyCFMWTO3HB0EQnj7nYzg1EQO\netQjr5kBuURjX99ldGX1b3Av47SEMyKSQThRxCECgYA300AFEL7H2tHW7rHpx8Rs\nFVMqZ71M2o3Hc5+7IuA5ngf0xbx6dgUUsI1s7X+/IKK/czziVSp8S0y4FPfULtUe\ndzBgh/qnc/Tuq7L9H1DCITZ0meKgZm4nDNd89VHWxKniAaUuwXbkLFoUg9A73YYd\nU79J/LSG6M3cL1KKYnVFGA==\n-----END PRIVATE KEY-----\n"
    }),
    databaseURL: 'https://pisovegagranada-78a89-default-rtdb.firebaseio.com'
  });
  initialized = true;
}

function dateToIcal(dateStr) {
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
    const diff = (new Date(curr) - new Date(prev)) / (1000 * 60 * 60 * 24);
    if (diff === 1) { prev = curr; }
    else { groups.push({ start, end: addDays(prev, 1) }); start = curr; prev = curr; }
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
    let ical = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Vega Granada//pisovegagranada.es//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Vega Granada - Disponibilidad','X-WR-TIMEZONE:Europe/Madrid'];
    groups.forEach((g, i) => {
      ical = ical.concat(['BEGIN:VEVENT',`DTSTART;VALUE=DATE:${dateToIcal(g.start)}`,`DTEND;VALUE=DATE:${dateToIcal(g.end)}`,`DTSTAMP:${now}`,`UID:vegagranada-${i}-${dateToIcal(g.start)}@pisovegagranada.es`,'SUMMARY:No disponible / Not available','STATUS:CONFIRMED','TRANSP:OPAQUE','END:VEVENT']);
    });
    ical.push('END:VCALENDAR');
    return { statusCode: 200, headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }, body: ical.join('\r\n') };
  } catch (err) {
    return { statusCode: 500, body: 'Error: ' + err.message };
  }
};
