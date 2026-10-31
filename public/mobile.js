'use strict';
const byId = (id) => document.getElementById(id);
const details = byId('details');
const invite = byId('mobileInvite');
const openMeeting = byId('openMeeting');
byId('generate').addEventListener('click', () => {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const url = 'https://meet.jit.si/ClearShareMobile' + token;
  invite.value = url;
  openMeeting.href = url;
  details.hidden = false;
  byId('copyMobile').textContent = 'Copy invitation';
});
byId('copyMobile').addEventListener('click', async () => {
  if (!invite.value) return;
  try {
    await navigator.clipboard.writeText(invite.value);
    byId('copyMobile').textContent = 'Copied!';
  } catch {
    invite.focus(); invite.select();
    byId('copyMobile').textContent = 'Select the link to copy';
  }
});
byId('shareMobile').addEventListener('click', async () => {
  if (!invite.value) return;
  if (navigator.share) {
    try { await navigator.share({title:'Join my screen-sharing meeting', text:'Join the Jitsi Meet session:', url:invite.value}); }
    catch (e) { if (e.name !== 'AbortError') console.warn(e); }
  } else {
    try { await navigator.clipboard.writeText(invite.value); byId('shareMobile').textContent = 'Invitation copied!'; }
    catch { invite.focus(); invite.select(); }
  }
});
