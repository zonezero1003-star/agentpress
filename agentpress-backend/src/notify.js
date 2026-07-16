import { query } from './db.js';

// TODO: wire up a real WhatsApp Business API / email provider (e.g. Twilio,
// Resend) here. For now this persists the notification so the console
// dashboard has something real to show, and logs to stdout for local testing.
export async function notifyOwner({ business, order, channel, message }) {
  const [notification] = await query(
    `INSERT INTO notifications (business_id, order_id, channel, message, status)
     VALUES ($1,$2,$3,$4,'pending') RETURNING *`,
    [business.id, order?.id || null, channel, message]
  );

  try {
    console.log(`[notify:${channel}] -> ${business.name}: ${message}`);
    await query(`UPDATE notifications SET status='sent', sent_at=now() WHERE id=$1`, [notification.id]);
  } catch (err) {
    await query(`UPDATE notifications SET status='failed' WHERE id=$1`, [notification.id]);
  }

  return notification;
}
