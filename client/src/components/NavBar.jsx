import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import * as authApi from '../api/auth.js';

export default function NavBar() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await authApi.logout();
    setUser(null);
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <Link to="/projects" className="navbar-brand">
        ◈ DevLoop Mini
      </Link>
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {user.email}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
