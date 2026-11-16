// Reads an IRCTC booking SMS or e-ticket email (pasted text) and pulls out the journey details.
// Runs entirely on the device — nothing is sent anywhere.

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const STN = {
  MAO: 'Madgaon', THVM: 'Thivim', KRMI: 'Karmali', VSG: 'Vasco da Gama', PERN: 'Pernem', CNO: 'Canacona',
  CSMT: 'Mumbai CSMT', LTT: 'Mumbai LTT', BCT: 'Mumbai Central', DR: 'Dadar', TNA: 'Thane', PNVL: 'Panvel', BDTS: 'Bandra Terminus', BVI: 'Borivali',
  NK: 'Nashik Road', PUNE: 'Pune', KYN: 'Kalyan', RN: 'Ratnagiri', KUDL: 'Kudal', SWV: 'Sawantwadi Road',
  NDLS: 'New Delhi', NZM: 'Hazrat Nizamuddin', DLI: 'Old Delhi', ANVT: 'Anand Vihar', SBC: 'Bengaluru (KSR)', YPR: 'Yesvantpur', SMVB: 'SMVT Bengaluru',
  MAS: 'Chennai Central', MS: 'Chennai Egmore', HWH: 'Howrah', SDAH: 'Sealdah', SC: 'Secunderabad', HYB: 'Hyderabad', KCG: 'Kacheguda',
  ADI: 'Ahmedabad', ST: 'Surat', BRC: 'Vadodara', JP: 'Jaipur', JU: 'Jodhpur', JSM: 'Jaisalmer', UDZ: 'Udaipur City', AII: 'Ajmer',
  LKO: 'Lucknow', CNB: 'Kanpur Central', BSB: 'Varanasi', PRYJ: 'Prayagraj', AGC: 'Agra Cantt', BPL: 'Bhopal', NGP: 'Nagpur', ET: 'Itarsi',
  ERS: 'Ernakulam Jn', TVC: 'Thiruvananthapuram', CLT: 'Kozhikode', MAQ: 'Mangaluru Central', MAJN: 'Mangaluru Jn', UBL: 'Hubballi', BGM: 'Belagavi', KOP: 'Kolhapur',
  CDG: 'Chandigarh', KLK: 'Kalka', JAT: 'Jammu Tawi', SVDK: 'Katra', DDN: 'Dehradun', HW: 'Haridwar', RKSH: 'Rishikesh', NJP: 'New Jalpaiguri', GHY: 'Guwahati',
};
const CLASSES = { '1A': 'First AC', '2A': 'AC 2-tier', '3A': 'AC 3-tier', '3E': 'AC 3-economy', SL: 'Sleeper', CC: 'Chair Car', EC: 'Executive Chair Car', EA: 'Executive Anubhuti', '2S': 'Second Sitting', FC: 'First Class' };

