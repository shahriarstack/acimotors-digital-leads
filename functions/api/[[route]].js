import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { Pool } from '@neondatabase/serverless';

const app = new Hono().basePath('/api');

// --- Middleware: Database Connection ---
app.use('*', async (c, next) => {
    // 1. Connect to Neon using the Env Variable provided by Cloudflare
    if (!c.env.DATABASE_URL) {
        return c.json({ error: 'DATABASE_URL not set' }, 500);
    }
    const pool = new Pool({ connectionString: c.env.DATABASE_URL });
    c.set('pool', pool);
    
    await next();
    
    // 2. Cleanup connection (Best practice for serverless)
    c.executionCtx.waitUntil(pool.end());
});

// --- API Routes ---

// 1. Init Data
app.get('/init', async (c) => {
    const pool = c.get('pool');
    try {
        const businessesRes = await pool.query('SELECT * FROM businesses');
        const officersRes = await pool.query('SELECT * FROM officers');

        const businesses = businessesRes.rows.map(b => b.name);
        const icons = {};
        businessesRes.rows.forEach(b => {
            if (b.icon) icons[b.name] = b.icon;
        });

        return c.json({
            businesses,
            icons,
            officers: officersRes.rows
        });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// 2. Customers CRUD
app.get('/customers', async (c) => {
    const pool = c.get('pool');
    const business = c.req.query('business');
    try {
        let query = 'SELECT * FROM customers';
        const params = [];
        
        if (business) {
            query += ' WHERE business = $1';
            params.push(business);
        }
        
        const result = await pool.query(query, params);
        return c.json(result.rows);
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/customers', async (c) => {
    const pool = c.get('pool');
    try {
        const cust = await c.req.json();
        const query = `
            INSERT INTO customers (
                id, customer_no, name, date, address, model, sale_type, 
                officer_id, officer_name, business, visit_completed, 
                customer_type, field_visit_notes, booking_info, delivery_info
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO UPDATE SET
                customer_no = EXCLUDED.customer_no,
                name = EXCLUDED.name,
                date = EXCLUDED.date,
                address = EXCLUDED.address,
                model = EXCLUDED.model,
                sale_type = EXCLUDED.sale_type,
                officer_id = EXCLUDED.officer_id,
                officer_name = EXCLUDED.officer_name,
                business = EXCLUDED.business,
                visit_completed = EXCLUDED.visit_completed,
                customer_type = EXCLUDED.customer_type,
                field_visit_notes = EXCLUDED.field_visit_notes,
                booking_info = EXCLUDED.booking_info,
                delivery_info = EXCLUDED.delivery_info;
        `;
        const values = [
            cust.id, cust.customer_no, cust.name, cust.date, cust.address, cust.model, cust.sale_type,
            cust.officer_id, cust.officer_name, cust.business, cust.visit_completed || 'No',
            cust.customer_type, cust.field_visit_notes, cust.booking_info, cust.delivery_info
        ];
        
        await pool.query(query, values);
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

app.delete('/customers/:id', async (c) => {
    const pool = c.get('pool');
    const id = c.req.param('id');
    try {
        await pool.query('DELETE FROM customers WHERE id = $1', [id]);
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// 3. Officers CRUD
app.get('/officers', async (c) => {
    const pool = c.get('pool');
    try {
        const result = await pool.query('SELECT * FROM officers');
        return c.json(result.rows);
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/officers', async (c) => {
    const pool = c.get('pool');
    try {
        const o = await c.req.json();
        const query = `
            INSERT INTO officers (id, full_name, territory, password, role, business)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                territory = EXCLUDED.territory,
                password = EXCLUDED.password,
                role = EXCLUDED.role,
                business = EXCLUDED.business;
        `;
        await pool.query(query, [o.id, o.full_name, o.territory, o.password, o.role, o.business]);
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

app.delete('/officers/:id', async (c) => {
    const pool = c.get('pool');
    const id = c.req.param('id');
    try {
        await pool.query('DELETE FROM officers WHERE id = $1', [id]);
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// 4. Businesses CRUD
app.post('/businesses', async (c) => {
    const pool = c.get('pool');
    try {
        const { name, icon } = await c.req.json();
        await pool.query('INSERT INTO businesses (name, icon) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET icon = $2', [name, icon]);
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

app.delete('/businesses/:name', async (c) => {
    const pool = c.get('pool');
    const name = c.req.param('name');
    try {
        await pool.query('DELETE FROM businesses WHERE name = $1', [name]);
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// Export the Hono handler for Cloudflare Pages Functions
export const onRequest = handle(app);