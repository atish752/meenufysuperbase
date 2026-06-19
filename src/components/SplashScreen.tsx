export default function SplashScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      {/* Logo ring */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          border: '2px solid var(--brand)',
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 28 }}>🍽️</span>
        </div>
      </div>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900,
        color: 'var(--brand)', letterSpacing: '-0.02em',
        filter: 'drop-shadow(0 0 20px rgba(255, 125, 0, 0.4))',
        marginBottom: 6,
      }}>
        Meenufy
      </h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        Loading Experience...
      </p>
    </div>
  );
}