const pad = (n) => String(n).padStart(2, '0');
function toIso(d, m, y) {
  m = isNaN(+m) ? MON[String(m).slice(0, 3).toLowerCase()] : +m; y = +y; if (y < 100) y += 2000;
  if (!m || !+d || !y) return '';
  return `${y}-${pad(m)}-${pad(+d)}`;
}
const DATE = /(\d{1,2})[-\/. ]([A-Za-z]{3,9}|\d{1,2})[-\/. ,]+(\d{2,4})/;
function dateIn(s) { const m = s && s.match(DATE); return m ? toIso(m[1], m[2], m[3]) : ''; }
const stationName = (code) => (code ? STN[code.toUpperCase()] || code.toUpperCase() : '');
const nameWithCode = (name, code) => {
  const nice = String(name || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return STN[code] || (nice ? nice + ' (' + code + ')' : code);
};
function addDays(iso, n) { const p = iso.split('-'); const d = new Date(+p[0], +p[1] - 1, +p[2] + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function parseTicket(raw) {
  const t = String(raw || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const out = { kind: 'train' }; const found = [];

  // PNR
  let m = t.match(/PNR\s*(?:No\.?|Number)?\s*[:\-–#]?\s*(\d{10})\b/i) || t.match(/\b(\d{10})\b/);
  if (m) { out.pnr = m[1]; found.push('PNR'); }

  // Train number (+ name in e-tickets: "Train No./Name : 22224/VANDE BHARAT EXP")
  m = t.match(/Train\s*No\.?\s*(?:\/\s*Name)?\s*[:\-]?\s*(\d{5})(?:\s*\/\s*([A-Z0-9][A-Z0-9 .\-]{2,40}?))?(?=\s*(?:\n|Class|Quota|Date|Distance|$|\s{2}))/i)
    || t.match(/\bTRN\s*(?:No\.?)?\s*[:\-#]?\s*(\d{5})/i) || t.match(/\bTrain\s*[:\-#]?\s*(\d{5})(?:[ \/]+([A-Z][A-Z .]{3,30}?))?(?=\s*(?:\n|$|\s{2}|Date|Class))/i);
  if (m) {
    const nm = m[2] ? m[2].trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bExp\b/, 'Express') : '';
    out.label = m[1] + (nm ? ' ' + nm : ''); found.push('train');
  }

  // Date of journey
  m = t.match(/(?:DOJ|Date\s*of\s*Journey|Journey\s*Date|Start\s*Date\*?)\s*[:\-]?\s*([^\n,]{6,20})/i);
  const doj = m ? dateIn(m[1]) : '';

  // Class
  m = t.match(/Class\s*[:\-]?\s*[A-Za-z0-9 ()\-]*?\(?\b(1A|2A|3A|3E|SL|CC|EC|EA|2S|FC)\b\)?/i) || t.match(/,\s*(1A|2A|3A|3E|SL|CC|EC|EA|2S|FC)\s*,/);
  if (!m) m = t.match(/[,\s](1A|2A|3A|3E|SL|CC|EC|2S)[,\s]/);
  const cls = m ? m[1].toUpperCase() : '';

  // From / To — e-ticket "From : NASHIK ROAD (NK)" / "Booked From"/"Boarding At", or SMS ",NK-CSMT,"
  const fromM = t.match(/(?:Boarding\s*At|Booked\s*From|From)\s*\*?\s*[:\-]?\s*([A-Z][A-Z .]{1,40}?)\s*\(([A-Z]{2,5})\)/i);
  const toM = t.match(/(?:Reservation\s*Upto|To)\s*\*?\s*[:\-]?\s*([A-Z][A-Z .]{1,40}?)\s*\(([A-Z]{2,5})\)/i);
  if (fromM) out.from = nameWithCode(fromM[1], fromM[2].toUpperCase());
  if (toM) out.to = nameWithCode(toM[1], toM[2].toUpperCase());
  if (!fromM || !toM) {
    m = t.match(/[,\s]([A-Z]{2,5})\s*(?:-|to|→)\s*([A-Z]{2,5})[\s,]/);
    if (m) { if (!fromM) out.from = stationName(m[1]); if (!toM) out.to = stationName(m[2]); }
  }
  m = t.match(/Boarding\s*(?:at|stn)?\s*[:\-]?\s*([A-Z]{2,5})\s*only/i);
  const boardOnly = m ? m[1].toUpperCase() : '';
  if (out.from || out.to) found.push('stations');

  // Departure / arrival time (+ optional date)
  m = t.match(/Departure\*?\s*[:\-]?\s*(\d{1,2}:\d{2})\s*(?:Hrs)?\s*([0-9]{1,2}[-\/ ][A-Za-z0-9]{2,9}[-\/ ]\d{2,4})?/i) || t.match(/\bDP\s*[:\-]?\s*(\d{1,2}[:.]\d{2})/i) || t.match(/\bDEP\s*[:\-]?\s*(\d{1,2}[:.]\d{2})/i);
  if (m) { out.depTime = m[1].replace('.', ':').padStart(5, '0'); out.depDate = (m[2] && dateIn(m[2])) || doj; }
  else if (doj) out.depDate = doj;
  m = t.match(/Arrival\*?\s*[:\-]?\s*(\d{1,2}:\d{2})\s*(?:Hrs)?\s*([0-9]{1,2}[-\/ ][A-Za-z0-9]{2,9}[-\/ ]\d{2,4})?/i) || t.match(/\bARR?\s*[:\-]?\s*(\d{1,2}[:.]\d{2})/i);
  if (m) {
    out.arrTime = m[1].replace('.', ':').padStart(5, '0');
    out.arrDate = (m[2] && dateIn(m[2])) || (out.depDate ? (out.depTime && out.arrTime < out.depTime ? addDays(out.depDate, 1) : out.depDate) : '');
  }
  if (out.depDate) found.push('date');
  if (out.depTime) found.push('time');

  // Seat / status: "CNF/C4/37/WINDOW SIDE", SMS "NAME,C4 37," or "B2 34", waitlist "WL 12" / "RLWL/5"
  const seats = []; let status = '';
  const cnf = [...t.matchAll(/\b(?:CNF|Confirmed)\s*\/\s*([A-Z]{1,3}\d{0,2})\s*\/\s*(\d{1,3})(?:\s*\/\s*([A-Z][A-Z ]{2,20}?))?(?=\s*(?:\n|,|\s{2}|$|CNF|WL|RAC))/gi)];
  cnf.forEach((x) => seats.push(`${x[1].toUpperCase()} · ${x[2]}${x[3] ? ' (' + x[3].trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) + ')' : ''}`));
  if (!seats.length) {
    [...t.matchAll(/,\s*([A-Z]{1,2}\d{1,2})\s+(\d{1,3})\b/g)].forEach((x) => seats.push(`${x[1]} · ${x[2]}`));
  }
  m = t.match(/\b(RLWL|GNWL|PQWL|TQWL|WL|RAC)\s*[\/ ]?\s*(\d{1,3})\b/i);
  if (m && !seats.length) status = m[1].toUpperCase() + ' ' + m[2];
  if (seats.length) { out.seat = [...new Set(seats)].join(', '); found.push('seat'); } else if (status) { out.seat = status; found.push('status'); }

  // Extras go in the notes
  const notes = [];
  if (cls) notes.push('Class: ' + (CLASSES[cls] ? CLASSES[cls] + ' (' + cls + ')' : cls));
  if (boardOnly) notes.push('Boarding at ' + stationName(boardOnly));
  m = t.match(/(?:Total\s*)?Fare\s*[:\-]?\s*(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d+)?)/i); if (m) notes.push('Fare: ₹' + m[1].replace(/,$/, ''));
  if (status && seats.length) notes.push('Status: ' + status);
  if (notes.length) out.note = notes.join(' · ');
  out.found = found;
  return out;
}

export const PNR_URL = 'https://www.indianrail.gov.in/enquiry/PNR/PnrEnquiry.html?locale=en';
