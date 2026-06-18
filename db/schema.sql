-- Fox AI Hub Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'staff',  -- 'admin' or 'staff'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portals (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(500) NOT NULL,
  icon VARCHAR(100) DEFAULT 'ti-layout-dashboard',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  portal_id INTEGER REFERENCES portals(id) ON DELETE CASCADE,
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by INTEGER REFERENCES users(id),
  UNIQUE(user_id, portal_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR(255) PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP NOT NULL
);

-- Seed portals
INSERT INTO portals (name, description, url, icon) VALUES
  ('Leyland Tenders', 'Manage and track tender submissions for Fox Brothers Leyland.', 'https://leylandtenders.foxgroup.ai', 'ti-file-invoice'),
  ('DSD Dashboard', 'DSD construction tender tracking and reporting dashboard.', 'https://dsd-dashboard-production-2143.up.railway.app', 'ti-chart-bar'),
  ('Recruitment Hub', 'Candidate pipeline and recruitment management.', 'https://recruitment-hub-production.up.railway.app', 'ti-users'),
  ('KPI Reporting', 'Business KPI tracking and performance reporting across Fox Group.', 'http://n545bcpte6l23zjhacpskxch.178.104.154.216.sslip.io', 'ti-report-analytics')
ON CONFLICT DO NOTHING;

-- Seed default admin (password: Admin1234! — change immediately)
-- bcrypt hash of 'Admin1234!'
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Fox Admin', 'admin@foxgroup.ai', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaWkalWESvbgFbJpE9V3h4xQy', 'admin')
ON CONFLICT DO NOTHING;
