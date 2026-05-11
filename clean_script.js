/* GRABIX - script.js */

document.addEventListener('DOMContentLoaded', function() {
  initParticles();
  checkSession();
  initEmailJS();
});

/* AUTH */
var _memUsers = [];
var _memSession = false;

function getUsers() {
  try { return JSON.parse(localStorage.getItem('grabix_users') || '[]'); }
  catch(e) { return _memUsers; }
}
function saveUsers(u) {
  _memUsers = u;
  try { localStorage.setItem('grabix_users', JSON.stringify(u)); } catch(e) {}
}
function setSession(email) {
  _memSession = email;
  try { localStorage.setItem('grabix_session', email); } catch(e) {}
}
function getSession() {
  if (_memSession) return _memSession;
  try { return localStorage.getItem('grabix_session'); } catch(e) { return null; }
}
function clearSession() {
  _memSession = false;
  try { localStorage.removeItem('grabix_session'); } catch(e) {}
}

function checkSession() {
  if (getSession()) showApp();
}

function showLogin() {
  document.getElementById('signupCard').classList.remove('active');
  document.getElementById('loginCard').classList.add('active');
  clearErrors();
}
function showSignup() {
  document.getElementById('loginCard').classList.remove('active');
  document.getElementById('signupCard').classList.add('active');
  clearErrors();
}
function clearErrors() {
  document.getElementById('su-error').textContent = '';
  document.getElementById('li-error').textContent = '';
}

function handleSignup() {
  var username = document.getElementById('su-username').value.trim();
  var email    = document.getElementById('su-email').value.trim().toLowerCase();
  var password = document.getElementById('su-password').value;
  var errEl    = document.getElementById('su-error');

  // Check all fields filled
  if (!username || !email || !password) {
    errEl.textContent = 'Please fill in all fields.';
    return;
  }

  // Validate username (min 3 chars, no spaces)
  if (username.length < 3) {
    errEl.textContent = 'Username must be at least 3 characters.';
    return;
  }

  // Validate email format
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email)) {
    errEl.textContent = 'Please enter a valid email address (e.g. name@gmail.com).';
    return;
  }

  // Validate password strength
  if (password.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.';
    return;
  }
  if (!/[A-Z]/.test(password)) {
    errEl.textContent = 'Password must contain at least one uppercase letter.';
    return;
  }
  if (!/[0-9]/.test(password)) {
    errEl.textContent = 'Password must contain at least one number.';
    return;
  }

  var users = getUsers();
  if (users.find(function(u){ return u.email === email; })) {
    errEl.textContent = 'An account with this email already exists.';
    return;
  }

  users.push({ username: username, email: email, password: password });
  saveUsers(users);
  setSession(email);
  showApp();
}

function handleLogin() {
  var email    = document.getElementById('li-email').value.trim().toLowerCase();
  var password = document.getElementById('li-password').value;
  var errEl    = document.getElementById('li-error');
  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  var user = getUsers().find(function(u){ return u.email === email && u.password === password; });
  if (!user) { errEl.textContent = 'Incorrect email or password.'; return; }
  setSession(email);
  showApp();
}

function logout() { clearSession(); location.reload(); }

function showApp() {
  var overlay = document.getElementById('authOverlay');
  overlay.style.transition = 'opacity 0.5s ease';
  overlay.style.opacity = '0';
  setTimeout(function() {
    overlay.classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    navigate('home');
  }, 500);
}

/* NAVIGATION */
function navigate(id) {
  document.querySelectorAll('.section').forEach(function(s) {
    s.classList.remove('active-section');
    s.style.display = 'none';
  });
  var target = document.getElementById(id);
  if (target) {
    target.style.display = 'flex';
    requestAnimationFrame(function(){ target.classList.add('active-section'); });
  }
  document.querySelectorAll('.nav-link').forEach(function(a) {
    a.classList.remove('active');
    if (a.getAttribute('onclick') && a.getAttribute('onclick').indexOf("'" + id + "'") !== -1) {
      a.classList.add('active');
    }
  });
  closeMenu();
}

function toggleMenu() {
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('navLinks').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('navLinks').classList.remove('open');
}

