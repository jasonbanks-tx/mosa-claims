// api/send-claim.js  — Vercel Serverless Function
// Updated: 2026-06-02
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { customerName, customerEmail, jobDate } = req.body;

    if (!customerName || !customerEmail || !jobDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!process.env.CLAIMS_EMAIL_PASS) {
      console.error('CLAIMS_EMAIL_PASS env var is not set');
      return res.status(500).json({ error: 'Email not configured on server — contact admin' });
    }

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

Thank you for contacting Movers of San Antonio regarding your move on ${formattedDate}. We have received your request to file a claim for loss or damage.

Please find the attached Claim for Loss and Damage form. Complete the form with as much detail as possible and return it to us by:

  • Email: claims.mosa@gmail.com
  • Mail: 6977 San Pedro Ave, San Antonio, TX 78216

NOTICE OF YOUR RIGHTS — REQUIRED BY TEXAS LAW (43 TAC §218.61):

"Household goods carriers have 90 days from receipt of a claim to pay, decline to pay, or make a firm settlement offer, in writing, to a claimant. Questions or complaints concerning the household goods carrier's claims handling should be directed to the Texas Department of Motor Vehicles (TxDMV), Enforcement Division, via the toll-free consumer helpline as listed on the department's website. Additionally, a claimant has the right to request mediation from TxDMV within 35 days after any portion of the claim is denied by the carrier, the carrier makes a firm settlement offer that is not acceptable to the claimant, or 90 days has elapsed since the carrier received the claim and the claim has not been resolved."

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

    // Log to Supabase
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

  } catch (err) {
    console.error('send-claim error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Server error — please try again' });
  }
}
