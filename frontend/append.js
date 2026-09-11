const newCSS = `
.login-split-container {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: 999999;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(-45deg, #0f172a, #1e1b4b, #312e81, #0f172a);
  background-size: 400% 400%;
  animation: gradientBG 15s ease infinite;
  font-family: 'Outfit', sans-serif;
  overflow: hidden;
}

@keyframes gradientBG {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.login-split-container::before {
  content: '';
  position: absolute;
  top: -20%; left: -10%;
  width: 50vw; height: 50vw;
  background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
  border-radius: 50%;
  filter: blur(60px);
  animation: floatOrb 10s infinite alternate;
}

.login-split-container::after {
  content: '';
  position: absolute;
  bottom: -20%; right: -10%;
  width: 40vw; height: 40vw;
  background: radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%);
  border-radius: 50%;
  filter: blur(60px);
  animation: floatOrb 12s infinite alternate-reverse;
}

@keyframes floatOrb {
  0% { transform: translate(0, 0); }
  100% { transform: translate(30px, -30px); }
}

.login-hero-side {
  display: none;
}

.login-form-side {
  z-index: 10;
  width: 100%;
  max-width: 440px;
  margin: 0 20px;
  background: transparent;
}

.login-form-side::before {
  display: none;
}

.login-card-floating {
  width: 100%;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-left: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  padding: 3rem 2.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  color: #f8fafc;
  transform: translateY(0);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.login-card-floating:hover {
  transform: translateY(-5px);
  box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.6);
}

.login-card-header h2 {
  font-size: 2.2rem;
  font-weight: 800;
  color: #f8fafc;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.login-card-header p {
  font-size: 0.95rem;
  color: #94a3b8;
  margin-bottom: 2rem;
}

.login-type-toggle {
  display: flex;
--
  content = content.replace(regex, newCSS);
  fs.writeFileSync(path, content, 'utf8');
  console.log('CSS patched.');
} else {
  console.log('Regex did not match.');
}