/* VIDEO DOWNLOADER - direct download through server */
function clearUrl() {
  document.getElementById('videoUrl').value = '';
  document.getElementById('videoUrl').focus();
  document.getElementById('grabStatus').classList.add('hidden');
  document.getElementById('resultCard').classList.add('hidden');
}

function grabVideo() {
  var url      = document.getElementById('videoUrl').value.trim();
  var quality  = document.getElementById('qualitySelect').value;
  var format   = document.getElementById('formatSelect').value;
  var statusEl = document.getElementById('grabStatus');
  var resultEl = document.getElementById('resultCard');
  var grabBtn  = document.getElementById('grabBtn');

  resultEl.classList.add('hidden');
  statusEl.className = 'grab-status loading';
  statusEl.classList.remove('hidden');
  statusEl.textContent = 'Fetching video info...';

  if (!url) { showError('Please paste a video URL first.'); return; }
  if (url.indexOf('http') !== 0) { showError('Please enter a valid URL starting with https://'); return; }

  grabBtn.disabled = true;
  grabBtn.querySelector('.grab-label').textContent = 'Loading...';

  fetch('/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url })
  })
  .then(function(r) { return r.json(); })
  .then(function(info) {
    var title = info.title || extractSiteFromUrl(url) + ' video';
    var site  = info.site  || extractSiteFromUrl(url);
    var ytId  = extractYouTubeId(url);
    var thumb = info.thumbnail || (ytId ? 'https://img.youtube.com/vi/' + ytId + '/mqdefault.jpg' : '');

    statusEl.textContent = 'Getting download link...';

    fetch('/grab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, quality: quality, format: format })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        showError(data.error);
        grabBtn.disabled = false;
        grabBtn.querySelector('.grab-label').textContent = 'Grab Video';
        return;
      }

      statusEl.classList.add('hidden');
      document.getElementById('resultTitle').textContent = data.title || title;
      document.getElementById('resultSite').textContent  = site + ' - Click Download to save';

      var thumbEl = document.getElementById('resultThumb');
      if (thumb) { thumbEl.src = thumb; thumbEl.style.display = 'block'; }
      else { thumbEl.style.display = 'none'; }

      var dlLink = document.getElementById('downloadLink');
      dlLink.href = '#';
      dlLink.textContent = format === 'mp3' ? 'Download MP3' : 'Download Video';
      dlLink.onclick = function(e) {
        e.preventDefault();
        dlLink.textContent = 'Downloading...';
        dlLink.style.opacity = '0.6';

        var proxyUrl = '/proxy?url=' + encodeURIComponent(data.direct_url)
                     + '&filename=' + encodeURIComponent(data.filename)
                     + '&format=' + encodeURIComponent(format);

        fetch(proxyUrl)
          .then(function(r) {
            if (!r.ok) throw new Error('Server error ' + r.status);
            return r.blob();
          })
          .then(function(blob) {
            var a = document.createElement('a');
            var burl = URL.createObjectURL(blob);
            a.href = burl;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(burl);
            dlLink.textContent = format === 'mp3' ? 'Download MP3' : 'Download Video';
            dlLink.style.opacity = '1';
          })
          .catch(function(err) {
            dlLink.textContent = format === 'mp3' ? 'Download MP3' : 'Download Video';
            dlLink.style.opacity = '1';
            showError('Download failed: ' + err.message);
          });
      };

      resultEl.classList.remove('hidden');
      grabBtn.disabled = false;
      grabBtn.querySelector('.grab-label').textContent = 'Grab Video';
      playSuccessSound();
    })
    .catch(function() {
      showError('Could not get download link. Please try again.');
      grabBtn.disabled = false;
      grabBtn.querySelector('.grab-label').textContent = 'Grab Video';
    });
  })
  .catch(function() {
    showError('Could not connect to server. Please try again.');
    grabBtn.disabled = false;
    grabBtn.querySelector('.grab-label').textContent = 'Grab Video';
  });
}
function showResult(title, site, thumb, dlUrl) {
  var statusEl = document.getElementById('grabStatus');
  var resultEl = document.getElementById('resultCard');
  statusEl.classList.add('hidden');
  document.getElementById('resultTitle').textContent = title || 'Video Ready';
  document.getElementById('resultSite').textContent  = site  || 'Download ready';
  var thumbEl = document.getElementById('resultThumb');
  if (thumb) { thumbEl.src = thumb; thumbEl.style.display = 'block'; }
  else { thumbEl.style.display = 'none'; }
  var dlLink = document.getElementById('downloadLink');
  dlLink.href = dlUrl;
  dlLink.setAttribute('download', '');
  resultEl.classList.remove('hidden');
}

