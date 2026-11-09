// Minimaler SMTP-Client (SMTPS, Port 465, AUTH LOGIN). Funktioniert mit jedem Mailanbieter.
import tls from 'node:tls';
import { cfg } from './config.js';

export function smtpSenden({ an, betreff, text, cc = [], html = '', antwort = '', name = '', anh = [] }) {
  const s = cfg.smtp;
  return new Promise((ok, fail) => {
    const sock = tls.connect({ host: s.host, port: s.port, servername: s.host });
    sock.setEncoding('utf8'); sock.setTimeout(20000, () => { sock.destroy(); fail(new Error('SMTP Zeitüberschreitung')); });
    let buf = '', schritt = 0;
    const b64 = x => Buffer.from(x).toString('base64');
    const saubere = x => String(x).replace(/[\r\n]+/g, ' ');
    const umbr = x => Buffer.from(x).toString('base64').replace(/(.{76})/g, '$1\r\n');
    const kopf = [`From: ${name ? `=?UTF-8?B?${b64(saubere(name))}?= ` + '<' + (s.from.match(/<([^>]+)>/) || [null, s.from])[1] + '>' : saubere(s.from)}`, `To: ${saubere(an)}`, ...(cc.length ? [`Cc: ${saubere(cc.join(', '))}`] : []), ...(antwort ? [`Reply-To: ${saubere(antwort)}`] : []), `Subject: =?UTF-8?B?${b64(betreff)}?=`, 'MIME-Version: 1.0'];
    const teilText = html ? ['--alt', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', umbr(text), '--alt', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', umbr(html), '--alt--'] : null;
    let nachricht;
    if (!anh.length && !html) nachricht = [...kopf, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', umbr(text)].join('\r\n');
    else if (!anh.length) nachricht = [...kopf, 'Content-Type: multipart/alternative; boundary="alt"', '', ...teilText].join('\r\n');
    else nachricht = [...kopf, 'Content-Type: multipart/mixed; boundary="mix"', '', '--mix', ...(html ? ['Content-Type: multipart/alternative; boundary="alt"', '', ...teilText] : ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', umbr(text)]),
      ...anh.flatMap(a => ['--mix', `Content-Type: ${a.typ}; name="${a.name}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${a.name}"`, '', umbr(a.inhalt)]), '--mix--'].join('\r\n');
    const adr = x => (x.match(/<([^>]+)>/) || [null, x])[1];
    const plan = [null, 'EHLO bau', 'AUTH LOGIN', b64(s.user), b64(s.pass), `MAIL FROM:<${adr(s.from)}>`, ...[an, ...cc].flatMap(x => String(x).split(',')).map(x => `RCPT TO:<${saubere(x).trim()}>`), 'DATA', nachricht + '\r\n.', 'QUIT'];
    const nRcpt = plan.filter(x => String(x).startsWith('RCPT TO')).length; const erwartet = [220, 250, 334, 334, 235, 250, ...Array(nRcpt).fill(250), 354, 250, 221];
    sock.on('data', d => {
      buf += d; const zeilen = buf.split('\r\n'); if (!zeilen[zeilen.length - 2] || /^\d{3}-/.test(zeilen[zeilen.length - 2])) return;
      const code = +buf.trim().split('\r\n').pop().slice(0, 3); buf = '';
      if (code !== erwartet[schritt]) { sock.destroy(); return fail(new Error('SMTP ' + code + ' bei Schritt ' + schritt)); }
      schritt++; if (schritt >= plan.length) { sock.end(); return ok(); }
      sock.write(plan[schritt] + '\r\n');
    });
    sock.on('error', fail);
  });
}
