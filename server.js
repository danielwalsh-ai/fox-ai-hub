require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new pgSession({ pool, tableName: 'sessions' }),
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ───────────────────────────────────────────────

app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/hub');
  }
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/hub');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/hub', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hub.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ─── Auth API ─────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    req.session.userId = user.id;
    req.session.name = user.name;
    req.session.role = user.role;

    res.json({ success: true, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    id: req.session.userId,
    name: req.session.name,
    role: req.session.role
  });
});

// ─── Portals API ──────────────────────────────────────────

app.get('/api/portals', requireAuth, async (req, res) => {
  try {
    let portals;
    if (req.session.role === 'admin') {
      const result = await pool.query('SELECT * FROM portals WHERE active = true ORDER BY id');
      portals = result.rows;
    } else {
      const result = await pool.query(`
        SELECT p.* FROM portals p
        INNER JOIN user_permissions up ON up.portal_id = p.id
        WHERE up.user_id = $1 AND p.active = true
        ORDER BY p.id
      `, [req.session.userId]);
      portals = result.rows;
    }
    res.json(portals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Admin: Users API ─────────────────────────────────────

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.created_at,
        COALESCE(
          json_agg(
            json_build_object('portal_id', up.portal_id, 'portal_name', p.name)
          ) FILTER (WHERE up.portal_id IS NOT NULL),
          '[]'
        ) AS permissions
      FROM users u
      LEFT JOIN user_permissions up ON up.user_id = u.id
      LEFT JOIN portals p ON p.id = up.portal_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { name, email, password, role, portal_ids } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const userResult = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email.toLowerCase(), hash, role || 'staff']
    );
    const userId = userResult.rows[0].id;

    if (portal_ids && portal_ids.length > 0) {
      for (const portalId of portal_ids) {
        await pool.query(
          'INSERT INTO user_permissions (user_id, portal_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [userId, portalId, req.session.userId]
        );
      }
    }

    res.json({ success: true, id: userId });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const { name, email, role, portal_ids, password } = req.body;
  const userId = req.params.id;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        'UPDATE users SET name=$1, email=$2, role=$3, password_hash=$4, updated_at=NOW() WHERE id=$5',
        [name, email.toLowerCase(), role, hash, userId]
      );
    } else {
      await pool.query(
        'UPDATE users SET name=$1, email=$2, role=$3, updated_at=NOW() WHERE id=$4',
        [name, email.toLowerCase(), role, userId]
      );
    }

    await pool.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
    if (portal_ids && portal_ids.length > 0) {
      for (const portalId of portal_ids) {
        await pool.query(
          'INSERT INTO user_permissions (user_id, portal_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [userId, portalId, req.session.userId]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (parseInt(userId) === req.session.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/portals', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM portals ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Start ────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Fox AI Hub running on port ${PORT}`);
});
