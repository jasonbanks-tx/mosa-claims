// api/send-claim.js  — Vercel Serverless Function
// Place at: /api/send-claim.js in the movers-of-san-antonio repo root

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customerName, customerEmail, jobDate } = req.body;

  if (!customerName || !customerEmail || !jobDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // ── 1. Send email ────────────────────────────────────────────────────────
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'claims.mosa@gmail.com',
      pass: process.env.CLAIMS_EMAIL_PASS
    }
  });

  const pdfPath = path.join(process.cwd(), 'public', 'claim-form.pdf');
  const pdfBuffer = fs.readFileSync(pdfPath);

  const formattedDate = new Date(jobDate + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  const emailBody = `Dear ${customerName},

Thank you for contacting Movers of San Antonio. We have received your request to file a claim regarding your move on ${formattedDate}.

Please find the attached Claim for Loss and Damage form. Complete the form with as much detail as possible and return it to us by:

  • Email: claims.mosa@gmail.com
  • Mail: 6977 San Pedro Ave, San Antonio, TX 78216

Once we receive your completed claim form, we will begin our investigation and respond within 90 days as required by Texas law (43 TAC §218.61).

If you have any questions, please reply to this email or call us at (210) 348-8199.

Sincerely,
Claims Department
Movers of San Antonio
TxDMV No. 006770930C
(210) 348-8199
claims.mosa@gmail.com`;

  await transporter.sendMail({
    from: '"Movers of San Antonio Claims" <claims.mosa@gmail.com>',
    to: customerEmail,
    subject: `Movers of San Antonio — Claim Form for Your Move on ${formattedDate}`,
    text: emailBody,
    attachments: [
      {
        filename: 'MOSA-Claim-Form.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });

  // ── 2. Log to Supabase ───────────────────────────────────────────────────
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    await supabase.from('claim_sends').insert({
      customer_name:  customerName,
      customer_email: customerEmail,
      job_date:       jobDate,
      sent_at:        new Date().toISOString()
    });
  } catch (logErr) {
    console.error('Supabase log error:', logErr.message);
  }

  return res.status(200).json({ success: true });
}
