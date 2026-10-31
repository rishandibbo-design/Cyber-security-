/* One-to-one, consent-first WebRTC demonstration. No automatic capture. */
'use strict';
const socket = io();
const $ = (id) => document.getElementById(id);
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const viewMatch = location.pathname.match(/^\/view\/([0-9a-f]{32})$/);
const mode = viewMatch ? 'view' : location.pathname === '/share' ? 'share' : 'home';
$(mode === 'view' ? 'viewer' : mode === 'share' ? 'sharer' : 'home').hidden = false;
let room = viewMatch?.[1] || null;
let pc = null;
let stream = null;
let iceQueue = [];
let viewerConnected = false;

function setStatus(id, message) { $(id).textContent = message; }
function send(packet) { if (room && socket.connected) socket.emit('signal', { room, packet }); }
function cleanupPeer() { if (pc) { pc.onicecandidate = null; pc.close(); pc = null; } iceQueue = []; }
function newPeer(viewer) {
  cleanupPeer();
  pc = new RTCPeerConnection(config);
  pc.onicecandidate = (e) => { if (e.candidate) send({ type:'candidate', candidate:e.candidate.toJSON() }); };
  pc.onconnectionstatechange = () => {
    if (pc?.connectionState === 'failed') setStatus(viewer ? 'viewerStatus' : 'sharerStatus', 'Connection failed. The networks may require a TURN relay server.');
  };
  if (viewer) {
    pc.ontrack = async (e) => {
      $('remote').srcObject = e.streams[0] || new MediaStream([e.track]);
      $('empty').hidden = true;
      setStatus('viewerStatus', 'Live screen is being shared with you.');
      try { await $('remote').play(); } catch { $('play').hidden = false; }
    };
  } else if (stream) {
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }
  return pc;
}
async function flushCandidates() {
  while (iceQueue.length && pc?.remoteDescription) {
    try { await pc.addIceCandidate(iceQueue.shift()); } catch (err) { console.warn('ICE error', err); }
  }
}
socket.on('signal', async packet => {
  try {
    if (packet.type === 'offer' && mode === 'view') {
      const peer = newPeer(true);
      await peer.setRemoteDescription({type:'offer', sdp:packet.sdp});
      await flushCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      send({type:'answer', sdp:answer.sdp});
    } else if (packet.type === 'answer' && mode === 'share' && pc) {
      await pc.setRemoteDescription({type:'answer', sdp:packet.sdp});
      await flushCandidates();
      setStatus('sharerStatus', 'Sharing live with the connected viewer.');
    } else if (packet.type === 'candidate') {
      if (pc?.remoteDescription) await pc.addIceCandidate(packet.candidate);
      else iceQueue.push(packet.candidate);
    }
  } catch (err) { console.error(err); setStatus(mode === 'view' ? 'viewerStatus' : 'sharerStatus', 'Connection error. Refresh and try again.'); }
});

function stopSharing(notify=true) {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  cleanupPeer();
  $('preview').srcObject = null;
  $('preview').hidden = true;
  $('active').hidden = true;
  $('stop').disabled = true;
  $('start').disabled = !viewerConnected || !navigator.mediaDevices?.getDisplayMedia;
  if (notify) socket.emit('sharing-stopped', {room});
  setStatus('sharerStatus', viewerConnected ? 'Viewer connected. Screen sharing stopped.' : 'Waiting for a viewer to connect.');
}

if (mode === 'share') {
  socket.on('connect', () => {
    if (room) return;
    socket.emit('create-room', (result) => {
      if (!result?.ok) return setStatus('sharerStatus', 'Could not create session.');
      room = result.room;
      $('invite').value = location.origin + '/view/' + room;
      setStatus('sharerStatus', 'Invitation created. Send the link to your phone and open it there.');
    });
  });
  socket.on('viewer-joined', () => {
    viewerConnected = true;
    $('start').disabled = !navigator.mediaDevices?.getDisplayMedia;
    setStatus('sharerStatus', navigator.mediaDevices?.getDisplayMedia ? 'Viewer connected. Click “Start screen sharing” and approve the browser prompt.' : 'Viewer connected. Your browser does not support sharing its screen. Try desktop Chrome or Edge.');
  });
  socket.on('viewer-left', () => { viewerConnected = false; stopSharing(); });
  socket.on('session-ended', () => { stopSharing(false); room=null; setStatus('sharerStatus', 'Session expired. Refresh to create a new link.'); });
  socket.on('disconnect', () => { if (stream) stopSharing(false); setStatus('sharerStatus','Disconnected from signaling server. Refresh the page.'); });
  $('copy').onclick = async () => {
    if (!$('invite').value) return;
    try { await navigator.clipboard.writeText($('invite').value); $('copy').textContent = 'Copied'; } catch { $('invite').select(); $('copy').textContent = 'Select and copy the link'; }
  };
  $('start').onclick = async () => {
    if (!room || !viewerConnected || stream) return;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      stream.getVideoTracks()[0].addEventListener('ended', () => stopSharing(), {once:true});
      $('preview').srcObject = stream;
      $('preview').hidden = false;
      $('active').hidden = false;
      $('start').disabled = true;
      $('stop').disabled = false;
      const peer = newPeer(false);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send({ type:'offer', sdp:offer.sdp });
      setStatus('sharerStatus','Sharing started. Establishing secure video connection…');
    } catch (err) {
      console.error(err);
      stopSharing(false);
      setStatus('sharerStatus', err.name === 'NotAllowedError' ? 'Screen sharing was cancelled or not permitted.' : 'Could not share screen: ' + err.message);
    }
  };
  $('stop').onclick = () => stopSharing();
}
if (mode === 'view') {
  function join() {
    socket.emit('join-room', {room}, result => {
      if (!result?.ok) return setStatus('viewerStatus', result?.error || 'Could not join.');
      setStatus('viewerStatus', 'Connected. Waiting for the sharer to approve screen sharing.');
    });
  }
  socket.on('connect', join);
  socket.on('sharing-stopped', () => {
    cleanupPeer(); $('remote').srcObject=null; $('empty').hidden=false;
    $('play').hidden=true; setStatus('viewerStatus','The sharer stopped sharing.');
  });
  socket.on('session-ended', () => {
    cleanupPeer(); $('remote').srcObject=null; $('empty').hidden=false;
    setStatus('viewerStatus','Session ended or expired.');
  });
  socket.on('disconnect', () => {
    cleanupPeer(); $('remote').srcObject=null; $('empty').hidden=false;
    setStatus('viewerStatus','Connection lost. Reconnecting…');
  });
  $('play').onclick = async () => { try { await $('remote').play(); $('play').hidden=true; } catch { setStatus('viewerStatus','Tap the video to play.'); } };
}