function showError(msg) {
  var statusEl = document.getElementById('grabStatus');
  statusEl.className = 'grab-status error';
  statusEl.textContent = msg;
  statusEl.classList.remove('hidden');
  document.getElementById('resultCard').classList.add('hidden');
}

function extractSiteFromUrl(url) {
  try {
    var host = new URL(url).hostname.replace('www.', '');
    if (host.indexOf('youtube') !== -1 || host.indexOf('youtu.be') !== -1) return 'YouTube';
    if (host.indexOf('tiktok') !== -1)    return 'TikTok';
    if (host.indexOf('twitter') !== -1 || host.indexOf('x.com') !== -1) return 'Twitter / X';
    if (host.indexOf('instagram') !== -1) return 'Instagram';
    if (host.indexOf('vimeo') !== -1)     return 'Vimeo';
    if (host.indexOf('reddit') !== -1)    return 'Reddit';
    if (host.indexOf('facebook') !== -1)  return 'Facebook';
    return host;
  } catch(e) { return 'Video'; }
}

function extractYouTubeId(url) {
  var m = url.match(/(?:v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/* EMAILJS */
var EMAILJS_PUBLIC_KEY  = 'I9hb3IS78zZgyT-pk';
var EMAILJS_SERVICE_ID  = 'service_b2tf0va';
var EMAILJS_TEMPLATE_ID = 'template_v06c0rh';
var TO_EMAIL            = 'yards1237@gmail.com';

function initEmailJS() {
  // Try multiple times to init EmailJS
  var attempts = 0;
  function tryInit() {
    attempts++;
    if (typeof emailjs !== 'undefined') {
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      console.log('EmailJS initialized!');
    } else if (attempts < 10) {
      setTimeout(tryInit, 500);
    }
  }
  tryInit();
  window.addEventListener('load', tryInit);
}

function submitContact() {
  var name   = document.getElementById('c-name').value.trim();
  var email  = document.getElementById('c-email').value.trim();
  var msg    = document.getElementById('c-msg').value.trim();
  var errEl  = document.getElementById('contact-error');
  var sucEl  = document.getElementById('contact-success');
  var btn    = document.querySelector('#contact .btn-primary');

  errEl.textContent = '';
  sucEl.classList.add('hidden');

  if (!name || !email || !msg) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (typeof emailjs === 'undefined') { errEl.textContent = 'Email service not loaded. Check your internet.'; return; }

  btn.disabled = true;
  btn.textContent = 'Sending...';

  // Re-init just before sending
  try { emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY }); } catch(e) {}

  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    from_name:  name,
    from_email: email,
    message:    msg,
    to_email:   TO_EMAIL,
    reply_to:   email,
  }).then(function() {
    sucEl.classList.remove('hidden');
    document.getElementById('c-name').value  = '';
    document.getElementById('c-email').value = '';
    document.getElementById('c-msg').value   = '';
  }).catch(function(err) {
    console.error('EmailJS error:', err);
    errEl.textContent = 'Failed to send. Please try again.';
  }).finally(function() {
    btn.disabled = false;
    btn.textContent = 'Send Message';
  });
}

/* SOUND */
var _ctx = null;
function getAudioCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}
function playSuccessSound() {
  try {
    var ctx = getAudioCtx();
    [523, 659, 784, 1047].forEach(function(freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      var t = ctx.currentTime + i * 0.1;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.32);
    });
  } catch(e) {}
}

/* PARTICLES */
function initParticles() {
  var canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  var COUNT = 70, COLOR = '0, 229, 255', CONNECT = 130;
  var particles = [];
  for (var i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      a: Math.random() * 0.5 + 0.1
    });
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(function(p) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + COLOR + ',' + p.a + ')';
      ctx.fill();
    });
    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < CONNECT) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = 'rgba(' + COLOR + ',' + (1-dist/CONNECT)*0.18 + ')';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}
